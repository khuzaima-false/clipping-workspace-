/**
 * Client-side audio helpers for the multi-track audio pipeline.
 *
 * Uploaded tracks are decoded to `AudioBuffer`s once (for the UI + preview) and
 * the exporter renders the whole trimmed timeline — source video audio plus
 * every external track — into a single stereo buffer with an
 * `OfflineAudioContext`, which is then fed to WebCodecs `AudioEncoder`.
 */

/** Export/mix sample rate; AAC at 48 kHz stereo is universally supported. */
export const MIX_SAMPLE_RATE = 48000;

export type DecodedAudioFile = {
  buffer: AudioBuffer;
  duration: number;
  sampleRate: number;
};

/** Decodes an uploaded audio file (MP3/WAV/…) into a raw `AudioBuffer`. */
export async function decodeAudioFile(
  file: File
): Promise<DecodedAudioFile | null> {
  if (typeof AudioContext === "undefined") return null;
  const raw = await file.arrayBuffer();
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(raw);
    if (buffer.length === 0) return null;
    return { buffer, duration: buffer.duration, sampleRate: buffer.sampleRate };
  } finally {
    void context.close();
  }
}

/** One external track in timeline coordinates. */
export type AudioMixTrack = {
  buffer: AudioBuffer | null;
  /** Where the track begins on the master timeline (seconds). */
  startTime: number;
  /** Gain, 0..1. */
  volume: number;
  /** Offset into the source buffer (seconds). */
  trimStart: number;
  /** Playable length after `trimStart` (seconds). */
  duration: number;
};

export type MixTimelineAudioOptions = {
  /** Already-resampled source video audio, or null when the clip is silent. */
  baseBuffer: AudioBuffer | null;
  tracks: AudioMixTrack[];
  trimStart: number;
  trimEnd: number;
  sampleRate?: number;
};

/**
 * Offline-renders the export range into one stereo buffer. Returns null when
 * there is nothing to hear.
 */
export async function mixTimelineAudio(
  options: MixTimelineAudioOptions
): Promise<AudioBuffer | null> {
  const sampleRate = options.sampleRate ?? MIX_SAMPLE_RATE;
  const span = Math.max(0, options.trimEnd - options.trimStart);
  const frames = Math.max(1, Math.ceil(span * sampleRate));

  const hasBase = Boolean(options.baseBuffer);
  const hasTracks = options.tracks.some((track) => track.buffer);
  if (!hasBase && !hasTracks) return null;
  if (typeof OfflineAudioContext === "undefined") return null;

  const offline = new OfflineAudioContext(2, frames, sampleRate);

  if (options.baseBuffer) {
    const base = options.baseBuffer;
    const offset = Math.max(0, options.trimStart);
    const available = Math.max(0, base.duration - offset);
    const duration = Math.min(available, span);
    if (duration > 0) {
      const source = offline.createBufferSource();
      source.buffer = base;
      source.connect(offline.destination);
      source.start(0, offset, duration);
    }
  }

  for (const track of options.tracks) {
    if (!track.buffer) continue;
    const timelineStart = track.startTime;
    const timelineEnd = track.startTime + track.duration;
    const playStart = Math.max(timelineStart, options.trimStart);
    const playEnd = Math.min(timelineEnd, options.trimEnd);
    if (playEnd <= playStart) continue;

    const when = playStart - options.trimStart;
    const offset = track.trimStart + (playStart - timelineStart);
    const available = Math.max(0, track.buffer.duration - offset);
    const duration = Math.min(playEnd - playStart, available);
    if (duration <= 0) continue;

    const gain = offline.createGain();
    gain.gain.value = Math.min(Math.max(track.volume, 0), 1);

    const source = offline.createBufferSource();
    source.buffer = track.buffer;
    source.connect(gain).connect(offline.destination);
    source.start(when, offset, duration);
  }

  return offline.startRendering();
}
