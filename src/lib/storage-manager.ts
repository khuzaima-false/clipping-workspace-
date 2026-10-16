import { idbClear, idbDel, idbGet, idbKeys } from "@/lib/idb";

/**
 * Browser storage & cache utilities.
 *
 * Everything here is best-effort: IndexedDB can be unavailable (private mode),
 * the Storage API can be missing (older Safari) and quota can be exhausted —
 * none of which may ever crash the editor. Every entry point therefore wraps
 * its work in try/catch and returns a safe fallback.
 */

const MEDIA_STORE = "media-blobs" as const;
const PROJECT_STORE = "project-media" as const;
const VIDEO_STORE = "video-sources" as const;

/** Hard cap on how many blobs we sniff for sizes (keeps the scan snappy). */
const MAX_SCAN = 300;

export type StorageBucket = {
  id: string;
  label: string;
  hint: string;
  count: number;
  bytes: number;
  /** False for stores we only track by key count (no blob sizes). */
  sized: boolean;
};

export type StorageSnapshot = {
  /** True when `navigator.storage.estimate()` is usable. */
  supported: boolean;
  usage: number;
  quota: number;
  /** 0..100, clamped. */
  percent: number;
  /** `null` when the browser cannot report it. */
  persisted: boolean | null;
  buckets: StorageBucket[];
};

/** Human-readable byte size (1.5 MB, 812 KB, …). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${
    units[exponent]
  }`;
}

/** Sums the byte size of every blob key in a store (bounded by MAX_SCAN). */
async function measureStore(
  store: typeof MEDIA_STORE,
  max = MAX_SCAN
): Promise<{ count: number; bytes: number }> {
  let keys: IDBValidKey[] = [];
  try {
    keys = await idbKeys(store);
  } catch {
    return { count: 0, bytes: 0 };
  }
  let bytes = 0;
  for (const key of keys.slice(0, max)) {
    try {
      const value = await idbGet<Blob>(store, key);
      if (value instanceof Blob) bytes += value.size;
    } catch {
      // A single unreadable entry must not abort the whole scan.
    }
  }
  return { count: keys.length, bytes };
}

async function countKeys(store: typeof PROJECT_STORE | typeof VIDEO_STORE) {
  try {
    return (await idbKeys(store)).length;
  } catch {
    return 0;
  }
}

/** Reads the browser's storage estimate plus a breakdown of our own stores. */
export async function readStorageSnapshot(): Promise<StorageSnapshot> {
  let usage = 0;
  let quota = 0;
  let supported = false;
  let persisted: boolean | null = null;

  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage ?? 0;
      quota = estimate.quota ?? 0;
      supported = true;
    }
  } catch {
    supported = false;
  }

  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch {
    persisted = null;
  }

  const [media, projects, videos] = await Promise.all([
    measureStore(MEDIA_STORE),
    countKeys(PROJECT_STORE),
    countKeys(VIDEO_STORE),
  ]);

  const percent =
    quota > 0 ? Math.min(100, Math.max(0, (usage / quota) * 100)) : 0;

  return {
    supported,
    usage,
    quota,
    percent,
    persisted,
    buckets: [
      {
        id: "media",
        label: "Media blobs",
        hint: "Imported video & audio sources",
        count: media.count,
        bytes: media.bytes,
        sized: true,
      },
      {
        id: "projects",
        label: "Project autosaves",
        hint: "Timeline checkpoints (metadata only)",
        count: projects,
        bytes: 0,
        sized: false,
      },
      {
        id: "videos",
        label: "Source backups",
        hint: "Raw video kept for crash recovery",
        count: videos,
        bytes: 0,
        sized: false,
      },
    ],
  };
}

/**
 * Deletes every media blob that is not in `keep` (the active project's
 * mediaIds). Returns the number of entries removed.
 */
export async function clearUnusedMedia(keep: string[]): Promise<number> {
  const keepSet = new Set(keep);
  let removed = 0;
  let keys: IDBValidKey[] = [];
  try {
    keys = await idbKeys(MEDIA_STORE);
  } catch {
    return 0;
  }
  for (const key of keys) {
    if (typeof key === "string" && keepSet.has(key)) continue;
    try {
      await idbDel(MEDIA_STORE, key);
      removed += 1;
    } catch {
      // Quota/permission hiccups must never surface as a crash.
    }
  }
  return removed;
}

/** Removes every media blob (used by "Purge project blobs"). */
export async function purgeMediaBlobs(): Promise<number> {
  try {
    const keys = await idbKeys(MEDIA_STORE);
    await idbClear(MEDIA_STORE);
    return keys.length;
  } catch {
    return 0;
  }
}

/** Removes every stored project checkpoint. */
export async function purgeProjectBackups(): Promise<number> {
  try {
    const keys = await idbKeys(PROJECT_STORE);
    await idbClear(PROJECT_STORE);
    return keys.length;
  } catch {
    return 0;
  }
}
