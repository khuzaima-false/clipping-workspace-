"use client";

import { useCallback, useState } from "react";
import {
  Database,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  clearUnusedMedia,
  formatBytes,
  purgeMediaBlobs,
  purgeProjectBackups,
  readStorageSnapshot,
  type StorageSnapshot,
} from "@/lib/storage-manager";
import { useEditorStore } from "@/store/editor";

type Busy = null | "refresh" | "unused" | "blobs" | "backups";

/**
 * Browser storage & cache utility.
 *
 * Reports the Storage API estimate plus a breakdown of Forgevyn's IndexedDB
 * stores, and offers safe cleanup actions. Every destructive call is wrapped in
 * try/catch inside `lib/storage-manager`, so a quota or permission error can
 * never bubble up as an unhandled rejection.
 */
export function StorageManager({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);

  const assets = useEditorStore((s) => s.assets);
  const audioTracks = useEditorStore((s) => s.audioTracks);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      setSnapshot(await readStorageSnapshot());
    } catch {
      setNote("Could not read storage usage in this browser.");
    } finally {
      setBusy(null);
    }
  }, []);

  const openManager = () => {
    setNote(null);
    setOpen(true);
    // Kick the first scan from the event handler (not from an effect).
    void refresh();
  };

  /** mediaIds that belong to the currently open project. */
  const activeMediaIds = useCallback(
    () => [
      ...assets.map((asset) => asset.mediaId),
      ...audioTracks.map((track) => track.mediaId),
    ],
    [assets, audioTracks]
  );

  const runClearUnused = async () => {
    setBusy("unused");
    setNote(null);
    try {
      const removed = await clearUnusedMedia(activeMediaIds());
      setNote(
        removed === 0
          ? "Nothing to clean up — every cached blob is still in use."
          : `Removed ${removed} unused cache ${removed === 1 ? "entry" : "entries"}.`
      );
      await refresh();
    } catch {
      setNote("Cleanup failed — your browser blocked the deletion.");
    } finally {
      setBusy(null);
    }
  };

  const runPurgeBlobs = async () => {
    setBusy("blobs");
    setNote(null);
    try {
      const removed = await purgeMediaBlobs();
      setNote(
        `Purged ${removed} media ${removed === 1 ? "blob" : "blobs"}. Re-import your clips to edit them again.`
      );
      await refresh();
    } catch {
      setNote("Purge failed — the media cache could not be cleared.");
    } finally {
      setBusy(null);
    }
  };

  const runPurgeBackups = async () => {
    setBusy("backups");
    setNote(null);
    try {
      const removed = await purgeProjectBackups();
      setNote(
        `Deleted ${removed} project ${removed === 1 ? "checkpoint" : "checkpoints"}.`
      );
      await refresh();
    } catch {
      setNote("Could not delete the project checkpoints.");
    } finally {
      setBusy(null);
    }
  };

  const percent = Math.round(snapshot?.percent ?? 0);
  const barTone =
    percent > 85 ? "bg-red-500" : percent > 60 ? "bg-amber-400" : "bg-violet-500";

  return (
    <>
      <button
        type="button"
        onClick={openManager}
        data-tour="storage-button"
        title="Storage & cache"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100",
          className
        )}
      >
        <HardDrive className="h-3.5 w-3.5" aria-hidden />
        Storage
      </button>

      <Modal
        open={open}
        title="Storage & cache"
        onClose={() => setOpen(false)}
        className="max-w-xl"
      >
        <div className="space-y-4 text-sm">
          {/* Usage summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <Database className="h-3.5 w-3.5 text-violet-300" aria-hidden />
                Browser storage
              </span>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={busy === "refresh"}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-3 w-3", busy === "refresh" && "animate-spin")}
                  aria-hidden
                />
                Refresh
              </button>
            </div>

            {snapshot?.supported ? (
              <>
                <p className="mt-2 text-xs tabular-nums text-zinc-400">
                  {formatBytes(snapshot.usage)} used of{" "}
                  {formatBytes(snapshot.quota)} ({percent}%)
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn("h-full rounded-full transition-[width]", barTone)}
                    style={{ width: `${Math.max(1, percent)}%` }}
                  />
                </div>
                {snapshot.persisted !== null && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <ShieldCheck
                      className={cn(
                        "h-3 w-3",
                        snapshot.persisted ? "text-emerald-400" : "text-zinc-600"
                      )}
                      aria-hidden
                    />
                    {snapshot.persisted
                      ? "Storage is persistent — the browser won't evict your work."
                      : "Storage is best-effort; the browser may clear it under pressure."}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                This browser can&apos;t report a storage estimate.
              </p>
            )}
          </div>

          {/* Buckets */}
          <ul className="space-y-1.5">
            {(snapshot?.buckets ?? []).map((bucket) => (
              <li
                key={bucket.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {bucket.label}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">{bucket.hint}</p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                  {bucket.count} {bucket.count === 1 ? "item" : "items"}
                  {bucket.sized && bucket.bytes > 0
                    ? ` · ${formatBytes(bucket.bytes)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => void runClearUnused()}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] font-medium text-zinc-200 transition-colors hover:border-violet-500/50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear unused cache
            </button>
            <button
              type="button"
              onClick={() => void runPurgeBlobs()}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-[11px] font-medium text-red-200 transition-colors hover:border-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Purge project blobs
            </button>
            <button
              type="button"
              onClick={() => void runPurgeBackups()}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-[11px] font-medium text-red-200 transition-colors hover:border-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete checkpoints
            </button>
          </div>

          {note && (
            <p
              role="status"
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] leading-5 text-zinc-400"
            >
              {note}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
