/**
 * Shared track model for the multi-track timeline workspace.
 *
 * Kept dependency-free so both the editor store and the timeline UI can import
 * it without creating a cycle.
 */

/** Every possible lane key. Tracks are unlimited: V1, V2, … and A1, A2, … */
export type TrackKey = `V${number}` | `T${number}` | `A${number}`;

/** The per-track header toggles (mute, solo, lock, visibility). */
export type TrackField = "muted" | "solo" | "locked" | "isVisible";

export type TrackState = {
  /** Mute the lane during preview + export. */
  muted: boolean;
  /** Solo the lane (every non-soloed lane is silenced / hidden). */
  solo: boolean;
  /** Block dragging, resizing, splitting and deletion on this lane. */
  locked: boolean;
  /** Eye toggle — when false the lane's content is skipped entirely. */
  isVisible: boolean;
};

export type TrackStateMap = Record<string, TrackState>;

export const DEFAULT_VIDEO_TRACK_COUNT = 3;
export const DEFAULT_TEXT_TRACK_COUNT = 1;
export const DEFAULT_AUDIO_TRACK_COUNT = 3;

/** Video lanes, top-down for the original three-track projects. */
export const VIDEO_TRACK_KEYS = ["V3", "V2", "V1"] as const;

/** Audio lanes in display order for the original three-track projects. */
export const AUDIO_TRACK_KEYS: TrackKey[] = ["A1", "A2", "A3"];

/** All original lanes, in the order they are rendered (top to bottom). */
export const TRACK_KEYS: TrackKey[] = ["V3", "V2", "V1", "A1", "A2", "A3"];

export const DEFAULT_TRACK_STATE: TrackState = {
  muted: false,
  solo: false,
  locked: false,
  isVisible: true,
};

/** Generates the display order for a dynamic video-track count (top-down). */
export function videoTrackKeys(count = DEFAULT_VIDEO_TRACK_COUNT): TrackKey[] {
  const size = Math.max(1, Math.floor(count));
  return Array.from({ length: size }, (_, index) => `V${size - index}` as TrackKey);
}

/** Generates the display order for a dynamic text/sticker-track count. */
export function textTrackKeys(count = DEFAULT_TEXT_TRACK_COUNT): TrackKey[] {
  const size = Math.max(1, Math.floor(count));
  return Array.from({ length: size }, (_, index) => `T${index + 1}` as TrackKey);
}

/** Generates the display order for a dynamic audio-track count (top-down). */
export function audioTrackKeys(count = DEFAULT_AUDIO_TRACK_COUNT): TrackKey[] {
  const size = Math.max(1, Math.floor(count));
  return Array.from({ length: size }, (_, index) => `A${index + 1}` as TrackKey);
}

/** Every lane for the current project, in timeline render order. */
export function allTrackKeys(
  videoCount = DEFAULT_VIDEO_TRACK_COUNT,
  textCount = DEFAULT_TEXT_TRACK_COUNT,
  audioCount = DEFAULT_AUDIO_TRACK_COUNT
): TrackKey[] {
  return [
    ...videoTrackKeys(videoCount),
    ...textTrackKeys(textCount),
    ...audioTrackKeys(audioCount),
  ];
}

/** A fresh, fully-unlocked set of track states for the requested lane counts. */
export function defaultTrackStates(
  videoCount = DEFAULT_VIDEO_TRACK_COUNT,
  textCount = DEFAULT_TEXT_TRACK_COUNT,
  audioCount = DEFAULT_AUDIO_TRACK_COUNT
): TrackStateMap {
  const states: TrackStateMap = {};
  for (const key of allTrackKeys(videoCount, textCount, audioCount)) {
    states[key] = { ...DEFAULT_TRACK_STATE };
  }
  return states;
}

export function isVideoTrackKey(value: unknown): value is TrackKey {
  return typeof value === "string" && /^V[1-9]\d*$/.test(value);
}

export function isTextTrackKey(value: unknown): value is TrackKey {
  return typeof value === "string" && /^T[1-9]\d*$/.test(value);
}

export function isAudioTrackKey(value: unknown): value is TrackKey {
  return typeof value === "string" && /^A[1-9]\d*$/.test(value);
}

export function isTrackKey(value: unknown): value is TrackKey {
  return isVideoTrackKey(value) || isTextTrackKey(value) || isAudioTrackKey(value);
}

/** Maps a zero-based audio lane index to its track key (A1, A2, A3, …). */
export function laneKeyFor(lane: number): TrackKey {
  return `A${Math.max(1, Math.floor(lane) + 1)}` as TrackKey;
}

/** Zero-based lane index for an audio track key. */
export function laneIndexOf(key: TrackKey): number {
  const match = /^A([1-9]\d*)$/.exec(key);
  return match ? Math.max(0, Number(match[1]) - 1) : 0;
}

/** Zero-based lane index for a video track key (V1 = 0, V2 = 1, …). */
export function videoLaneIndexOf(key: TrackKey): number {
  const match = /^V([1-9]\d*)$/.exec(key);
  return match ? Math.max(0, Number(match[1]) - 1) : 0;
}

/** Numeric video lane (V1 = 1, V2 = 2, …); 0 for audio/unknown keys. */
export function videoTrackNumber(value: unknown): number {
  if (typeof value !== "string") return 0;
  const match = /^V([1-9]\d*)$/.exec(value);
  return match ? Number(match[1]) : 0;
}

/** Merges a persisted/partial track-state map with the dynamic defaults. */
export function normalizeTrackStates(
  raw: unknown,
  videoCount = DEFAULT_VIDEO_TRACK_COUNT,
  textCount = DEFAULT_TEXT_TRACK_COUNT,
  audioCount = DEFAULT_AUDIO_TRACK_COUNT
): TrackStateMap {
  const base = defaultTrackStates(videoCount, textCount, audioCount);
  if (!raw || typeof raw !== "object") return base;

  // Keep valid legacy/custom lanes even when counts were not persisted.
  const keys = new Set<TrackKey>(allTrackKeys(videoCount, textCount, audioCount));
  for (const key of Object.keys(raw)) {
    if (isTrackKey(key)) keys.add(key);
  }

  for (const key of keys) {
    const value = (raw as Record<string, unknown>)[key];
    if (!value || typeof value !== "object") continue;
    const partial = value as Partial<TrackState> & { hidden?: unknown };
    base[key] = {
      muted: Boolean(partial.muted),
      solo: Boolean(partial.solo),
      locked: Boolean(partial.locked),
      // Back-compat: older projects persisted an inverted `hidden` flag.
      isVisible:
        typeof partial.isVisible === "boolean"
          ? partial.isVisible
          : partial.hidden !== true,
    };
  }
  return base;
}

/** Which visual layers are currently allowed to render. */
export type VisibleLayers = {
  /** V1 — base video clips. */
  video: boolean;
  /** V2 — text / image overlays. */
  overlays: boolean;
  /** V3 — timed effects. */
  effects: boolean;
};

/**
 * Resolves the eye + solo state of the video lanes into a single
 * "what should the canvas draw" result.
 *
 * A lane renders when it is visible **and** either no video lane is soloed or
 * this lane is one of the soloed ones (so soloing V2 isolates the overlays).
 */
export function computeVisibleLayers(states: TrackStateMap): VisibleLayers {
  const videoKeys = Object.keys(states).filter(isVideoTrackKey);
  const soloActive = videoKeys.some((key) => states[key]?.solo);
  const on = (key: TrackKey) => {
    const state = states[key];
    const visible = state?.isVisible ?? true;
    return visible && (!soloActive || Boolean(state?.solo));
  };
  return {
    video: on("V1"),
    overlays: on("V2"),
    effects: on("V3"),
  };
}

/** True when a track's content should render in preview/export. */
export function isTrackVisible(key: TrackKey, states: TrackStateMap): boolean {
  const state = states[key] ?? DEFAULT_TRACK_STATE;
  if (!state.isVisible) return false;
  if (isTextTrackKey(key)) {
    const textKeys = Object.keys(states).filter(isTextTrackKey);
    const soloActive = textKeys.some((item) => states[item]?.solo);
    return !soloActive || Boolean(state.solo);
  }
  if (isVideoTrackKey(key)) {
    const videoKeys = Object.keys(states).filter(isVideoTrackKey);
    const soloActive = videoKeys.some((item) => states[item]?.solo);
    return !soloActive || Boolean(state.solo);
  }
  return true;
}

/** True when the lane is hidden by the eye toggle or excluded by a video solo. */
export function isLaneDimmed(key: TrackKey, states: TrackStateMap): boolean {
  const state = states[key] ?? DEFAULT_TRACK_STATE;
  if (!state.isVisible) return true;
  if (!isVideoTrackKey(key)) return false;
  const videoKeys = Object.keys(states).filter(isVideoTrackKey);
  const soloActive = videoKeys.some((item) => states[item]?.solo);
  return soloActive && !state.solo;
}

/** `drawScene` visibility flags for the current track states. */
export function visibleLayerFlags(states: TrackStateMap): {
  showVideo: boolean;
  showOverlays: boolean;
  showEffects: boolean;
} {
  const layers = computeVisibleLayers(states);
  const textKeys = Object.keys(states).filter(isTextTrackKey);
  const textSoloActive = textKeys.some((key) => states[key]?.solo);
  const showOverlays =
    textKeys.length === 0
      ? layers.overlays
      : textKeys.some((key) => {
          const state = states[key] ?? DEFAULT_TRACK_STATE;
          return state.isVisible && (!textSoloActive || Boolean(state.solo));
        });
  return {
    showVideo: layers.video,
    showOverlays,
    showEffects: layers.effects,
  };
}
