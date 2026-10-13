/**
 * Thin wrapper around the browser SpeechRecognition API (Chrome/Edge expose it
 * as `webkitSpeechRecognition`). Used only for optional live dictation while
 * writing a caption script — everything stays on-device and costs nothing.
 */

type SpeechRecognitionResult = {
  length: number;
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as Record<string, unknown>;
  const ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as RecognitionCtor) : null;
}

export function isDictationSupported(): boolean {
  return getCtor() !== null;
}

export type Dictation = {
  start: () => void;
  stop: () => void;
};

/**
 * Starts a live dictation session. `onText` receives each finalized chunk;
 * `onEnd` fires when the recognizer stops.
 */
export function createDictation(
  onText: (text: string) => void,
  onEnd?: () => void,
  lang = "en-US"
): Dictation | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = lang;
  recognition.onresult = (event) => {
    let chunk = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      chunk += event.results[i][0].transcript;
    }
    if (chunk.trim()) onText(chunk.trim());
  };
  recognition.onerror = () => onEnd?.();
  recognition.onend = () => onEnd?.();
  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        // Already started.
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    },
  };
}
