/**
 * Client-side media recorders built on `MediaRecorder` and `getUserMedia` /
 * `getDisplayMedia`. Everything stays on the device — recordings become local
 * Blobs that feed straight into the editor (media bin, or the A2 audio track).
 */

export type CaptureKind = "screen" | "webcam" | "voice";

export type ActiveCapture = {
  stop: () => Promise<Blob | null>;
  cancel: () => void;
  stream: MediaStream;
  /** Resolves when the source ends on its own (e.g. the user stops sharing). */
  ended: Promise<void>;
  kind: CaptureKind;
};

function pickMime(kind: CaptureKind): string {
  const videoCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  const audioCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const candidates = kind === "voice" ? audioCandidates : videoCandidates;
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

/**
 * Starts capturing a screen, webcam or microphone. Resolves with an active
 * capture handle whose `stop()` returns the recorded Blob.
 */
export async function startCapture(kind: CaptureKind): Promise<ActiveCapture> {
  if (!navigator.mediaDevices) throw new Error("Media capture is not supported here.");

  let stream: MediaStream;
  if (kind === "screen") {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true,
    });
  } else if (kind === "webcam") {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 },
      audio: true,
    });
  } else {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  const mimeType = pickMime(kind);
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
    for (const track of stream.getTracks()) track.stop();
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

  return { stop, cancel, stream, ended: trackEnded, kind };
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
