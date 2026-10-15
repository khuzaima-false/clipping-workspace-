"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type ExportRun = {
  status: "running" | "done" | "error";
  /** Progress line, e.g. "Rendering Frame 120 / 600 - 20%". */
  label: string;
  percent: number;
  error?: string;
  fileName?: string;
  fileSize?: number;
  usedFallback?: boolean;
  controller: AbortController;
};

type ExportDialogProps = {
  run: ExportRun | null;
  onClose: () => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportDialog({ run, onClose }: ExportDialogProps) {
  const status = run?.status ?? null;
  const controller = run?.controller;

  useEffect(() => {
    if (status === null || !controller) return;

    const ctrl = controller;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (status === "running") ctrl.abort();
      else onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [status, controller, onClose]);

  if (!run) return null;

  const running = run.status === "running";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export 1080p video"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {run.status === "done" && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
              </span>
            )}
            {run.status === "error" && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                <AlertCircle className="h-4.5 w-4.5" aria-hidden />
              </span>
            )}
            <h2 className="text-sm font-semibold text-zinc-100">
              {running
                ? "Exporting 1080p Video"
                : run.status === "done"
                  ? "Export Complete"
                  : "Export Failed"}
            </h2>
          </div>
          {!running && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close export dialog"
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {running && (
          <div className="mt-4">
            <p
              aria-live="polite"
              className="text-sm tabular-nums text-zinc-300"
            >
              {run.label}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-violet-500 transition-[width] duration-200"
                style={{ width: `${run.percent}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] leading-4 text-zinc-500">
              Encoding happens entirely in your browser. Keep this tab in the
              foreground until it finishes.
            </p>
          </div>
        )}

        {run.status === "done" && (
          <div className="mt-4 space-y-1">
            <p className="text-sm text-zinc-200">
              <span className="break-all font-medium">{run.fileName}</span>
              {typeof run.fileSize === "number" && (
                <span className="text-zinc-500"> · {formatBytes(run.fileSize)}</span>
              )}
            </p>
            <p className="text-xs text-zinc-500">
              The download should start automatically. If it didn&apos;t, check
              your browser&apos;s download permissions.
            </p>
            {run.usedFallback && (
              <p className="text-xs text-amber-400/90">
                Recorded with the real-time fallback encoder because WebCodecs
                is not available in this browser.
              </p>
            )}
          </div>
        )}

        {run.status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs leading-5 text-red-300"
          >
            {run.error ?? "Something went wrong during the export."}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {running ? (
            <button
              type="button"
              onClick={() => controller?.abort()}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              Cancel export
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
