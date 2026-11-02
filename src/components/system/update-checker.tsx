"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { isTauriEnvironment } from "@/lib/tauri";
import {
  runUpdateCheck,
  UPDATE_CHECK_EVENT,
  type UpdateCheckOutcome,
} from "@/lib/updater";

type Phase =
  | "idle"
  | "available"
  | "downloading"
  | "installing"
  | "error";

/**
 * Tauri auto-updater prompt.
 *
 * Mounted once in the root layout. In the desktop shell it asks GitHub Releases
 * for a signed `latest.json` on launch and shows a non-intrusive banner when a
 * newer version exists. In a web browser it renders nothing and never imports
 * the Tauri plugins.
 */
export function UpdateChecker() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauriEnvironment()) return;

    const onResult = (event: Event) => {
      const outcome = (event as CustomEvent<UpdateCheckOutcome>).detail;
      if (!outcome) return;
      if (outcome.status === "available") {
        setUpdate(outcome.update);
        setPhase("available");
        setDismissed(false);
      } else if (outcome.status === "error") {
        console.warn("[updater] check error:", outcome.error);
      } else {
        setUpdate(null);
        setPhase("idle");
      }
    };

    window.addEventListener(UPDATE_CHECK_EVENT, onResult);
    void runUpdateCheck();
    return () => {
      window.removeEventListener(UPDATE_CHECK_EVENT, onResult);
    };
  }, []);

  const install = async () => {
    if (!update || phase === "downloading" || phase === "installing") return;

    setPhase("downloading");
    setPercent(0);
    setError(null);

    try {
      let total = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setPercent(total > 0 ? 0 : null);
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            setPercent(Math.min(99, Math.round((downloaded / total) * 100)));
          }
        } else if (event.event === "Finished") {
          setPercent(100);
          setPhase("installing");
        }
      });

      try {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (relaunchError) {
        // Some NSIS installers close the app themselves before this resolves.
        console.warn("[updater] relaunch failed:", relaunchError);
        setPhase("installing");
        setError("Update installed. Please restart Forgevyn to finish.");
      }
    } catch (err) {
      console.error("[updater] install failed:", err);
      setPhase("error");
      setError(
        err instanceof Error
          ? err.message
          : "The update could not be installed. Please try again."
      );
    }
  };

  if (!update || dismissed) return null;

  const busy = phase === "downloading" || phase === "installing";

  return (
    <div
      role="region"
      aria-label="Application update"
      className="fixed bottom-4 right-4 z-[130] w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-violet-500/30 bg-zinc-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300"
        >
          <Download className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">
            Update available · v{update.version}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-400" aria-live="polite">
            An update (v{update.version}) is available. Click to download and
            restart.
          </p>
        </div>
      </div>

      {phase === "downloading" && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-[width] duration-150"
              style={{ width: `${percent ?? 8}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">
            {percent === null ? "Downloading…" : `Downloading… ${percent}%`}
          </p>
        </div>
      )}

      {phase === "installing" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Installing… Forgevyn will restart.
        </p>
      )}

      {error && <p className="mt-2 text-xs leading-5 text-red-300">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void install()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "downloading"
            ? "Downloading…"
            : phase === "installing"
              ? "Restarting…"
              : "Update Now"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={busy}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Later
        </button>
      </div>
    </div>
  );
}
