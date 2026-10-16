/**
 * Client-side media recorders built on `MediaRecorder` and `getUserMedia` /
 * `getDisplayMedia`. Everything stays on the device — recordings become local
 * Blobs that feed straight into the editor. Screen and webcam recordings use a
 * single WebM container with their video and mixed audio tracks together, so
 * they behave exactly like an imported video on V1. Voiceovers remain audio
 * only, because they intentionally belong on an A lane.
 */

export type CaptureKind = "screen" | "webcam" | "voice";

export type CaptureAudioReport = {
  /** True when an audio track was captured (mic and/or system audio). */
  hasAudio: boolean;
  /** True when the microphone contributed to the recording. */
  hasMic: boolean;
  /** True when the shared tab/screen provided its own audio. */
  hasSystemAudio: boolean;
  /** Human-readable reason the microphone was unavailable (null when fine). */
  micError: string | null;
};

/** What a finished capture produced. */
export type CaptureResult = {
  /** Combined video + audio WebM (screen / webcam captures). */
  video: Blob | null;
  /** Audio-only WebM/Opus (voice captures only). */
  audio: Blob | null;
};

export type ActiveCapture = {
  /** Stops recording and returns the finalized blobs. */
  stop: () => Promise<CaptureResult>;
  cancel: () => void;
  /** Live preview stream for the monitor `<video>` (video + mixed audio). */
  stream: MediaStream;
  /** Resolves when the source ends on its own (e.g. the user stops sharing). */
  ended: Promise<void>;
  kind: CaptureKind;
  /** What audio ended up in the recording — surfaced in the recorder UI. */
  audio: CaptureAudioReport;
  /** Live input level (RMS, 0..1) so the user can verify the mic is live. */
  getLevel: (() => number) | null;
};

export type CaptureOptions = {
  /**
   * Mix the microphone into a screen capture (default `true`). Ignored for
   * webcam / voice captures, which always use the mic directly.
   */
  microphone?: boolean;
};

/** Reasonable, platform-friendly voice constraints. */
const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: 30,
};

const VIDEO_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

const AUDIO_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickSupported(candidates: string[]): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

export function isCaptureSupported(kind: CaptureKind): boolean {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return false;
  if (typeof MediaRecorder === "undefined") return false;
  if (kind === "screen") return typeof navigator.mediaDevices.getDisplayMedia === "function";
  return typeof navigator.mediaDevices.getUserMedia === "function";
}

/** Turns a `getUserMedia` failure into an actionable message. */
function describeMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was blocked. Click the camera/mic icon in the address bar and allow it, then record again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The microphone is busy in another app.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "Microphone could not be started.";
}

/** Wraps a stream in a MediaRecorder and resolves with its blob on stop. */
function createRecorder(stream: MediaStream, mimeType: string) {
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
  });
  return {
    start: () => recorder.start(250),
    finish: async (): Promise<Blob | null> => {
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      if (chunks.length === 0) return null;
      return new Blob(chunks, {
        type:
          mimeType ||
          (stream.getVideoTracks().length > 0 ? "video/webm" : "audio/webm"),
      });
    },
    cancel: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // Already stopped.
      }
    },
  };
}

/**
 * Starts capturing a screen, webcam or microphone. Resolves with an active
 * capture handle whose `stop()` returns the finalized combined video/audio
 * blob (or an audio-only blob for voiceover capture).
 */
export async function startCapture(
  kind: CaptureKind,
  options: CaptureOptions = {}
): Promise<ActiveCapture> {
  if (!navigator.mediaDevices) throw new Error("Media capture is not supported here.");

  const owned: MediaStream[] = [];
  let videoTracks: MediaStreamTrack[] = [];
  let micStream: MediaStream | null = null;
  let systemStream: MediaStream | null = null;
  let micError: string | null = null;

  if (kind === "screen") {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      // Only honoured for tab shares where the user ticks "share tab audio".
      audio: true,
    });
    owned.push(display);
    videoTracks = display.getVideoTracks();
    const systemTracks = display.getAudioTracks();
    if (systemTracks.length > 0) systemStream = new MediaStream(systemTracks);

    if (options.microphone !== false) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
        owned.push(micStream);
      } catch (error) {
        micStream = null;
        micError = describeMicError(error);
      }
    }
  } else if (kind === "webcam") {
    // One call requesting BOTH tracks at once, exactly as the browser expects.
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: MIC_CONSTRAINTS,
      });
      owned.push(cam);
      videoTracks = cam.getVideoTracks();
      const micTracks = cam.getAudioTracks();
      if (micTracks.length > 0) micStream = new MediaStream(micTracks);
      else micError = "This camera feed has no microphone channel.";
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "NotFoundError" && name !== "OverconstrainedError") throw error;
      // No microphone on this machine: still allow a silent camera take.
      micError = describeMicError(error);
      const cam = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
      });
      owned.push(cam);
      videoTracks = cam.getVideoTracks();
    }
  } else {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    owned.push(mic);
    micStream = mic;
  }

  // --- Build the audio source -------------------------------------------
  // Mic only → record the mic directly (most reliable). Mic + tab audio →
  // mix through an AudioContext whose context is explicitly resumed, because a
  // *suspended* context produces a silent destination track.
  const micTracks = micStream?.getAudioTracks() ?? [];
  const systemTracks = systemStream?.getAudioTracks() ?? [];
  const mixNodes: MediaStreamAudioSourceNode[] = [];
  let mixContext: AudioContext | null = null;
  let audioStream: MediaStream | null = null;

  if (micTracks.length > 0 && systemTracks.length > 0) {
    mixContext = new AudioContext();
    try {
      await mixContext.resume();
    } catch {
      // Autoplay policy; the first gesture should already have unlocked it.
    }
    const destination = mixContext.createMediaStreamDestination();
    for (const source of [micStream, systemStream]) {
      if (!source) continue;
      const node = mixContext.createMediaStreamSource(source);
      node.connect(destination);
      mixNodes.push(node);
    }
    audioStream = destination.stream;
  } else if (micTracks.length > 0) {
    audioStream = new MediaStream(micTracks);
  } else if (systemTracks.length > 0) {
    audioStream = new MediaStream(systemTracks);
  }

  const hasMic = micTracks.length > 0;
  const hasSystemAudio = systemTracks.length > 0;
  const hasAudio = hasMic || hasSystemAudio;

  // --- Recorder ----------------------------------------------------------
  // Screen/webcam use one MediaStream containing both video and mixed audio,
  // which MediaRecorder writes into one WebM container. Do not split the
  // tracks: the editor previews this as ordinary V1 media. Voice is the only
  // intentionally audio-only capture.
  const isVoice = kind === "voice";
  const primaryStream = isVoice
    ? audioStream
    : videoTracks.length > 0
      ? new MediaStream([...videoTracks, ...(audioStream?.getAudioTracks() ?? [])])
      : null;
  if (!primaryStream) throw new Error("Nothing to record — no media tracks were granted.");

  const primaryMime = isVoice
    ? pickSupported(AUDIO_CANDIDATES)
    : pickSupported(VIDEO_CANDIDATES);
  if (!isVoice && !primaryMime) {
    throw new Error("This browser cannot record a WebM video with audio.");
  }
  const primary = createRecorder(primaryStream, primaryMime);

  primary.start();

  const previewStream = new MediaStream([
    ...videoTracks,
    ...(audioStream?.getAudioTracks() ?? []),
  ]);

  const trackEnded = new Promise<void>((resolve) => {
    for (const track of previewStream.getTracks()) {
      track.addEventListener("ended", () => resolve(), { once: true });
    }
  });

  const teardown = () => {
    for (const node of mixNodes) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    void mixContext?.close().catch(() => {});
    for (const ownedStream of owned) {
      for (const track of ownedStream.getTracks()) track.stop();
    }
  };

  const stop = async (): Promise<CaptureResult> => {
    const primaryBlob = await primary.finish();
    teardown();
    return isVoice
      ? { video: null, audio: primaryBlob }
      : { video: primaryBlob, audio: null };
  };

  const cancel = () => {
    primary.cancel();
    teardown();
  };

  // Meter the audio source directly so the level reflects real input.
  const meter = audioStream ? createLevelMeter(audioStream) : null;

  return {
    stop,
    cancel,
    stream: previewStream,
    ended: trackEnded,
    kind,
    audio: { hasAudio, hasMic, hasSystemAudio, micError },
    getLevel: meter ? meter.getLevel : null,
  };
}

/** Live microphone level meter (RMS, 0..1) for the voiceover UI. */
export function createLevelMeter(stream: MediaStream): {
  getLevel: () => number;
  close: () => void;
} | null {
  if (typeof AudioContext === "undefined") return null;
  try {
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    return {
      getLevel: () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const value = (data[i] - 128) / 128;
          sum += value * value;
        }
        return Math.min(1, Math.sqrt(sum / data.length) * 2.4);
      },
      close: () => {
        source.disconnect();
        analyser.disconnect();
        void context.close();
      },
    };
  } catch {
    return null;
  }
}
