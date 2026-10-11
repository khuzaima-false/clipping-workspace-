import type { CaptionWord } from "@/store/editor";

/**
 * Client-side Whisper transcription.
 *
 * Everything here runs in the browser: the source video's audio is decoded
 * with the Web Audio API, resampled to 16 kHz mono, and fed to
 * `@xenova/transformers` running OpenAI's Whisper model via ONNX Runtime Web
 * (WASM). No audio ever leaves the device and there is no server cost.
 */

/** Whisper checkpoints known to work well with the WASM backend. */
export const WHISPER_MODELS = {
  tiny: "Xenova/whisper-tiny",
  small: "Xenova/whisper-small",
} as const;

export type WhisperModelId = (typeof WHISPER_MODELS)[keyof typeof WHISPER_MODELS];

/** Languages offered in the caption language picker. */
export const CAPTION_LANGUAGES = [
  { id: "auto", label: "Auto-detect" },
  { id: "english", label: "English" },
  { id: "urdu", label: "Urdu" },
  { id: "hindi", label: "Hindi" },
  { id: "spanish", label: "Spanish" },
  { id: "french", label: "French" },
  { id: "german", label: "German" },
  { id: "arabic", label: "Arabic" },
  { id: "portuguese", label: "Portuguese" },
  { id: "italian", label: "Italian" },
  { id: "japanese", label: "Japanese" },
  { id: "korean", label: "Korean" },
  { id: "chinese", label: "Chinese" },
  { id: "russian", label: "Russian" },
  { id: "turkish", label: "Turkish" },
  { id: "indonesian", label: "Indonesian" },
] as const;

export type CaptionLanguageId = (typeof CAPTION_LANGUAGES)[number]["id"];

/** Whisper always expects 16 kHz audio. */
const WHISPER_SAMPLE_RATE = 16000;
const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;

export type TranscribeProgressHandler = (status: string, progress: number) => void;

export type TranscribeOptions = {
  /** Which checkpoint to load. Defaults to the fast `whisper-tiny`. */
  model?: WhisperModelId;
  /** Spoken language, or `"auto"`/undefined to let Whisper detect it. */
  language?: CaptionLanguageId;
  /** Called as the model downloads and the audio is transcribed. */
  onProgress?: TranscribeProgressHandler;
};

type ProgressInfo = {
  status?: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

type TranscriptionChunk = {
  text: string;
  timestamp: [number, number | null];
};

type TranscriptionResult = {
  text: string;
  chunks?: TranscriptionChunk[];
};

type Transcriber = (
  audio: Float32Array,
  options?: Record<string, unknown>
) => Promise<TranscriptionResult>;

/** Decodes the video's audio track and resamples it to 16 kHz mono PCM. */
async function extractMonoAudio(file: File): Promise<Float32Array> {
  if (typeof AudioContext === "undefined" || typeof OfflineAudioContext === "undefined") {
    throw new Error("This browser cannot decode audio for transcription.");
  }

  const raw = await file.arrayBuffer();
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(raw);
  } catch {
    throw new Error("This video has no audio track to transcribe.");
  } finally {
    void context.close();
  }

  if (decoded.length === 0 || decoded.duration <= 0) {
    throw new Error("This video has no audio track to transcribe.");
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frames, WHISPER_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Transcribes a video file on-device and returns timestamped words.
 * @throws if the browser cannot decode audio or the model/transcription fails.
 */
export async function transcribeVideoFile(
  file: File,
  options: TranscribeOptions = {}
): Promise<CaptionWord[]> {
  const report = options.onProgress ?? (() => {});
  const model = options.model ?? WHISPER_MODELS.tiny;
  const language = options.language;

  report("Extracting audio…", 1);
  const audio = await extractMonoAudio(file);
  const audioDuration = audio.length / WHISPER_SAMPLE_RATE;

  report("Loading AI model…", 4);
  const { pipeline, env } = await import("@xenova/transformers");

  // Always fetch from the Hugging Face Hub and cache in the browser so repeat
  // runs are instant and we never depend on a local `/models` directory.
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = typeof caches !== "undefined";

  // Aggregate byte progress across every model file being downloaded.
  const downloaded = new Map<string, { loaded: number; total: number }>();
  const handleProgress = (info: ProgressInfo) => {
    const key = info.file ?? info.name;
    if (key && info.status === "progress") {
      downloaded.set(key, {
        loaded: info.loaded ?? 0,
        total: info.total ?? 0,
      });
    } else if (key && info.status === "done") {
      const current = downloaded.get(key);
      const size = current?.total || current?.loaded || 0;
      downloaded.set(key, { loaded: size, total: size });
    }

    let loaded = 0;
    let total = 0;
    for (const entry of downloaded.values()) {
      loaded += entry.loaded;
      total += entry.total;
    }
    const fraction = total > 0 ? Math.min(0.99, loaded / total) : 0.05;
    report(
      `Downloading AI model… ${Math.round(fraction * 100)}%`,
      4 + fraction * 56
    );
  };

  const transcriber = (await pipeline("automatic-speech-recognition", model, {
    quantized: true,
    progress_callback: handleProgress,
  })) as unknown as Transcriber;

  report("Transcribing audio…", 62);
  const estimatedChunks = Math.max(
    1,
    Math.ceil(audioDuration / (CHUNK_LENGTH_S - STRIDE_LENGTH_S))
  );
  let processedChunks = 0;

  const result = await transcriber(audio, {
    return_timestamps: "word",
    chunk_length_s: CHUNK_LENGTH_S,
    stride_length_s: STRIDE_LENGTH_S,
    task: "transcribe",
    // Omit `language` entirely to let Whisper auto-detect the spoken language.
    ...(language && language !== "auto" ? { language } : {}),
    chunk_callback: () => {
      processedChunks += 1;
      const fraction = Math.min(1, processedChunks / estimatedChunks);
      report("Transcribing audio…", 62 + fraction * 34);
    },
  });

  report("Finishing captions…", 99);

  const chunks = Array.isArray(result.chunks) ? result.chunks : [];
  const words: CaptionWord[] = [];
  for (const chunk of chunks) {
    const text = chunk.text?.trim();
    if (!text) continue;
    const start = chunk.timestamp?.[0];
    const rawEnd = chunk.timestamp?.[1];
    if (typeof start !== "number") continue;
    const end = typeof rawEnd === "number" ? Math.max(rawEnd, start) : start;
    words.push({ text, start, end });
  }

  report("Done", 100);
  return words;
}
