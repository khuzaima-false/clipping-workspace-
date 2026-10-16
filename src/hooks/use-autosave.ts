"use client";

import { useEffect } from "react";
import { shallow } from "zustand/shallow";
import { useEditorStore, type SaveStatus } from "@/store/editor";

/** Quiet period after the last edit before a checkpoint is written. */
const DEBOUNCE_MS = 1200;
/** Safety-net checkpoint so nothing is ever more than a minute stale. */
const HEARTBEAT_MS = 60_000;

/**
 * Debounced IndexedDB autosave for the active project.
 *
 * The store marks `saveStatus: "unsaved"` on every tracked edit; this hook is
 * the single debounced writer, so drags/scrubs coalesce into one write and the
 * header can honestly show *Unsaved changes → Auto-saving… → All changes saved*.
 * Major actions still call `persistProject` directly for an immediate commit.
 */
export function useAutosave(): SaveStatus {
  const status = useEditorStore((s) => s.saveStatus);

  useEffect(() => {
    let timer: number | null = null;
    let flushing = false;

    const flush = () => {
      timer = null;
      const state = useEditorStore.getState();
      if (!state.projectId || state.saveStatus === "saved" || flushing) return;
      flushing = true;
      void state.checkpoint().finally(() => {
        flushing = false;
      });
    };

    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(flush, DEBOUNCE_MS);
    };

    const unsubscribe = useEditorStore.subscribe(
      (state) => ({
        sequence: state.sequence,
        overlays: state.overlays,
        audioTracks: state.audioTracks,
        assets: state.assets,
        trackStates: state.trackStates,
      }),
      schedule,
      { equalityFn: shallow }
    );

    const heartbeat = window.setInterval(flush, HEARTBEAT_MS);

    // Best-effort final checkpoint when the tab is hidden or closed.
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        const state = useEditorStore.getState();
        if (state.projectId && state.saveStatus !== "saved") {
          void state.checkpoint();
        }
      }
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      unsubscribe();
      window.clearInterval(heartbeat);
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return status;
}
