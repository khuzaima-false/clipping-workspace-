import { createId, type AspectRatio, type CaptionWord, type TextOverlay } from "@/store/editor";

/** Caption grouping rules tuned for readable, short-form style subtitles. */
const MAX_WORDS_PER_CAPTION = 4;
const MAX_CAPTION_SECONDS = 2.6;
/** A pause longer than this starts a new caption group. */
const PAUSE_BREAK_SECONDS = 0.55;
/** Gaps shorter than this are bridged so captions never flicker off. */
const GAP_BRIDGE_SECONDS = 0.45;
/** Trailing hold so the final word stays on screen long enough to read. */
const TAIL_HOLD_SECONDS = 0.18;
const MIN_CAPTION_SECONDS = 0.3;

const SENTENCE_END = /[.!?]["')\]]?$/;

export type BuildCaptionsOptions = {
  /** Total video duration (seconds); captions are clamped to it. */
  duration: number;
  aspect: AspectRatio;
};

/** Picks an output-pixel font size that reads well at each 1080p-class aspect. */
function captionFontSize(aspect: AspectRatio): number {
  if (aspect === "9:16") return 78;
  if (aspect === "1:1") return 68;
  return 62;
}

/** Cleans up the raw Whisper word stream (trim + clamp timings). */
function normalizeWords(words: CaptionWord[] | null | undefined): CaptionWord[] {
  if (!Array.isArray(words)) return [];
  const cleaned: CaptionWord[] = [];
  for (const word of words) {
    // Whisper can emit null/empty chunks for silence — skip them entirely.
    if (!word || typeof word.text !== "string") continue;
    const text = word.text.trim();
    if (!text) continue;
    const rawStart = Number(word.start);
    const rawEnd = Number(word.end);
    if (!Number.isFinite(rawStart)) continue;
    const start = Math.max(0, rawStart);
    const end = Math.max(Number.isFinite(rawEnd) ? rawEnd : start, start);
    cleaned.push({ text, start, end });
  }
  return cleaned;
}

/** Splits a word stream into short, readable caption groups. */
function groupWords(words: CaptionWord[]): CaptionWord[][] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  for (const word of words) {
    if (current.length > 0) {
      const previous = current[current.length - 1];
      const gap = word.start - previous.end;
      const span = word.end - current[0].start;
      if (
        current.length >= MAX_WORDS_PER_CAPTION ||
        gap > PAUSE_BREAK_SECONDS ||
        span > MAX_CAPTION_SECONDS ||
        SENTENCE_END.test(previous.text)
      ) {
        groups.push(current);
        current = [];
      }
    }
    current.push(word);
  }

  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Converts timestamped words from Whisper into caption overlays that are ready
 * to render. Each overlay keeps its words so the renderer can highlight the
 * active word and animate words as they are spoken.
 */
export function buildAutoCaptions(
  words: CaptionWord[],
  options: BuildCaptionsOptions
): TextOverlay[] {
  const normalized = normalizeWords(words);
  if (normalized.length === 0) return [];

  const groups = groupWords(normalized);
  const fontSize = captionFontSize(options.aspect);
  const limit = options.duration > 0 ? options.duration : Number.POSITIVE_INFINITY;

  const captions: TextOverlay[] = [];
  for (const group of groups) {
    const first = group[0];
    const last = group[group.length - 1];
    const start = Math.min(first.start, limit);
    const end = Math.min(
      Math.max(last.end + TAIL_HOLD_SECONDS, start + MIN_CAPTION_SECONDS),
      limit
    );
    if (end <= start) continue;

    captions.push({
      id: createId("caption"),
      text: group.map((word) => word.text).join(" "),
      x: 50,
      // Kept clear of the bottom UI / safe area on vertical video.
      y: options.aspect === "9:16" ? 78 : 84,
      fontFamily: "Arial",
      fontSize,
      fillColor: "#ffffff",
      bgColor: "",
      padding: 0,
      radius: 0,
      alignment: "center",
      rotation: 0,
      opacity: 100,
      mask: false,
      startTime: start,
      endTime: end,
      words: group,
      auto: true,
    });
  }

  // Bridge micro-gaps: a 0.1–0.4s silence between phrases used to unmount the
  // subtitle for a few frames (visible flicker). Extend the previous caption to
  // the next caption's start so the overlay stays mounted through the pause.
  for (let i = 0; i < captions.length - 1; i += 1) {
    const current = captions[i];
    const next = captions[i + 1];
    const gap = next.startTime - current.endTime;
    if (gap > 0 && gap < GAP_BRIDGE_SECONDS) {
      captions[i] = { ...current, endTime: next.startTime };
    }
  }

  return captions;
}

/**
 * Turns a typed/imported script into evenly-timed caption overlays across the
 * clip duration — a fully client-side alternative to speech recognition. Each
 * word gets a uniform slot so karaoke/bounce highlighting stays in sync, and
 * the text is grouped with the same readability rules as real captions.
 */
export function buildScriptCaptions(
  script: string,
  options: BuildCaptionsOptions
): TextOverlay[] {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const limit =
    options.duration > 0 ? options.duration : words.length * 0.4;
  const slot = limit / words.length;
  const timed: CaptionWord[] = words.map((text, index) => ({
    text,
    start: index * slot,
    end: (index + 1) * slot,
  }));
  return buildAutoCaptions(timed, options);
}
