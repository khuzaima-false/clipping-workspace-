/**
 * Royalty-free sound effects, synthesized 100% client-side with the Web Audio
 * API. No assets are downloaded and nothing touches a server — each effect is
 * rendered offline into an `AudioBuffer` (for the mixer / export) and encoded
 * to a small WAV blob (for `HTMLAudioElement` preview playback).
 */

export type SoundEffectCategory = "ui" | "cinematic" | "transitions" | "foley";

export type SoundEffectId =
  // UI
  | "pop"
  | "click"
  | "toggle"
  | "notify"
  | "success"
  | "error"
  | "hover"
  | "swipe"
  | "beep"
  | "coin"
  // Cinematic
  | "riser"
  | "boom"
  | "subdrop"
  | "trailerhit"
  | "whooshdeep"
  | "tension"
  | "swell"
  | "heartbeat"
  | "drone"
  | "darkstab"
  // Transitions
  | "whoosh"
  | "swoosh"
  | "rewind"
  | "zap"
  | "glitch"
  | "static"
  | "cymbal"
  | "tapestop"
  // Foley
  | "shutter"
  | "bell"
  | "applause"
  | "pageturn"
  | "footsteps"
  | "typing"
  | "knock"
  | "waterdrop";

export const SOUND_EFFECT_CATEGORIES: {
  id: SoundEffectCategory;
  label: string;
}[] = [
  { id: "ui", label: "UI" },
  { id: "cinematic", label: "Cinematic" },
  { id: "transitions", label: "Transitions" },
  { id: "foley", label: "Foley" },
];

/** 36 royalty-free effects across four categories. */
export const SOUND_EFFECTS: {
  id: SoundEffectId;
  label: string;
  category: SoundEffectCategory;
  duration: number;
}[] = [
  // ---- UI ----
  { id: "pop", label: "Pop", category: "ui", duration: 0.22 },
  { id: "click", label: "Click", category: "ui", duration: 0.1 },
  { id: "toggle", label: "Toggle", category: "ui", duration: 0.12 },
  { id: "notify", label: "Notification", category: "ui", duration: 0.55 },
  { id: "success", label: "Success Chime", category: "ui", duration: 0.9 },
  { id: "error", label: "Error Buzz", category: "ui", duration: 0.45 },
  { id: "hover", label: "Hover Tick", category: "ui", duration: 0.08 },
  { id: "swipe", label: "Swipe", category: "ui", duration: 0.3 },
  { id: "beep", label: "Beep", category: "ui", duration: 0.16 },
  { id: "coin", label: "Coin", category: "ui", duration: 0.42 },
  // ---- Cinematic ----
  { id: "riser", label: "Cinematic Riser", category: "cinematic", duration: 1.6 },
  { id: "boom", label: "Boom Impact", category: "cinematic", duration: 1.3 },
  { id: "subdrop", label: "Sub Drop", category: "cinematic", duration: 1.4 },
  { id: "trailerhit", label: "Trailer Hit", category: "cinematic", duration: 1.1 },
  { id: "whooshdeep", label: "Deep Whoosh", category: "cinematic", duration: 1.0 },
  { id: "tension", label: "Tension Drone", category: "cinematic", duration: 2.0 },
  { id: "swell", label: "Epic Swell", category: "cinematic", duration: 2.2 },
  { id: "heartbeat", label: "Heartbeat", category: "cinematic", duration: 1.5 },
  { id: "drone", label: "Drone Pad", category: "cinematic", duration: 2.5 },
  { id: "darkstab", label: "Dark Stab", category: "cinematic", duration: 1.0 },
  // ---- Transitions ----
  { id: "whoosh", label: "Whoosh", category: "transitions", duration: 0.7 },
  { id: "swoosh", label: "Swipe Swoosh", category: "transitions", duration: 0.6 },
  { id: "rewind", label: "Rewind", category: "transitions", duration: 0.7 },
  { id: "zap", label: "Fast Zap", category: "transitions", duration: 0.35 },
  { id: "glitch", label: "Glitch", category: "transitions", duration: 0.5 },
  { id: "static", label: "Static Burst", category: "transitions", duration: 0.6 },
  { id: "cymbal", label: "Reverse Cymbal", category: "transitions", duration: 1.2 },
  { id: "tapestop", label: "Tape Stop", category: "transitions", duration: 0.9 },
  // ---- Foley ----
  { id: "shutter", label: "Camera Shutter", category: "foley", duration: 0.35 },
  { id: "bell", label: "Bell", category: "foley", duration: 1.4 },
  { id: "applause", label: "Applause", category: "foley", duration: 1.8 },
  { id: "pageturn", label: "Page Turn", category: "foley", duration: 0.4 },
  { id: "footsteps", label: "Footsteps", category: "foley", duration: 1.2 },
  { id: "typing", label: "Keyboard Typing", category: "foley", duration: 1.0 },
  { id: "knock", label: "Door Knock", category: "foley", duration: 0.8 },
  { id: "waterdrop", label: "Water Drop", category: "foley", duration: 0.5 },
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

/** Sweeping band-passed noise (whooshes, sweeps, risers). */
function playNoiseSweep(
  ctx: BaseAudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  fromHz: number,
  toHz: number,
  q = 1,
  peak = 0.8
): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(fromHz, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
}

function buildSoundEffect(ctx: OfflineAudioContext, id: SoundEffectId): void {
  const out = ctx.destination;
  const now = 0;

  switch (id) {
    /* ------------------------------- UI ------------------------------- */
    case "pop":
      playTone(ctx, out, now, 0.16, 520, 1100, "sine", 0.9);
      playTone(ctx, out, now, 0.1, 260, 90, "triangle", 0.5);
      break;
    case "click":
      playNoise(ctx, out, now, 0.05, 2600, 1.2);
      playTone(ctx, out, now, 0.03, 900, 500, "square", 0.3);
      break;
    case "toggle":
      playNoise(ctx, out, now, 0.04, 3400, 1.5);
      playTone(ctx, out, now, 0.06, 1200, 800, "triangle", 0.35);
      break;
    case "notify":
      playTone(ctx, out, now, 0.18, 880, 880, "sine", 0.5);
      playTone(ctx, out, now + 0.16, 0.28, 1320, 1320, "sine", 0.5);
      break;
    case "success":
      [523, 659, 784].forEach((freq, i) =>
        playTone(ctx, out, now + i * 0.11, 0.35, freq, freq, "sine", 0.5)
      );
      break;
    case "error":
      playTone(ctx, out, now, 0.4, 220, 140, "sawtooth", 0.45);
      playTone(ctx, out, now, 0.4, 180, 110, "square", 0.25);
      break;
    case "hover":
      playTone(ctx, out, now, 0.06, 1600, 1500, "sine", 0.3);
      break;
    case "swipe":
      playNoiseSweep(ctx, out, now, 0.3, 800, 4000, 0.9, 0.7);
      break;
    case "beep":
      playTone(ctx, out, now, 0.15, 1000, 1000, "square", 0.4);
      break;
    case "coin":
      playTone(ctx, out, now, 0.08, 988, 988, "square", 0.4);
      playTone(ctx, out, now + 0.08, 0.3, 1319, 1319, "square", 0.35);
      break;

    /* --------------------------- Cinematic ---------------------------- */
    case "riser":
      playNoiseSweep(ctx, out, now, 1.5, 300, 6000, 1.4, 0.5);
      playTone(ctx, out, now, 1.5, 180, 1400, "sawtooth", 0.28);
      break;
    case "boom":
      playTone(ctx, out, now, 1.1, 90, 36, "sine", 0.9);
      playNoise(ctx, out, now, 0.45, 180, 0.8);
      break;
    case "subdrop":
      playTone(ctx, out, now, 1.3, 110, 28, "sine", 0.9);
      break;
    case "trailerhit":
      playTone(ctx, out, now, 0.9, 140, 48, "sine", 0.85);
      playNoise(ctx, out, now, 0.5, 400, 0.7);
      playTone(ctx, out, now, 0.6, 620, 500, "triangle", 0.3);
      break;
    case "whooshdeep":
      playNoiseSweep(ctx, out, now, 0.95, 120, 900, 0.8, 0.8);
      break;
    case "tension": {
      playTone(ctx, out, now, 2, 70, 82, "sawtooth", 0.28);
      playTone(ctx, out, now, 2, 105, 118, "sine", 0.18);
      break;
    }
    case "swell":
      [196, 247, 294, 392].forEach((freq) =>
        playTone(ctx, out, now, 2.1, freq, freq * 1.5, "sine", 0.28)
      );
      break;
    case "heartbeat":
      playTone(ctx, out, now, 0.25, 70, 40, "sine", 0.8);
      playTone(ctx, out, now + 0.32, 0.3, 62, 34, "sine", 0.6);
      break;
    case "drone":
      playTone(ctx, out, now, 2.4, 55, 55, "sawtooth", 0.3);
      playTone(ctx, out, now, 2.4, 82.5, 82.5, "sine", 0.22);
      playNoise(ctx, out, now, 2.4, 300, 0.5);
      break;
    case "darkstab":
      [146, 155, 220].forEach((freq) =>
        playTone(ctx, out, now, 0.9, freq, freq * 0.94, "sawtooth", 0.3)
      );
      break;

    /* -------------------------- Transitions --------------------------- */
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
    case "swoosh":
      playNoiseSweep(ctx, out, now, 0.55, 400, 5200, 0.9, 0.85);
      break;
    case "rewind":
      playNoiseSweep(ctx, out, now, 0.65, 1200, 6000, 1.2, 0.7);
      playTone(ctx, out, now, 0.65, 300, 1800, "square", 0.2);
      break;
    case "zap":
      playTone(ctx, out, now, 0.32, 2200, 200, "square", 0.5);
      playNoise(ctx, out, now, 0.2, 3000, 1.2);
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
    case "static":
      playNoise(ctx, out, now, 0.5, 2500, 0.6);
      playNoise(ctx, out, now + 0.1, 0.3, 5000, 0.8);
      break;
    case "cymbal": {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, 1.1);
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(7000, now + 1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      source.connect(filter).connect(gain).connect(out);
      source.start(now);
      break;
    }
    case "tapestop":
      playTone(ctx, out, now, 0.85, 1400, 90, "sawtooth", 0.45);
      playNoise(ctx, out, now, 0.3, 2000, 0.8);
      break;

    /* ----------------------------- Foley ------------------------------ */
    case "shutter":
      playNoise(ctx, out, now, 0.05, 3200, 0.7);
      playNoise(ctx, out, now + 0.09, 0.06, 2400, 0.7);
      playTone(ctx, out, now, 0.04, 180, 120, "square", 0.25);
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
    case "pageturn":
      playNoiseSweep(ctx, out, now, 0.38, 600, 3600, 0.8, 0.6);
      break;
    case "footsteps":
      [0, 0.4, 0.8].forEach((offset) => {
        playTone(ctx, out, now + offset, 0.12, 120, 60, "sine", 0.5);
        playNoise(ctx, out, now + offset, 0.08, 500, 0.9);
      });
      break;
    case "typing":
      for (let i = 0; i < 12; i++) {
        const at = now + i * 0.075 + Math.random() * 0.02;
        playNoise(ctx, out, at, 0.03, 2500 + Math.random() * 2500, 1.4);
      }
      break;
    case "knock":
      [0, 0.22, 0.44].forEach((offset) =>
        playTone(ctx, out, now + offset, 0.14, 180, 90, "sine", 0.6)
      );
      break;
    case "waterdrop":
      playTone(ctx, out, now, 0.28, 1400, 300, "sine", 0.6);
      playNoise(ctx, out, now, 0.06, 4000, 1.5);
      break;
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
