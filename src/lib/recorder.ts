/**
 * Client-side media recorders built on `MediaRecorder` and `getUserMedia` /
 * `getDisplayMedia`. Everything stays on the device — recordings become local
 * Blobs that feed straight into the editor.
 *
 * ## Design
 *
 * Every capture produces **one combined `.webm`** holding both the video and
 * the audio tracks, so a recording drops onto V1 as a single clip with its
 * native audio intact (no separate A-lane files).
 *
 * Two browser traps are handled explicitly:
 *
 * 1. `getDisplayMedia({ audio: true })` only yields a track when the user shares
 *    a **browser tab** *and* ticks “Also share tab audio”; a window/screen share
 *    produces **no audio at all**, and the microphone is never part of a display
 *    capture. A microphone stream is therefore always mixed in for screen
 *    captures (see `mixAudioTracks`).
 * 2. A mixing `AudioContext` starts **suspended** until a user gesture, and a
 *    suspended context's `MediaStreamAudioDestinationNode` emits silence — so
 *    the context is explicitly `resume()`d before recording starts.
 */

export type CaptureKind = "screen" | "webcam" | "voice";

export type CaptureAudioReport = {
  /** True when the recorded container carries an audio track. */
  hasAudio: boolean;
  /** True when the microphone contributed to the recording. */
  hasMic: boolean;
  /** True when the shared tab/screen provided its own audio. */
  hasSystemAudio: boolean;
  /** Human-readable reason the microphone was unavailable (null when fine). */
  micError: string | null;
};

/** What a finished capture produced (one file, never two). */
export type CaptureResult = {
  /** Combined video+audio WebM for screen / webcam captures. */
  video: Blob | null;
  /** Audio-only WebM for voice captures (`kind === "voice"`). */
  audio: Blob | null;
};

export type ActiveCapture = {
  /** Stops recording and returns the finalized blob(s). */
  stop: () => Promise<CaptureResult>;
  cancel: () => void;
  /** The combined preview stream (video + mixed audio). */
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

const VIDEO_WITH_AUDIO_MIME = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

const VIDEO_ONLY_MIME = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

const AUDIO_MIME = [
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
    return "Microphone access was blocked. Click the camera/mic icon in the address bar, allow it, then record again.";
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

/**
 * Returns a single audio track combining the microphone with the capture's own
 * audio (tab/system), or `null` when neither exists.
 *
 * Mixing is only needed when BOTH sources exist — otherwise the raw track is
 * reused, which avoids the suspended-AudioContext silence trap entirely.
 */
async function mixAudioTracks(
  mic: MediaStream | null,
  system: MediaStream | null
): Promise<{ stream: MediaStream | null; cleanup: () => void }> {
  const micTracks = mic?.getAudioTracks() ?? [];
  const systemTracks = system?.getAudioTracks() ?? [];

  if (micTracks.length === 0) {
    return {
      stream: systemTracks.length > 0 ? new MediaStream(systemTracks) : null,
      cleanup: () => {},
    };
  }
  if (systemTracks.length === 0) {
    return { stream: new MediaStream(micTracks), cleanup: () => {} };
  }

  const context = new AudioContext();
  // A suspended context would emit pure silence, so make sure it runs.
  try {
    await context.resume();
  } catch {
    // Autoplay policy; the recording keeps the raw mic track as a fallback.
  }
  const destination = context.createMediaStreamDestination();
  const nodes: MediaStreamAudioSourceNode[] = [];
  for (const source of [mic, system]) {
    if (!source || source.getAudioTracks().length === 0) continue;
    const node = context.createMediaStreamSource(source);
    node.connect(destination);
    nodes.push(node);
  }
  return {
    stream: destination.stream,
    cleanup: () => {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Already disconnected.
        }
      }
      void context.close().catch(() => {});
    },
  };
}

/**
 * Starts capturing a screen, webcam or microphone. Resolves with an active
 * capture handle whose `stop()` returns the finalized blob.
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
    // One call requesting BOTH tracks at once.
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

  // --- Combine everything into ONE stream -------------------------------
  const mixed = await mixAudioTracks(micStream, systemStream);
  const audioTracks = mixed.stream?.getAudioTracks() ?? [];
  const hasMic = (micStream?.getAudioTracks().length ?? 0) > 0;
  const hasSystemAudio = (systemStream?.getAudioTracks().length ?? 0) > 0;
  const hasAudio = audioTracks.length > 0;

  const isVoice = kind === "voice";
  const combinedTracks = isVoice
    ? audioTracks
    : [...videoTracks, ...audioTracks];
  const combinedStream = new MediaStream(combinedTracks);
  if (combinedTracks.length === 0) {
    mixed.cleanup();
    throw new Error("Nothing to record — no media tracks were granted.");
  }

  const mimeType = isVoice
    ? pickSupported(AUDIO_MIME)
    : pickSupported(hasAudio ? VIDEO_WITH_AUDIO_MIME : VIDEO_ONLY_MIME);

  const recorder = new MediaRecorder(
    combinedStream,
    mimeType ? { mimeType } : undefined
  );
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
  });

  const trackEnded = new Promise<void>((resolve) => {
    for (const track of combinedStream.getTracks()) {
      track.addEventListener("ended", () => resolve(), { once: true });
    }
  });

  recorder.start(250);

  const teardown = () => {
    mixed.cleanup();
    for (const ownedStream of owned) {
      for (const track of ownedStream.getTracks()) track.stop();
    }
  };

  const stop = async (): Promise<CaptureResult> => {
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    teardown();
    const blob =
      chunks.length > 0
        ? new Blob(chunks, {
            type: mimeType || (isVoice ? "audio/webm" : "video/webm"),
          })
        : null;
    return isVoice ? { video: null, audio: blob } : { video: blob, audio: null };
  };

  const cancel = () => {
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      // Already stopped.
    }
    teardown();
  };

  // Meter the audio source so the user can verify the mic is live.
  const meterStream = mixed.stream ?? micStream ?? systemStream;
  const meter = meterStream ? createLevelMeter(meterStream) : null;

  return {
    stop,
    cancel,
    stream: combinedStream,
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
