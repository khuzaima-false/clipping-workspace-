import { idbDel, idbGet, idbSet } from "@/lib/idb";

/**
 * Locally-persisted source videos, keyed by project id.
 *
 * The raw video bytes are far too large (and too binary) for `localStorage` or
 * Supabase, so they live in IndexedDB. This keeps a project's source video on
 * the device across reloads and tab closes without shipping it anywhere.
 */
const keyFor = (projectId: string) => `project:${projectId}`;

export type StoredVideoSource = {
  blob: Blob;
  name: string;
  type: string;
  size: number;
  updatedAt: number;
};

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Persists the raw bytes of a source video for `projectId`. */
export async function saveVideoSource(
  projectId: string,
  blob: Blob,
  name: string
): Promise<void> {
  if (!projectId || !idbAvailable()) return;
  const record: StoredVideoSource = {
    blob,
    name,
    type: blob.type || "video/mp4",
    size: blob.size,
    updatedAt: Date.now(),
  };
  await idbSet("video-sources", keyFor(projectId), record);
}

/** Reads the stored source video for `projectId`, or `null` if absent. */
export async function loadVideoSource(
  projectId: string
): Promise<StoredVideoSource | null> {
  if (!projectId || !idbAvailable()) return null;
  const value = await idbGet<StoredVideoSource>("video-sources", keyFor(projectId));
  if (!value || !(value.blob instanceof Blob)) return null;
  return value;
}

/** Removes the stored source video for `projectId`. */
export async function deleteVideoSource(projectId: string): Promise<void> {
  if (!projectId || !idbAvailable()) return;
  await idbDel("video-sources", keyFor(projectId));
}

/* -------------------------------------------------------------------------- */
/* Multi-clip media library (metadata only; blobs live in `media-storage`)      */
/* -------------------------------------------------------------------------- */

const mediaKeyFor = (projectId: string) => `media:${projectId}`;

/** Persisted metadata for one uploaded asset (binary lives under `mediaId`). */
export type StoredAssetMeta = {
  id: string;
  mediaId: string;
  name: string;
  type: string;
  size: number;
  updatedAt: number;
};

/** In-memory asset: metadata + its decoded Blob. */
export type VideoAsset = StoredAssetMeta & { blob: Blob };

/** Cross-clip transition applied at the START of a clip (from the previous). */
export type TransitionType =
  | "crossDissolve"
  | "dipToBlack"
  | "whipPan"
  | "glitchCut"
  | "zoomIn"
  | "zoomBlur";

/** One clip placed on the timeline sequence, referencing a library asset. */
export type TimelineClip = {
  id: string;
  assetId: string;
  /** Seconds trimmed from the start of the source (in-point). */
  trimStart: number;
  /** Seconds trimmed to the end of the source (out-point). */
  trimEnd: number;
  /** Video lane key (V1, V2, V3, …). Defaults to V1 for legacy projects. */
  track?: string;
  /**
   * Absolute position (seconds) on the master timeline. When omitted the clip
   * simply flows after the previous clip, so existing projects keep their
   * sequential layout.
   */
  timelineStart?: number;
  /**
   * Per-clip chroma-key (green/blue screen) settings. Kept structurally typed
   * here to avoid importing the store type (and its cycle).
   */
  chromaKey?: {
    enabled: boolean;
    color: string;
    tolerance: number;
    feather: number;
  };
  /** Transition blended into this clip from the previous one. */
  transitionIn?: {
    type: TransitionType;
    /** Overlap length in seconds. */
    duration: number;
  };
  /** Velocity-curve preset for this clip (mirrors the editor's speed state). */
  speedPreset?: string;
  /** Per-clip velocity keyframes (seconds → speed multiplier). */
  speedPoints?: { time: number; speed: number }[];
  /**
   * Base transform for the clip's video frame: `x`/`y` are percentage offsets
   * from centre, `scale` is a multiplier and `rotation` is in degrees.
   */
  transform?: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity?: number;
  };
  /** Animated transform keyframes, timed in source seconds. */
  transformKeyframes?: {
    id: string;
    time: number;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity?: number;
  }[];
};

/** Persisted metadata for one audio track (binary lives under `mediaId`). */
export type StoredAudio = {
  id: string;
  mediaId: string;
  name: string;
  startTime: number;
  volume: number;
  trimStart: number;
  duration: number;
  muted?: boolean;
  solo?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  synth?: boolean;
  /** Zero-based audio lane (A1 = 0, A2 = 1, A3 = 2). */
  lane?: number;
  /** Pre-computed normalized waveform peaks (see `waveform-peaks.ts`). */
  peaks?: number[];
};

export type ProjectMedia = {
  assets: StoredAssetMeta[];
  /** Ordered clips that make up the exported sequence. */
  sequence: TimelineClip[];
  /** Text/image overlays (typed loosely to avoid a store import cycle). */
  overlays: unknown[];
  /** Audio track metadata. */
  audio: StoredAudio[];
  /** Per-lane mute/solo/lock/hide state (loosely typed, see `lib/tracks`). */
  trackStates?: Record<string, unknown>;
  /** Number of video lanes in the project (defaults to 3). */
  videoTrackCount?: number;
  /** Number of audio lanes in the project (defaults to 3). */
  audioTrackCount?: number;
  /** Playhead position (seconds) at the moment of the checkpoint. */
  currentTime?: number;
  /** Epoch ms of the last successful checkpoint. */
  savedAt?: number;
};

const EMPTY_MEDIA: ProjectMedia = {
  assets: [],
  sequence: [],
  overlays: [],
  audio: [],
};

/** Reads a project's persisted media metadata (empty when none). */
export async function loadProjectMedia(
  projectId: string
): Promise<ProjectMedia> {
  if (!projectId || !idbAvailable()) return EMPTY_MEDIA;
  const value = await idbGet<Partial<ProjectMedia>>(
    "project-media",
    mediaKeyFor(projectId)
  );
  if (!value) return EMPTY_MEDIA;
  return {
    assets: Array.isArray(value.assets) ? value.assets : [],
    sequence: Array.isArray(value.sequence) ? value.sequence : [],
    overlays: Array.isArray(value.overlays) ? value.overlays : [],
    audio: Array.isArray(value.audio) ? value.audio : [],
    // Previously dropped: the lane lock/visibility state and the playhead.
    trackStates:
      value.trackStates && typeof value.trackStates === "object"
        ? value.trackStates
        : undefined,
    videoTrackCount:
      typeof value.videoTrackCount === "number" &&
      Number.isFinite(value.videoTrackCount)
        ? Math.max(1, Math.round(value.videoTrackCount))
        : undefined,
    audioTrackCount:
      typeof value.audioTrackCount === "number" &&
      Number.isFinite(value.audioTrackCount)
        ? Math.max(1, Math.round(value.audioTrackCount))
        : undefined,
    currentTime:
      typeof value.currentTime === "number" && Number.isFinite(value.currentTime)
        ? Math.max(0, value.currentTime)
        : undefined,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : undefined,
  };
}

/** Persists a project's media metadata + timeline sequence. */
export async function saveProjectMedia(
  projectId: string,
  media: ProjectMedia
): Promise<void> {
  if (!projectId || !idbAvailable()) return;
  await idbSet("project-media", mediaKeyFor(projectId), media);
}
