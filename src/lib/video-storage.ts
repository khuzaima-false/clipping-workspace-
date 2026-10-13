import { createStore, del, get, set } from "idb-keyval";

/**
 * Locally-persisted source videos, keyed by project id.
 *
 * The raw video bytes are far too large (and too binary) for `localStorage` or
 * Supabase, so they live in IndexedDB. This keeps a project's source video on
 * the device across reloads and tab closes without shipping it anywhere.
 */
const store = createStore("forgevyn-editor", "video-sources");

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
  await set(keyFor(projectId), record, store);
}

/** Reads the stored source video for `projectId`, or `null` if absent. */
export async function loadVideoSource(
  projectId: string
): Promise<StoredVideoSource | null> {
  if (!projectId || !idbAvailable()) return null;
  const value = await get<StoredVideoSource>(keyFor(projectId), store);
  if (!value || !(value.blob instanceof Blob)) return null;
  return value;
}

/** Removes the stored source video for `projectId`. */
export async function deleteVideoSource(projectId: string): Promise<void> {
  if (!projectId || !idbAvailable()) return;
  await del(keyFor(projectId), store);
}

/* -------------------------------------------------------------------------- */
/* Multi-clip media library (metadata only; blobs live in `media-storage`)      */
/* -------------------------------------------------------------------------- */

const mediaStore = createStore("forgevyn-editor", "project-media");
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

/** One clip placed on the timeline sequence, referencing a library asset. */
export type TimelineClip = {
  id: string;
  assetId: string;
  /** Seconds trimmed from the start of the source. */
  trimStart: number;
  /** Seconds trimmed to the end of the source. */
  trimEnd: number;
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
};

export type ProjectMedia = {
  assets: StoredAssetMeta[];
  /** Ordered clips that make up the exported sequence. */
  sequence: TimelineClip[];
  /** Text/image overlays (typed loosely to avoid a store import cycle). */
  overlays: unknown[];
  /** Audio track metadata. */
  audio: StoredAudio[];
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
  const value = await get<Partial<ProjectMedia>>(mediaKeyFor(projectId), mediaStore);
  if (!value) return EMPTY_MEDIA;
  return {
    assets: Array.isArray(value.assets) ? value.assets : [],
    sequence: Array.isArray(value.sequence) ? value.sequence : [],
    overlays: Array.isArray(value.overlays) ? value.overlays : [],
    audio: Array.isArray(value.audio) ? value.audio : [],
  };
}

/** Persists a project's media metadata + timeline sequence. */
export async function saveProjectMedia(
  projectId: string,
  media: ProjectMedia
): Promise<void> {
  if (!projectId || !idbAvailable()) return;
  await set(mediaKeyFor(projectId), media, mediaStore);
}
