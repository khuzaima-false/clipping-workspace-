import type { AudioTrack } from "@/store/editor";

/**
 * Lightweight preview playback for external audio tracks.
 *
 * Each track is backed by a hidden `HTMLAudioElement`. The preview rAF loop
 * calls {@link AudioPreview.sync} every frame with the video clock; elements
 * are started, paused and gently re-corrected so the SFX stays in sync without
 * a full Web Audio graph.
 */

type Entry = { el: HTMLAudioElement; track: AudioTrack };

class AudioPreview {
  private entries = new Map<string, Entry>();

  sync(tracks: AudioTrack[], timelineTime: number, playing: boolean): void {
    // Drop removed tracks.
    for (const [id, entry] of this.entries) {
      if (!tracks.some((track) => track.id === id)) {
        entry.el.pause();
        entry.el.removeAttribute("src");
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
        entry = { el, track };
        this.entries.set(track.id, entry);
      } else {
        entry.track = track;
        if (entry.el.src !== track.url) entry.el.src = track.url;
      }
    }

    for (const entry of this.entries.values()) {
      const { el, track } = entry;
      const localTime = timelineTime - track.startTime + track.trimStart;
      const within =
        playing &&
        localTime >= track.trimStart &&
        localTime <= track.trimStart + track.duration + 0.05;

      el.volume = Math.min(Math.max(track.volume, 0), 1);

      if (within) {
        if (el.paused) {
          this.seek(el, localTime);
          void el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - localTime) > 0.25) {
          this.seek(el, localTime);
        }
      } else if (!el.paused) {
        el.pause();
      }
    }
  }

  /** Stops every element (used when the editor unmounts). */
  stop(): void {
    for (const entry of this.entries.values()) {
      entry.el.pause();
      entry.el.removeAttribute("src");
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
