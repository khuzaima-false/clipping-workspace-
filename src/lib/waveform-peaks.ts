/**
 * Web Audio helpers for the timeline waveform display.
 *
 * Peaks are plain `number[]` arrays so they survive project persistence (an
 * `AudioBuffer` cannot be structured-cloned into IndexedDB), letting the A1–A3
 * lanes draw an accurate amplitude shape immediately after a reload without
 * re-decoding the source on every render.
 */

import { getSharedAudioContext } from "@/lib/media-recovery";

/** Default peak resolution — enough detail for a wide, zoomed-in block. */
export const PEAK_BUCKETS = 512;

/**
 * Reduces an `AudioBuffer` to `buckets` normalized (0..1) amplitude peaks by
 * taking the max |sample| across all channels in each bucket.
 */
export function computeWaveformPeaks(
  buffer: AudioBuffer | null | undefined,
  buckets: number = PEAK_BUCKETS
): number[] {
  if (!buffer || buffer.length === 0 || buckets <= 0) return [];
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    channels.push(buffer.getChannelData(c));
  }
  if (channels.length === 0) return [];

  const step = buffer.length / buckets;
  const peaks: number[] = new Array(buckets);
  let loudest = 0;
  for (let i = 0; i < buckets; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.min(buffer.length, Math.max(start + 1, Math.floor((i + 1) * step)));
    let peak = 0;
    for (const data of channels) {
      for (let s = start; s < end; s += 1) {
        const value = Math.abs(data[s] ?? 0);
        if (value > peak) peak = value;
      }
    }
    peaks[i] = peak;
    if (peak > loudest) loudest = peak;
  }

  // Normalize so quiet recordings still read clearly on the timeline.
  if (loudest > 0) {
    for (let i = 0; i < peaks.length; i += 1) peaks[i] = peaks[i] / loudest;
  }
  return peaks;
}

/** Decodes a blob/file and returns its waveform peaks (best-effort). */
export async function computePeaksFromBlob(
  blob: Blob,
  buckets: number = PEAK_BUCKETS
): Promise<number[]> {
  const context = getSharedAudioContext();
  if (!context) return [];
  const raw = await blob.arrayBuffer();
  try {
    const buffer = await context.decodeAudioData(raw);
    return computeWaveformPeaks(buffer, buckets);
  } catch {
    return [];
  }
}

/** Returns a copy of `peaks` scaled into `count` buckets (linear resample). */
export function resamplePeaks(peaks: number[], count: number): number[] {
  if (peaks.length === 0) return [];
  if (count <= 0) return [];
  if (peaks.length === count) return peaks;
  const out: number[] = new Array(count);
  const step = peaks.length / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    let peak = 0;
    for (let s = start; s < end && s < peaks.length; s += 1) {
      if (peaks[s] > peak) peak = peaks[s];
    }
    out[i] = peak;
  }
  return out;
}
