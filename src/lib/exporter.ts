import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { MIX_SAMPLE_RATE, mixTimelineAudio, type AudioMixTrack } from "@/lib/audio";
import { computeSourceFrameTimes, isSpeedRamped, speedAt } from "@/lib/render";
import type { SpeedPoint } from "@/store/editor";

/**
 * In-browser 1080p export engine.
 *
 * Primary path: seek-and-render every frame off the source video into a
 * canvas, encode with WebCodecs `VideoEncoder` (H.264) + optional `AudioEncoder`
 * (AAC), and mux into MP4 with `mp4-muxer`.
 *
 * Fallback path: when WebCodecs encoding is unavailable, record the canvas
 * with `MediaRecorder` in real time (`video/mp4` or `video/webm`).
 */

export const EXPORT_FPS = 30;

export type ExportProgress = {
  /** Human-readable status, e.g. "Rendering Frame 120 / 600 - 20%". */
  label: string;
  percent: number;
};

export type ExportVideoOptions = {
  video: HTMLVideoElement;
  /** Draws the current video frame + overlays onto the export canvas for the given timeline time (seconds). */
  renderFrame: (ctx: CanvasRenderingContext2D, time: number) => void;
  width: number;
  height: number;
  trimStart: number;
  trimEnd: number;
  fps?: number;
  /** Source file, used to decode the video's own audio track for the MP4. */
  file: File | null;
  /** External audio tracks / SFX mixed into the exported audio. */
  audioTracks?: AudioMixTrack[];
  /** Velocity curve; when ramped, output frames step variable source deltas. */
  speedPoints?: SpeedPoint[];
  /**
   * Credit gate. Called once, before any rendering begins. Returning `false`
   * aborts the export with {@link InsufficientCreditsError} (no frames are
   * encoded), which the UI uses to surface the referral prompt.
   */
  authorize?: () => Promise<boolean>;
  onProgress: (progress: ExportProgress) => void;
  signal?: AbortSignal;
};

export type ExportResult = {
  blob: Blob;
  extension: "mp4" | "webm";
  /** True when the real-time MediaRecorder fallback was used. */
  usedFallback: boolean;
};

/** Thrown when `authorize` rejects the export (e.g. no daily credits left). */
export class InsufficientCreditsError extends Error {
  constructor(message = "Daily export credits exhausted.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

class EncoderSetupError extends Error {
  constructor() {
    super("WebCodecs H.264 encoding is not supported in this browser.");
    this.name = "EncoderSetupError";
  }
}

function abortError(): DOMException {
  return new DOMException("The export was cancelled.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Linearly interpolates a sample at a fractional index (clamped at the ends). */
function sampleAt(data: Float32Array, position: number): number {
  if (data.length === 0) return 0;
  if (position <= 0) return data[0];
  const index = Math.floor(position);
  if (index >= data.length - 1) return data[data.length - 1];
  const fraction = position - index;
  return data[index] * (1 - fraction) + data[index + 1] * fraction;
}

function createRenderCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D rendering is not available in this browser.");
  return ctx;
}

function waitForEvent(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve) => {
    video.addEventListener(event, () => resolve(), { once: true });
  });
}

/** Seeks the video and resolves once the new frame is available for drawing. */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = video.duration;
  const clamped =
    Number.isFinite(duration) && duration > 0
      ? Math.max(0, Math.min(time, duration - 0.001))
      : Math.max(0, time);

  if (video.readyState >= 2 && Math.abs(video.currentTime - clamped) < 1 / 240) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    function onSeeked(): void {
      video.removeEventListener("error", onError);
      resolve();
    }
    function onError(): void {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("The video failed while seeking."));
    }
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = clamped;
  });
}

type DecodedAudio = {
  buffer: AudioBuffer;
  sampleRate: number;
};

/** Decodes the source file's audio and resamples it to 48 kHz stereo PCM. */
async function decodeAudio(file: File): Promise<DecodedAudio | null> {
  try {
    if (typeof AudioContext === "undefined" || typeof OfflineAudioContext === "undefined") {
      return null;
    }
    const raw = await file.arrayBuffer();
    const context = new AudioContext();
    let decoded: AudioBuffer;
    try {
      decoded = await context.decodeAudioData(raw);
    } finally {
      void context.close();
    }
    if (decoded.length === 0) return null;

    const sampleRate = 48000;
    const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offline = new OfflineAudioContext(2, frames, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const buffer = await offline.startRendering();
    return { buffer, sampleRate };
  } catch {
    // Audio is best-effort: an unsupported codec only costs the audio track.
    return null;
  }
}

async function pickVideoConfig(
  width: number,
  height: number,
  fps: number
): Promise<VideoEncoderConfig | null> {
  const bitrate = Math.round(
    Math.min(Math.max(width * height * fps * 0.12, 4_000_000), 16_000_000)
  );
  const candidates = ["avc1.640028", "avc1.4d0028", "avc1.420028", "avc1.42001f"];
  for (const codec of candidates) {
    try {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return config;
    } catch {
      // Try the next profile.
    }
  }
  return null;
}

async function pickAudioConfig(
  sampleRate: number,
  numberOfChannels: number
): Promise<AudioEncoderConfig | null> {
  if (typeof AudioEncoder === "undefined") return null;
  const config: AudioEncoderConfig = {
    codec: "mp4a.40.2",
    sampleRate,
    numberOfChannels,
    bitrate: 128_000,
  };
  try {
    const support = await AudioEncoder.isConfigSupported(config);
    return support.supported ? config : null;
  } catch {
    return null;
  }
}

async function exportWithWebCodecs(
  opts: ExportVideoOptions
): Promise<ExportResult> {
  const { video, renderFrame, width, height, trimStart, trimEnd, signal } = opts;
  const fps = opts.fps ?? EXPORT_FPS;
  const speedPoints = opts.speedPoints ?? [];
  const ramped = isSpeedRamped(speedPoints);
  // Variable source-time positions produce the speed ramp in the output.
  const sourceTimes = computeSourceFrameTimes(speedPoints, trimStart, trimEnd, fps);
  const totalFrames = Math.max(1, sourceTimes.length);

  const videoConfig = await pickVideoConfig(width, height, fps);
  if (!videoConfig) throw new EncoderSetupError();

  // Decode the video's own audio (if any) and offline-mix every external
  // track into one stereo buffer representing the trimmed timeline.
  const baseAudio = opts.file ? await decodeAudio(opts.file) : null;
  const mixedAudio = await mixTimelineAudio({
    baseBuffer: baseAudio?.buffer ?? null,
    tracks: opts.audioTracks ?? [],
    trimStart,
    trimEnd,
    sampleRate: MIX_SAMPLE_RATE,
  });
  const audioConfig = mixedAudio
    ? await pickAudioConfig(mixedAudio.sampleRate, 2)
    : null;

  const ctx = createRenderCanvas(width, height);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height, frameRate: fps },
    audio: audioConfig
      ? {
          codec: "aac",
          numberOfChannels: 2,
          sampleRate: audioConfig.sampleRate,
        }
      : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encoderError: Error | null = null;
  const onEncoderError = (error: Error) => {
    if (!encoderError) encoderError = error;
  };

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: onEncoderError,
  });
  videoEncoder.configure(videoConfig);

  let audioEncoder: AudioEncoder | null = null;
  if (audioConfig && mixedAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: onEncoderError,
    });
    audioEncoder.configure(audioConfig);
  }

  const samplesPerFrame = mixedAudio
    ? Math.round(mixedAudio.sampleRate / fps)
    : 0;

  let finalized = false;
  try {
    throwIfAborted(signal);
    if (video.readyState < 1) await waitForEvent(video, "loadedmetadata");

    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal);
      const sourceTime = sourceTimes[i] ?? trimEnd;
      await seekTo(video, sourceTime);
      throwIfAborted(signal);
      renderFrame(ctx, sourceTime);

      const frame = new VideoFrame(ctx.canvas, {
        timestamp: Math.round((i / fps) * 1e6),
        duration: Math.round(1e6 / fps),
      });
      videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      if (audioEncoder && mixedAudio) {
        if (ramped) {
          // Resample the mixed source audio across the variable step so the
          // audio follows the velocity curve (pitch shifts like real speed-up).
          const t0 = Math.max(0, sourceTime - trimStart);
          const nextSource = i + 1 < totalFrames ? sourceTimes[i + 1] : trimEnd;
          const t1 = Math.max(t0, nextSource - trimStart);
          const data = new Float32Array(samplesPerFrame * 2);
          for (let channel = 0; channel < 2; channel++) {
            const channelData = mixedAudio.getChannelData(channel);
            const channelOffset = channel * samplesPerFrame;
            for (let j = 0; j < samplesPerFrame; j++) {
              const fraction = j / samplesPerFrame;
              const position = (t0 + (t1 - t0) * fraction) * mixedAudio.sampleRate;
              data[channelOffset + j] = sampleAt(channelData, position);
            }
          }
          const audioData = new AudioData({
            format: "f32-planar",
            sampleRate: mixedAudio.sampleRate,
            numberOfFrames: samplesPerFrame,
            numberOfChannels: 2,
            timestamp: Math.round((i / fps) * 1e6),
            data,
          });
          audioEncoder.encode(audioData);
          audioData.close();
        } else {
          const start = i * samplesPerFrame;
          const available = Math.min(samplesPerFrame, mixedAudio.length - start);
          if (available > 0) {
            const data = new Float32Array(available * 2);
            for (let channel = 0; channel < 2; channel++) {
              data.set(
                mixedAudio.getChannelData(channel).subarray(start, start + available),
                channel * available
              );
            }
            const audioData = new AudioData({
              format: "f32-planar",
              sampleRate: mixedAudio.sampleRate,
              numberOfFrames: available,
              numberOfChannels: 2,
              timestamp: Math.round((i / fps) * 1e6),
              data,
            });
            audioEncoder.encode(audioData);
            audioData.close();
          }
        }
      }

      // Backpressure: keep the encoder queues from growing without bound.
      while (videoEncoder.encodeQueueSize > 4) {
        throwIfAborted(signal);
        if (encoderError) throw encoderError;
        await sleep(5);
      }
      while (audioEncoder && audioEncoder.encodeQueueSize > 8) {
        throwIfAborted(signal);
        if (encoderError) throw encoderError;
        await sleep(5);
      }
      if (encoderError) throw encoderError;

      const percent = Math.round(((i + 1) / totalFrames) * 100);
      opts.onProgress({
        label: `Rendering Frame ${i + 1} / ${totalFrames} - ${percent}%`,
        percent,
      });
    }

    opts.onProgress({ label: "Finalizing MP4…", percent: 100 });
    await videoEncoder.flush();
    videoEncoder.close();
    if (audioEncoder) {
      await audioEncoder.flush();
      audioEncoder.close();
    }
    if (encoderError) throw encoderError;
    muxer.finalize();
    finalized = true;
  } finally {
    if (!finalized) {
      if (videoEncoder.state !== "closed") videoEncoder.close();
      if (audioEncoder && audioEncoder.state !== "closed") audioEncoder.close();
    }
  }

  return {
    blob: new Blob([target.buffer], { type: "video/mp4" }),
    extension: "mp4",
    usedFallback: false,
  };
}

type AudioGraph = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
};

/**
 * An HTMLMediaElement may only ever be wrapped by one
 * MediaElementAudioSourceNode, so graphs are cached per element and reused
 * across recordings (the element keeps playing through the graph afterwards,
 * so preview audio keeps working).
 */
const audioGraphs = new WeakMap<HTMLVideoElement, AudioGraph>();

async function connectAudioGraph(
  video: HTMLVideoElement
): Promise<{ graph: AudioGraph; dest: MediaStreamAudioDestinationNode } | null> {
  try {
    if (typeof AudioContext === "undefined") return null;
    let graph = audioGraphs.get(video);
    if (!graph) {
      const context = new AudioContext();
      const source = context.createMediaElementSource(video);
      source.connect(context.destination);
      graph = { context, source };
      audioGraphs.set(video, graph);
    }
    await graph.context.resume();
    const dest = graph.context.createMediaStreamDestination();
    graph.source.connect(dest);
    return { graph, dest };
  } catch {
    return null;
  }
}

function pickRecorderMime(hasAudio: boolean): string {
  const withAudio = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const videoOnly = [
    "video/mp4;codecs=avc1.42001f",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const candidate of hasAudio ? withAudio : videoOnly) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

async function exportWithMediaRecorder(
  opts: ExportVideoOptions
): Promise<ExportResult> {
  const { video, renderFrame, width, height, trimStart, trimEnd, onProgress, signal } =
    opts;
  const fps = opts.fps ?? EXPORT_FPS;
  const speedPoints = opts.speedPoints ?? [];
  const totalFrames = Math.max(
    1,
    computeSourceFrameTimes(speedPoints, trimStart, trimEnd, fps).length
  );

  const ctx = createRenderCanvas(width, height);
  const stream = ctx.canvas.captureStream(fps);
  const audio = await connectAudioGraph(video);
  const hasAudio = Boolean(audio);
  if (audio) {
    for (const track of audio.dest.stream.getAudioTracks()) stream.addTrack(track);
  }

  const requestedMime = pickRecorderMime(hasAudio);
  const recorder = new MediaRecorder(
    stream,
    requestedMime
      ? { mimeType: requestedMime, videoBitsPerSecond: 8_000_000 }
      : { videoBitsPerSecond: 8_000_000 }
  );

  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    const data = event.data;
    if (data.size > 0) chunks.push(data);
  });

  const completion = new Promise<void>((resolve, reject) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.addEventListener(
      "error",
      () => reject(new Error("Recording failed in this browser.")),
      { once: true }
    );
    if (signal) {
      signal.addEventListener("abort", () => reject(abortError()), { once: true });
    }
  });

  throwIfAborted(signal);
  await seekTo(video, trimStart);
  const timelineBase = video.currentTime;

  let rafId = 0;
  const scheduledSources: AudioBufferSourceNode[] = [];
  try {
    recorder.start(250);

    let playbackAllowed = true;
    try {
      await video.play();
    } catch {
      playbackAllowed = false;
    }
    if (!playbackAllowed) {
      throw new Error(
        "Playback was blocked before recording could start. Press Export again to allow playback."
      );
    }

    // Layer the external tracks into the same real-time mix as the video.
    if (audio) {
      const context = audio.graph.context;
      const now = context.currentTime;
      for (const track of opts.audioTracks ?? []) {
        if (!track.buffer) continue;
        const timelineEnd = track.startTime + track.duration;
        const playStart = Math.max(track.startTime, timelineBase);
        const playEnd = Math.min(timelineEnd, trimEnd);
        if (playEnd <= playStart) continue;

        const source = context.createBufferSource();
        source.buffer = track.buffer;
        const gain = context.createGain();
        gain.gain.value = clamp01(track.volume);
        source.connect(gain);
        gain.connect(audio.dest);
        gain.connect(context.destination);

        const when = now + Math.max(0, playStart - timelineBase);
        const offset = track.trimStart + (playStart - track.startTime);
        const duration = Math.min(
          playEnd - playStart,
          Math.max(0, track.buffer.duration - offset)
        );
        if (duration <= 0) continue;
        source.start(when, offset, duration);
        scheduledSources.push(source);
      }
    }

    const tick = () => {
      // Follow the velocity curve in real time for the fallback recorder.
      if (speedPoints.length > 0) {
        const rate = speedAt(speedPoints, video.currentTime);
        if (Math.abs(video.playbackRate - rate) > 0.001) video.playbackRate = rate;
      }
      renderFrame(ctx, video.currentTime);
      const progress = clamp01((video.currentTime - trimStart) / (trimEnd - trimStart));
      const percent = Math.round(progress * 100);
      const frame = Math.min(
        totalFrames,
        Math.max(1, Math.round(progress * totalFrames))
      );
      onProgress({
        label: `Rendering Frame ${frame} / ${totalFrames} - ${percent}%`,
        percent,
      });

      if (video.currentTime >= trimEnd - 0.03 || video.ended) {
        // Give the recorder a beat to capture the final frames, then stop.
        window.setTimeout(() => {
          video.pause();
          if (recorder.state !== "inactive") recorder.stop();
        }, 200);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    await completion;
    onProgress({ label: "Finalizing video…", percent: 100 });
  } finally {
    if (rafId) cancelAnimationFrame(rafId);
    video.pause();
    video.playbackRate = 1;
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Recorder was already stopped.
      }
    }
    for (const source of scheduledSources) {
      try {
        source.stop();
      } catch {
        // Source already ended.
      }
      source.disconnect();
    }
    if (audio) audio.graph.source.disconnect(audio.dest);
    for (const track of stream.getTracks()) track.stop();
  }

  const type = recorder.mimeType || requestedMime || "video/webm";
  const blob = new Blob(chunks, { type });
  if (blob.size === 0) {
    throw new Error("Recording produced no data in this browser.");
  }
  return {
    blob,
    extension: type.includes("mp4") ? "mp4" : "webm",
    usedFallback: true,
  };
}

/**
 * Exports the trimmed scene as a 1080p-class video file. Uses WebCodecs +
 * mp4-muxer when available and falls back to MediaRecorder otherwise.
 */
export async function exportVideo(
  opts: ExportVideoOptions
): Promise<ExportResult> {
  throwIfAborted(opts.signal);

  // Credit gate: spends one daily credit before any frame is rendered.
  if (opts.authorize) {
    const allowed = await opts.authorize();
    if (!allowed) throw new InsufficientCreditsError();
  }

  if (typeof VideoEncoder !== "undefined") {
    try {
      return await exportWithWebCodecs(opts);
    } catch (err) {
      // Re-throw the credit error untouched (never fall back for it).
      if (err instanceof InsufficientCreditsError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof EncoderSetupError) {
        opts.onProgress({ label: "Preparing real-time recording…", percent: 0 });
        return exportWithMediaRecorder(opts);
      }
      throw err;
    }
  }

  opts.onProgress({ label: "Preparing real-time recording…", percent: 0 });
  return exportWithMediaRecorder(opts);
}

/** Triggers a browser download for an exported file. */
export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
