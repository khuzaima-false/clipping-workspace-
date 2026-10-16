"use client";

/**
 * Browser-throttling recovery for media playback.
 *
 * Background tabs get their `requestAnimationFrame` loop throttled and their
 * `AudioContext` suspended, and the browser may pause an `<audio>`/`<video>`
 * element or drop its buffered source. This module:
 *
 * - owns a single long-lived `AudioContext` shared by every decode helper,
 * - re-`resume()`s any non-running context when the tab/window comes back,
 * - lets the program monitor subscribe to a "restore" signal so it can
 *   re-sync its media elements and force an immediate canvas repaint.
 *
 * Every API is safe to call during SSR / static export (they no-op without a
 * `window`) and `installMediaRecovery()` is idempotent.
 */

type AudioContextCtor = new () => AudioContext;

type RestoreHandler = () => void;

const contexts = new Set<AudioContext>();
const handlers = new Set<RestoreHandler>();
let sharedContext: AudioContext | null = null;
let installed = false;

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const target = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return target.AudioContext ?? target.webkitAudioContext ?? null;
}

/**
 * The one AudioContext reused for decoding / peak extraction. Kept alive so a
 * suspended context can be resumed instead of recreated on every import.
 */
export function getSharedAudioContext(): AudioContext | null {
  if (sharedContext && sharedContext.state !== "closed") return sharedContext;
  const Ctor = resolveAudioContextCtor();
  if (!Ctor) return null;
  try {
    sharedContext = new Ctor();
    contexts.add(sharedContext);
  } catch {
    sharedContext = null;
  }
  return sharedContext;
}

/** Resumes every tracked context that isn't running (suspended / interrupted). */
export function resumeAudioContexts(): void {
  for (const context of contexts) {
    if (context.state === "running" || context.state === "closed") continue;
    try {
      void context.resume().catch(() => {
        // Autoplay policy can reject until the next user gesture.
      });
    } catch {
      // Older Safari throws synchronously when resuming without a gesture.
    }
  }
}

/** Creates (when needed) and resumes the shared context during a user gesture. */
export function unlockAudio(): void {
  getSharedAudioContext();
  resumeAudioContexts();
}

/** Registers a callback fired whenever the tab/window is restored. */
export function onMediaRestore(handler: RestoreHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Resumes audio and notifies every subscriber (also used by tests). */
export function notifyMediaRestore(): void {
  resumeAudioContexts();
  for (const handler of handlers) {
    try {
      handler();
    } catch {
      // One bad subscriber must not stop the others from recovering.
    }
  }
}

/**
 * Wires the global listeners exactly once: tab visibility, window focus,
 * bfcache restore, and the first user gesture (which unlocks Web Audio under
 * the autoplay policy).
 */
export function installMediaRecovery(): void {
  if (installed || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  installed = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") notifyMediaRestore();
  });

  window.addEventListener("focus", () => notifyMediaRestore());
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) notifyMediaRestore();
  });

  const unlock = () => {
    resumeAudioContexts();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}
