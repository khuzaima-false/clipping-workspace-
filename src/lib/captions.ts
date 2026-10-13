import { createId, type AspectRatio, type CaptionWord, type TextOverlay } from "@/store/editor";

/** Caption grouping rules tuned for readable, short-form style subtitles. */
const MAX_WORDS_PER_CAPTION = 4;
const MAX_CAPTION_SECONDS = 2.6;
/** A pause longer than this starts a new caption group. */
const PAUSE_BREAK_SECONDS = 0.55;
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
function normalizeWords(words: CaptionWord[]): CaptionWord[] {
  const cleaned: CaptionWord[] = [];
  for (const word of words) {
    const text = word.text.trim();
    if (!text) continue;
    const start = Math.max(0, word.start);
    const end = Math.max(word.end, start);
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

  return captions;
}
