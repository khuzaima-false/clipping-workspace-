/**
 * Royalty-free sound effects, synthesized 100% client-side with the Web Audio
 * API. No assets are downloaded and nothing touches a server — each effect is
 * rendered offline into an `AudioBuffer` (for the mixer / export) and encoded
 * to a small WAV blob (for `HTMLAudioElement` preview playback).
 */

export type SoundEffectId =
  | "whoosh"
  | "pop"
  | "shutter"
  | "glitch"
  | "riser"
  | "bell"
  | "applause";

export const SOUND_EFFECTS: {
  id: SoundEffectId;
  label: string;
  duration: number;
}[] = [
  { id: "whoosh", label: "Whoosh", duration: 0.7 },
  { id: "pop", label: "Pop", duration: 0.22 },
  { id: "shutter", label: "Camera Shutter", duration: 0.35 },
  { id: "glitch", label: "Glitch", duration: 0.5 },
  { id: "riser", label: "Cinematic Riser", duration: 1.6 },
  { id: "bell", label: "Bell", duration: 1.4 },
  { id: "applause", label: "Applause", duration: 1.8 },
];

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.ceil(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playNoise(
  ctx: BaseAudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  frequency: number,
  q = 1
): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(1, start + Math.min(0.01, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function playTone(
  ctx: BaseAudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  fromHz: number,
  toHz: number,
  type: OscillatorType,
  peak = 0.7
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function buildSoundEffect(ctx: OfflineAudioContext, id: SoundEffectId): void {
  const out = ctx.destination;
  const now = 0;

  switch (id) {
    case "pop":
      playTone(ctx, out, now, 0.16, 520, 1100, "sine", 0.9);
      playTone(ctx, out, now, 0.1, 260, 90, "triangle", 0.5);
      break;

    case "bell":
      for (const [freq, peak] of [
        [1046, 0.5],
        [1568, 0.35],
        [2093, 0.22],
      ] as const) {
        playTone(ctx, out, now, 1.3, freq, freq * 0.98, "sine", peak);
      }
      break;

    case "whoosh": {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, 0.7);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(4200, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.68);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.9, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
      source.connect(filter).connect(gain).connect(out);
      source.start(now);
      break;
    }

    case "shutter":
      playNoise(ctx, out, now, 0.05, 3200, 0.7);
      playNoise(ctx, out, now + 0.09, 0.06, 2400, 0.7);
      playTone(ctx, out, now, 0.04, 180, 120, "square", 0.25);
      break;

    case "glitch": {
      for (let i = 0; i < 7; i++) {
        const at = now + i * 0.06 + Math.random() * 0.02;
        playNoise(ctx, out, at, 0.045, 400 + Math.random() * 6000, 2);
        if (Math.random() > 0.5) {
          playTone(ctx, out, at, 0.035, 120 + Math.random() * 900, 90, "square", 0.35);
        }
      }
      break;
    }

    case "riser": {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, 1.6);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.4;
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(6000, now + 1.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.55, now + 1.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.58);
      source.connect(filter).connect(gain).connect(out);
      source.start(now);
      playTone(ctx, out, now, 1.5, 180, 1400, "sawtooth", 0.28);
      break;
    }

    case "applause": {
      for (let i = 0; i < 60; i++) {
        const at = now + Math.random() * 1.6;
        playNoise(ctx, out, at, 0.03 + Math.random() * 0.05, 1500 + Math.random() * 2500, 1.5);
      }
      const bed = ctx.createBufferSource();
      bed.buffer = noiseBuffer(ctx, 1.7);
      const bedFilter = ctx.createBiquadFilter();
      bedFilter.type = "bandpass";
      bedFilter.frequency.value = 2200;
      bedFilter.Q.value = 0.7;
      const bedGain = ctx.createGain();
      bedGain.gain.setValueAtTime(0.0001, now);
      bedGain.gain.linearRampToValueAtTime(0.18, now + 0.2);
      bedGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
      bed.connect(bedFilter).connect(bedGain).connect(out);
      bed.start(now);
      break;
    }
  }
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Encodes an `AudioBuffer` as a 16-bit PCM WAV blob. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const blockAlign = channels * 2;
  const dataSize = frames * blockAlign;
  const array = new ArrayBuffer(44 + dataSize);
  const view = new DataView(array);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([array], { type: "audio/wav" });
}

/** Synthesizes a sound effect into a decoded buffer + a playable WAV blob. */
export async function renderSoundEffect(
  id: SoundEffectId
): Promise<{ buffer: AudioBuffer; blob: Blob } | null> {
  if (typeof OfflineAudioContext === "undefined") return null;
  const spec = SOUND_EFFECTS.find((effect) => effect.id === id);
  if (!spec) return null;
  const sampleRate = 44100;
  const frames = Math.ceil(spec.duration * sampleRate);
  const ctx = new OfflineAudioContext(1, frames, sampleRate);
  buildSoundEffect(ctx, id);
  const buffer = await ctx.startRendering();
  return { buffer, blob: encodeWav(buffer) };
}
