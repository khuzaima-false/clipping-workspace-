"use client";

import { getSharedAudioContext, resumeAudioContexts } from "@/lib/media-recovery";

/**
 * Routes `<video>` / `<audio>` element audio through the Web Audio graph.
 *
 * Preview videos are created in JS and only used as a `drawImage()` source, so
 * their sound is easily lost. Connecting the element to a
 * `MediaElementAudioSourceNode` → `GainNode` → `AudioContext.destination` makes
 * playback explicit and lets us control level/mute *without* setting
 * `element.muted = true` (which would silence the graph input too).
 *
 * Safety rules:
 * - A `MediaElementAudioSourceNode` can only be created **once per element**,
 *   so routing is memoised in a `WeakMap`.
 * - A *suspended* `AudioContext` would swallow the audio, so we only route once
 *   the context is actually running; until then the caller keeps the element on
 *   its native output path.
 */

type RoutedEntry = { gain: GainNode };

const routed = new WeakMap<HTMLMediaElement, RoutedEntry>();

/** True when the element's audio already flows through the Web Audio graph. */
export function isElementAudioRouted(el: HTMLMediaElement): boolean {
  return routed.has(el);
}

/**
 * Ensures `el` is routed into the shared AudioContext at `gainValue`.
 * Returns `false` when routing isn't possible yet (no context / suspended /
 * already-owned elsewhere) so the caller can fall back to native output.
 */
export function routeElementAudio(el: HTMLMediaElement, gainValue: number): boolean {
  const target = Math.min(1, Math.max(0, gainValue));

  const existing = routed.get(el);
  if (existing) {
    if (existing.gain.gain.value !== target) existing.gain.gain.value = target;
    // The element must stay unmuted/unattenuated or the graph receives silence.
    if (el.muted) el.muted = false;
    if (el.volume !== 1) el.volume = 1;
    return true;
  }

  const context = getSharedAudioContext();
  if (!context || context.state === "closed") return false;
  if (context.state !== "running") {
    // The autoplay policy unlocks the context on the first gesture.
    resumeAudioContexts();
    return false;
  }

  try {
    const source = context.createMediaElementSource(el);
    const gain = context.createGain();
    gain.gain.value = target;
    source.connect(gain);
    gain.connect(context.destination);
    routed.set(el, { gain });
    el.muted = false;
    el.volume = 1;
    return true;
  } catch {
    // Element already owned by another graph node — keep native playback.
    return false;
  }
}

/**
 * Applies the desired output state to a media element, preferring Web Audio
 * routing and transparently falling back to `muted` / `volume`.
 */
export function applyElementAudio(
  el: HTMLMediaElement,
  muted: boolean,
  volume: number
): void {
  const level = Math.min(1, Math.max(0, volume));
  if (routeElementAudio(el, muted ? 0 : level)) return;
  el.muted = muted;
  el.volume = level;
}
