import type { AudioTrack } from "@/store/editor";

/**
 * Lightweight preview playback for external audio tracks.
 *
 * Each track is backed by a hidden `HTMLAudioElement`. The preview rAF loop
 * calls {@link AudioPreview.sync} every frame with the video clock; elements
 * are started, paused and gently re-corrected so the SFX stays in sync without
 * a full Web Audio graph.
 *
 * Browsers can pause these elements (or drop their buffered source) when a tab
 * is backgrounded. If an element reports an `error` we transparently rebuild
 * its source from the retained `track.file` blob — no IndexedDB round-trip and
 * no unhandled promise rejection.
 */

type Entry = {
  el: HTMLAudioElement;
  track: AudioTrack;
  /** The object URL currently mirrored onto the element. */
  sourceUrl: string;
  /** Re-created object URL after an error (revoked on cleanup). */
  recoveredUrl: string | null;
  /** Recovery attempts, to avoid an infinite error → rebind loop. */
  recoveries: number;
  /** A play request is in flight; do not repeatedly seek/restart it per frame. */
  playRequest: Promise<void> | null;
};

const MAX_RECOVERIES = 2;

class AudioPreview {
  private entries = new Map<string, Entry>();

  sync(tracks: AudioTrack[], timelineTime: number, playing: boolean): void {
    // Drop removed tracks.
    for (const [id, entry] of this.entries) {
      if (!tracks.some((track) => track.id === id)) {
        entry.el.pause();
        entry.el.removeAttribute("src");
        if (entry.recoveredUrl) URL.revokeObjectURL(entry.recoveredUrl);
        this.entries.delete(id);
      }
    }

    // Create/update elements.
    for (const track of tracks) {
      let entry = this.entries.get(track.id);
      if (!entry) {
        const el = new Audio();
        el.preload = "auto";
        el.src = track.url;
        entry = {
          el,
          track,
          sourceUrl: track.url,
          recoveredUrl: null,
          recoveries: 0,
          playRequest: null,
        };
        // These elements use the browser's normal media output, rather than a
        // Web Audio graph. Keep them explicitly unmuted; routing decisions are
        // represented by pausing an inactive track and setting its volume.
        el.muted = false;
        el.addEventListener("error", () => this.recover(track.id));
        this.entries.set(track.id, entry);
      } else {
        entry.track = track;
        // Re-bind only when the track's own URL actually changed (a recovered
        // URL must not be clobbered on every frame).
        if (!entry.recoveredUrl && entry.sourceUrl !== track.url) {
          entry.sourceUrl = track.url;
          entry.el.src = track.url;
        }
      }
    }

    const soloActive = tracks.some((track) => track.solo && !track.muted);

    for (const entry of this.entries.values()) {
      const { el, track } = entry;
      const localTime = timelineTime - track.startTime + track.trimStart;
      const within =
        playing &&
        localTime >= track.trimStart &&
        localTime <= track.trimStart + track.duration + 0.05;

      const audible = within && !track.muted && (!soloActive || track.solo);
      el.volume = Math.min(Math.max(track.volume, 0), 1) * this.fadeGain(track, localTime);

      if (audible) {
        if (el.muted) el.muted = false;
        if (el.paused && !entry.playRequest) {
          this.seek(el, localTime);
          const request = el
            .play()
            .catch(() => {
              // A policy rejection can be retried on the next user-triggered
              // play; avoid a per-frame retry loop after the gesture expires.
            })
          entry.playRequest = request;
          void request.finally(() => {
            if (entry.playRequest === request) entry.playRequest = null;
          });
        } else if (!el.paused && Math.abs(el.currentTime - localTime) > 0.25) {
          this.seek(el, localTime);
        }
      } else if (!el.paused) {
        el.pause();
        entry.playRequest = null;
      }
    }
  }

  /** Rebuilds a broken element from the retained source blob. */
  private recover(id: string): void {
    const entry = this.entries.get(id);
    if (!entry || entry.recoveries >= MAX_RECOVERIES) return;
    entry.recoveries += 1;
    try {
      if (entry.recoveredUrl) URL.revokeObjectURL(entry.recoveredUrl);
      const url = URL.createObjectURL(entry.track.file);
      entry.recoveredUrl = url;
      entry.sourceUrl = url;
      entry.el.src = url;
      entry.el.load();
    } catch {
      // The blob is gone; only a fresh import can fix it.
    }
  }

  /** Applies the track's fade-in/out envelope for a given local time. */
  private fadeGain(track: AudioTrack, localTime: number): number {
    const elapsed = localTime - track.trimStart;
    let gain = 1;
    if (track.fadeIn > 0) gain *= Math.min(1, Math.max(0, elapsed / track.fadeIn));
    if (track.fadeOut > 0) {
      gain *= Math.min(1, Math.max(0, (track.duration - elapsed) / track.fadeOut));
    }
    return gain;
  }

  /** Stops every element (used when the editor unmounts). */
  stop(): void {
    for (const entry of this.entries.values()) {
      entry.el.pause();
      entry.el.removeAttribute("src");
      if (entry.recoveredUrl) URL.revokeObjectURL(entry.recoveredUrl);
    }
    this.entries.clear();
  }

  private seek(el: HTMLAudioElement, time: number): void {
    try {
      el.currentTime = Math.max(0, time);
    } catch {
      // Metadata not ready yet; the next frame will retry.
    }
  }
}

export const audioPreview = new AudioPreview();
