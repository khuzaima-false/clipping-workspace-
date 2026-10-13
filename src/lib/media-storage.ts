import { createStore, del, get, set } from "idb-keyval";

/**
 * Persistent local media storage, keyed by a stable `mediaId`.
 *
 * Raw binary File/Blob data lives here (IndexedDB), never in `localStorage` or
 * Supabase, so imported videos/audio survive page refreshes and tab closes.
 */
const mediaStore = createStore("forgevyn-editor", "media-blobs");

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Generates a stable, collision-resistant media id. */
export function newMediaId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Persists a raw File/Blob under `id`. */
export async function saveMediaFile(id: string, file: Blob): Promise<void> {
  if (!id || !idbAvailable()) return;
  await set(id, file, mediaStore);
}

/** Reads the raw File/Blob for `id`, or `null` when absent. */
export async function getMediaFile(id: string): Promise<Blob | null> {
  if (!id || !idbAvailable()) return null;
  const value = await get<Blob>(id, mediaStore);
  return value instanceof Blob ? value : null;
}

/** Removes the stored media for `id`. */
export async function deleteMediaFile(id: string): Promise<void> {
  if (!id || !idbAvailable()) return;
  await del(id, mediaStore);
}
