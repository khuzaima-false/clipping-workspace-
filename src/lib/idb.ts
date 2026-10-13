/**
 * Minimal IndexedDB helper for the editor's local persistence.
 *
 * `idb-keyval`'s `createStore(db, store)` opens the database *without a
 * version*, so only the first object store ever created in a database is
 * usable — a second store name in the same DB silently throws `NotFoundError`.
 * Forgevyn keeps project metadata + media blobs in one database under separate
 * stores, so this helper opens with a real version and creates every store in
 * `onupgradeneeded`, guaranteeing they all exist.
 */

export type IdbStore = "project-media" | "media-blobs" | "video-sources";

const DB_NAME = "forgevyn-editor";
const STORES: IdbStore[] = ["project-media", "media-blobs", "video-sources"];

let dbPromise: Promise<IDBDatabase> | null = null;

function createMissingStores(db: IDBDatabase): void {
  for (const name of STORES) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
  }
}

/** Opens (and upgrades) the database so every store exists. */
function openRaw(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request =
      version === undefined
        ? indexedDB.open(DB_NAME)
        : indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => createMissingStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openRaw().then(async (db) => {
      const missing = STORES.some((name) => !db.objectStoreNames.contains(name));
      if (missing) {
        const version = db.version + 1;
        db.close();
        db = await openRaw(version);
      }
      db.onclose = () => {
        dbPromise = null;
      };
      return db;
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function idbGet<T>(
  store: IdbStore,
  key: IDBValidKey
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function idbSet(
  store: IdbStore,
  key: IDBValidKey,
  value: unknown
): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function idbDel(store: IdbStore, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
