import { idbDel, idbGet, idbSet } from "@/lib/idb";

/**
 * Persistent local media storage, keyed by a stable `mediaId`.
 *
 * Raw binary File/Blob data lives here (IndexedDB), never in `localStorage` or
 * Supabase, so imported videos/audio survive page refreshes and tab closes.
 */
const STORE = "media-blobs" as const;

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
  await idbSet(STORE, id, file);
}

/** Reads the raw File/Blob for `id`, or `null` when absent. */
export async function getMediaFile(id: string): Promise<Blob | null> {
  if (!id || !idbAvailable()) return null;
  try {
    const value = await idbGet<Blob>(STORE, id);
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

/** Removes the stored media for `id`. */
export async function deleteMediaFile(id: string): Promise<void> {
  if (!id || !idbAvailable()) return;
  try {
    await idbDel(STORE, id);
  } catch {
    // Best-effort cleanup.
  }
}
