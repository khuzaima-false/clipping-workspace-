/**
 * In/Out motion presets for text overlays and titles.
 *
 * Each preset is a pure function of the overlay's *local* playback time
 * (`sceneTime - overlay.startTime`) returning a frame transform the canvas
 * renderer applies on top of the overlay's own keyframe transform. Translation
 * values are fractions of the frame size so a preset looks identical at 720p
 * and 4K.
 */

export type MotionPresetId =
  | "none"
  | "typewriter"
  | "dropIn"
  | "bounce"
  | "fadeSpin"
  | "slideUp";

export type MotionFrame = {
  /** Layer opacity multiplier, 0..1. */
  alpha: number;
  /** Horizontal offset as a fraction of the frame width. */
  offsetXRatio: number;
  /** Vertical offset as a fraction of the frame height. */
  offsetYRatio: number;
  /** Uniform scale multiplier (1 = unchanged). */
  scale: number;
  /** Extra rotation in degrees, around the overlay centre. */
  rotation: number;
  /** 0..1 reveal fraction for typewriter-style letter/word builds. */
  reveal: number;
};

export type MotionPreset = {
  id: MotionPresetId;
  label: string;
  blurb: string;
  /** Entrance length in seconds. */
  inDuration: number;
  /** Exit length in seconds. */
  outDuration: number;
  /** Pure sampler: local time + total overlay duration → frame transform. */
  resolve: (local: number, total: number) => MotionFrame;
};

/* ------------------------------------------------------------------ */
/* Easing helpers                                                      */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Standard ease-out curve: fast start, gentle settle. */
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - clamp01(x), 3);
}

/** Overshooting ease-out (elastic "pop" without oscillation). */
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const p = clamp01(x) - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

/** Symmetric ease-in-out, used for the exit fades. */
function easeInOutQuad(x: number): number {
  const p = clamp01(x);
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

/**
 * Damped spring: `1 - e^(-6t)·cos(10t)`.
 * Rises past 1 (overshoot) then settles exactly on 1, giving a physical drop.
 */
function springAt(x: number): number {
  const t = clamp01(x);
  return 1 - Math.exp(-6 * t) * Math.cos(10 * t);
}

/* ------------------------------------------------------------------ */
/* Shared exit envelope                                                */
/* ------------------------------------------------------------------ */

/** Fades the layer out over its final `outDuration` seconds. */
function exitAlpha(local: number, total: number, outDuration: number): number {
  if (outDuration <= 0 || total <= outDuration) return 1;
  const remaining = total - local;
  if (remaining >= outDuration) return 1;
  return 1 - easeInOutQuad(1 - clamp01(remaining / outDuration));
}

function baseFrame(): MotionFrame {
  return {
    alpha: 1,
    offsetXRatio: 0,
    offsetYRatio: 0,
    scale: 1,
    rotation: 0,
    reveal: 1,
  };
}

/* ------------------------------------------------------------------ */
/* The preset library                                                  */
/* ------------------------------------------------------------------ */

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "none",
    label: "None",
    blurb: "No entrance or exit motion.",
    inDuration: 0,
    outDuration: 0,
    resolve: () => baseFrame(),
  },
  {
    id: "typewriter",
    label: "Typewriter",
    blurb: "Reveals the line word by word, like it's being typed.",
    inDuration: 1,
    outDuration: 0.4,
    resolve: (local, total) => {
      const inDuration = 1;
      return {
        ...baseFrame(),
        // The word loop reads `reveal` to hide words that haven't "arrived" yet.
        reveal: clamp01(local / inDuration),
        alpha: exitAlpha(local, total, 0.4),
      };
    },
  },
  {
    id: "dropIn",
    label: "Drop-in",
    blurb: "Springs down from the top of the frame and settles.",
    inDuration: 0.85,
    outDuration: 0.4,
    resolve: (local, total) => {
      const p = springAt(local / 0.85);
      return {
        ...baseFrame(),
        offsetYRatio: -(1 - p) * 0.42,
        alpha: Math.min(1, local / 0.12) * exitAlpha(local, total, 0.4),
        scale: 1,
      };
    },
  },
  {
    id: "bounce",
    label: "Bounce",
    blurb: "Elastic scale-up that overshoots then snaps into place.",
    inDuration: 0.7,
    outDuration: 0.35,
    resolve: (local, total) => {
      const p = easeOutBack(local / 0.7);
      return {
        ...baseFrame(),
        scale: 0.35 + 0.65 * p,
        alpha: Math.min(1, local / 0.18) * exitAlpha(local, total, 0.35),
      };
    },
  },
  {
    id: "fadeSpin",
    label: "Fade Spin",
    blurb: "Fades up while rotating into place.",
    inDuration: 0.8,
    outDuration: 0.45,
    resolve: (local, total) => {
      const p = easeOutCubic(local / 0.8);
      return {
        ...baseFrame(),
        alpha: Math.min(1, local / 0.35) * exitAlpha(local, total, 0.45),
        rotation: -180 * (1 - p),
        scale: 0.82 + 0.18 * p,
      };
    },
  },
  {
    id: "slideUp",
    label: "Slide Up",
    blurb: "Glides up from below and eases to a stop.",
    inDuration: 0.55,
    outDuration: 0.4,
    resolve: (local, total) => {
      const p = easeOutCubic(local / 0.55);
      return {
        ...baseFrame(),
        offsetYRatio: (1 - p) * 0.16,
        alpha: Math.min(1, local / 0.2) * exitAlpha(local, total, 0.4),
      };
    },
  },
];

const PRESET_BY_ID = new Map(MOTION_PRESETS.map((preset) => [preset.id, preset]));

/** Type guard for persisted/untrusted values. */
export function isMotionPresetId(value: unknown): value is MotionPresetId {
  return typeof value === "string" && PRESET_BY_ID.has(value as MotionPresetId);
}

/** Resolves the frame transform for a preset at a given local time. */
export function resolveMotion(
  id: MotionPresetId | undefined,
  local: number,
  total: number
): MotionFrame {
  if (!id || id === "none") return baseFrame();
  const preset = PRESET_BY_ID.get(id);
  if (!preset) return baseFrame();
  return preset.resolve(Math.max(0, local), Math.max(0.0001, total));
}
