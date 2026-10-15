/**
 * Shared track model for the multi-track timeline workspace.
 *
 * Kept dependency-free so both the editor store and the timeline UI can import
 * it without creating a cycle.
 */

/** Every lane in the timeline, top-to-bottom as they are rendered. */
export type TrackKey = "V3" | "V2" | "V1" | "A1" | "A2" | "A3";

/** The per-track header toggles (mute, solo, lock, visibility). */
export type TrackField = "muted" | "solo" | "locked" | "hidden";

export type TrackState = {
  /** Mute the lane during preview + export. */
  muted: boolean;
  /** Solo the lane (every non-soloed lane is silenced). */
  solo: boolean;
  /** Block dragging, resizing, splitting and deletion on this lane. */
  locked: boolean;
  /** Hide the lane's visuals (video lanes) during preview + export. */
  hidden: boolean;
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
  hidden: false,
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
    const partial = value as Partial<TrackState>;
    base[key] = {
      muted: Boolean(partial.muted),
      solo: Boolean(partial.solo),
      locked: Boolean(partial.locked),
      hidden: Boolean(partial.hidden),
    };
  }
  return base;
}
