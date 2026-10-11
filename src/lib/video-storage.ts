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
