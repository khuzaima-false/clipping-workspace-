/**
 * Shared track model for the multi-track timeline workspace.
 *
 * Kept dependency-free so both the editor store and the timeline UI can import
 * it without creating a cycle.
 */

/** Every lane in the timeline, top-to-bottom as they are rendered. */
export type TrackKey = "V3" | "V2" | "V1" | "A1" | "A2" | "A3";

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

/** Video lanes, bottom-up internally (V1 is the base layer). */
export const VIDEO_TRACK_KEYS = ["V3", "V2", "V1"] as const;

/** Audio lanes in display order. */
export const AUDIO_TRACK_KEYS: TrackKey[] = ["A1", "A2", "A3"];

/** All lanes, in the order they are rendered (top to bottom). */
export const TRACK_KEYS: TrackKey[] = [
  "V3",
  "V2",
  "V1",
  "A1",
  "A2",
  "A3",
];

export const DEFAULT_TRACK_STATE: TrackState = {
  muted: false,
  solo: false,
  locked: false,
  isVisible: true,
};

/** A fresh, fully-unlocked set of track states. */
export function defaultTrackStates(): Record<TrackKey, TrackState> {
  return {
    V3: { ...DEFAULT_TRACK_STATE },
    V2: { ...DEFAULT_TRACK_STATE },
    V1: { ...DEFAULT_TRACK_STATE },
    A1: { ...DEFAULT_TRACK_STATE },
    A2: { ...DEFAULT_TRACK_STATE },
    A3: { ...DEFAULT_TRACK_STATE },
  };
}

export function isTrackKey(value: unknown): value is TrackKey {
  return typeof value === "string" && (TRACK_KEYS as string[]).includes(value);
}

/** Maps a zero-based audio lane index to its track key (A1, A2, A3). */
export function laneKeyFor(lane: number): TrackKey {
  return AUDIO_TRACK_KEYS[lane] ?? AUDIO_TRACK_KEYS[0];
}

/** Zero-based lane index for an audio track key. */
export function laneIndexOf(key: TrackKey): number {
  const index = AUDIO_TRACK_KEYS.indexOf(key);
  return index < 0 ? 0 : index;
}

/** Merges a persisted/partial track-state map with the defaults. */
export function normalizeTrackStates(
  raw: unknown
): Record<TrackKey, TrackState> {
  const base = defaultTrackStates();
  if (!raw || typeof raw !== "object") return base;
  for (const key of TRACK_KEYS) {
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
 * Resolves the eye + solo state of the three video lanes into a single
 * "what should the canvas draw" result.
 *
 * A lane renders when it is visible **and** either no video lane is soloed or
 * this lane is one of the soloed ones (so soloing V2 isolates the overlays).
 */
export function computeVisibleLayers(
  states: Record<TrackKey, TrackState>
): VisibleLayers {
  const soloActive = VIDEO_TRACK_KEYS.some((key) => states[key]?.solo);
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

/** True when the lane is hidden by the eye toggle or excluded by a video solo. */
export function isLaneDimmed(
  key: TrackKey,
  states: Record<TrackKey, TrackState>
): boolean {
  const state = states[key] ?? DEFAULT_TRACK_STATE;
  if (!state.isVisible) return true;
  const isVideo = (VIDEO_TRACK_KEYS as readonly string[]).includes(key);
  if (!isVideo) return false;
  const soloActive = VIDEO_TRACK_KEYS.some((item) => states[item]?.solo);
  return soloActive && !state.solo;
}

/** `drawScene` visibility flags for the current track states. */
export function visibleLayerFlags(states: Record<TrackKey, TrackState>): {
  showVideo: boolean;
  showOverlays: boolean;
  showEffects: boolean;
} {
  const layers = computeVisibleLayers(states);
  return {
    showVideo: layers.video,
    showOverlays: layers.overlays,
    showEffects: layers.effects,
  };
}

