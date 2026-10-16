/**
 * Client-side media recorders built on `MediaRecorder` and `getUserMedia` /
 * `getDisplayMedia`. Everything stays on the device — recordings become local
 * Blobs that feed straight into the editor (media bin, or the A2 audio track).
 *
 * ## Why recordings used to be silent
 *
 * `getDisplayMedia({ audio: true })` only yields a track when the user shares a
 * **browser tab** *and* ticks "Also share tab audio" — sharing a window or the
 * whole screen produces **no audio at all**, and the microphone is never part
 * of a display capture. Screen recordings were therefore silent by default.
 *
 * This module now mixes a microphone stream straight into the capture with a
 * Web Audio `MediaStreamAudioDestinationNode`, so:
 *   - screen recordings always carry narration (plus tab audio when granted),
 *   - webcam recordings fall back to video-only instead of failing when no
 *     microphone exists,
 *   - the UI can report exactly what was captured.
 */

export type CaptureKind = "screen" | "webcam" | "voice";

export type CaptureAudioReport = {
  /** True when the recorded stream contains at least one audio track. */
  hasAudio: boolean;
  /** True when a microphone was successfully mixed in. */
  hasMic: boolean;
  /** True when the shared tab/screen provided its own audio. */
  hasSystemAudio: boolean;
};

export type ActiveCapture = {
  stop: () => Promise<Blob | null>;
  cancel: () => void;
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

function pickMime(kind: CaptureKind, hasAudio: boolean): string {
  const videoWithAudio = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm",
    "video/mp4",
  ];
  const videoOnly = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  const audioCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  const candidates =
    kind === "voice"
      ? audioCandidates
      : hasAudio
        ? videoWithAudio
        : videoOnly;
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

/** Merges a display stream (video ± system audio) with an optional mic stream. */
function mergeStreams(
  display: MediaStream,
  mic: MediaStream | null
): { stream: MediaStream; cleanup: () => void; hasMic: boolean; hasSystemAudio: boolean } {
  const videoTracks = display.getVideoTracks();
  const systemTracks = display.getAudioTracks();
  const micTracks = mic?.getAudioTracks() ?? [];
  const hasMic = micTracks.length > 0;
  const hasSystemAudio = systemTracks.length > 0;

  // No mic (or the browser can't do Web Audio): keep whatever we were given.
  if (!hasMic || typeof AudioContext === "undefined") {
    return {
      stream: new MediaStream([...videoTracks, ...systemTracks, ...micTracks]),
      cleanup: () => {},
      hasMic,
      hasSystemAudio,
    };
  }

  // Mix system audio + microphone into one destination track.
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const nodes: MediaStreamAudioSourceNode[] = [];
  const connect = (source: MediaStream) => {
    if (source.getAudioTracks().length === 0) return;
    const node = context.createMediaStreamSource(source);
    node.connect(destination);
    nodes.push(node);
  };
  connect(new MediaStream(systemTracks));
  connect(new MediaStream(micTracks));

  return {
    stream: new MediaStream([...videoTracks, ...destination.stream.getAudioTracks()]),
    cleanup: () => {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Already torn down.
        }
      }
      void context.close().catch(() => {});
    },
    hasMic,
    hasSystemAudio,
  };
}

/**
 * Starts capturing a screen, webcam or microphone. Resolves with an active
 * capture handle whose `stop()` returns the recorded Blob.
 */
export async function startCapture(
  kind: CaptureKind,
  options: CaptureOptions = {}
): Promise<ActiveCapture> {
  if (!navigator.mediaDevices) throw new Error("Media capture is not supported here.");

  const owned: MediaStream[] = [];
  let stream: MediaStream;
  let cleanupMix: () => void = () => {};
  let hasMic = false;
  let hasSystemAudio = false;

  if (kind === "screen") {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      // Only honoured for tab shares where the user ticks "share tab audio".
      audio: true,
    });
    owned.push(display);

    // Always try to add narration so a plain screen share isn't silent.
    let mic: MediaStream | null = null;
    if (options.microphone !== false) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
        owned.push(mic);
      } catch {
        mic = null;
      }
    }

    const merged = mergeStreams(display, mic);
    stream = merged.stream;
    cleanupMix = merged.cleanup;
    hasMic = merged.hasMic;
    hasSystemAudio = merged.hasSystemAudio;
  } else if (kind === "webcam") {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 },
        audio: MIC_CONSTRAINTS,
      });
      owned.push(cam);
      stream = cam;
      hasMic = cam.getAudioTracks().length > 0;
    } catch (error) {
      // A machine without a microphone throws NotFoundError for {audio:true} —
      // fall back to a silent camera feed instead of failing the recording.
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "NotFoundError" && name !== "OverconstrainedError") throw error;
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 },
      });
      owned.push(cam);
      stream = cam;
      hasMic = false;
    }
  } else {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    owned.push(mic);
    stream = mic;
    hasMic = mic.getAudioTracks().length > 0;
  }

  const hasAudio = stream.getAudioTracks().length > 0;
  const mimeType = pickMime(kind, hasAudio);
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
  });

  const trackEnded = new Promise<void>((resolve) => {
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => resolve(), { once: true });
    }
  });

  recorder.start(250);

  const teardown = () => {
    cleanupMix();
    for (const ownedStream of owned) {
      for (const track of ownedStream.getTracks()) track.stop();
    }
  };

  const stop = async (): Promise<Blob | null> => {
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    teardown();
    if (chunks.length === 0) return null;
    return new Blob(chunks, { type: mimeType || "video/webm" });
  };

  const cancel = () => {
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      // already stopped
    }
    teardown();
  };

  // Meter the mixed output so the user can see the level before recording.
  const meter = hasAudio ? createLevelMeter(stream) : null;

  return {
    stop,
    cancel,
    stream,
    ended: trackEnded,
    kind,
    audio: { hasAudio, hasMic, hasSystemAudio },
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
