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

/**
 * Solves a CSS `cubic-bezier(x1, y1, x2, y2)` easing curve.
 *
 * Uses Newton-Raphson for the x→t inversion with a bisection fallback, the same
 * approach browsers use, so JS motion matches the CSS timing function exactly.
 */
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (t: number) => number {
  const sampleX = (t: number) =>
    3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
  const sampleY = (t: number) =>
    3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;

  const solveX = (x: number): number => {
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-4) return t;
      const slope =
        3 * (1 - t) * (1 - t) * x1 +
        6 * (1 - t) * t * (x2 - x1) +
        3 * t * t * (1 - x2);
      if (Math.abs(slope) < 1e-6) break;
      t = clamp01(t - dx / slope);
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 20; i += 1) {
      const cx = sampleX(t);
      if (Math.abs(cx - x) < 1e-4) break;
      if (cx < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (x: number) => sampleY(solveX(clamp01(x)));
}

/** The house easing: `cubic-bezier(0.16, 1, 0.3, 1)` (smooth, decelerating). */
const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

/** Standard ease-out (fast start, gentle settle). */
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - clamp01(x), 3);
}

/** Damped elastic overshoot — used by the Bounce preset. */
function elasticOut(x: number): number {
  const t = clamp01(x);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin(((t - 0.075) * (2 * Math.PI)) / 0.3) + 1;
}

/** Symmetric ease-in-out, used for the exit fades. */
function easeInOutQuad(x: number): number {
  const p = clamp01(x);
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
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
        // A decelerating curve keeps the cadence from feeling mechanical.
        reveal: EASE_OUT_EXPO(local / inDuration),
        alpha: exitAlpha(local, total, 0.4),
      };
    },
  },
  {
    id: "dropIn",
    label: "Drop-in",
    blurb: "Glides down from the top of the frame and eases to a stop.",
    inDuration: 0.85,
    outDuration: 0.4,
    resolve: (local, total) => {
      const p = EASE_OUT_EXPO(local / 0.85);
      return {
        ...baseFrame(),
        offsetYRatio: -(1 - p) * 0.42,
        alpha: easeOutCubic(local / 0.16) * exitAlpha(local, total, 0.4),
        scale: 1,
      };
    },
  },
  {
    id: "bounce",
    label: "Bounce",
    blurb: "Elastic scale-up with a soft overshoot, then it settles.",
    inDuration: 0.7,
    outDuration: 0.35,
    resolve: (local, total) => {
      const p = elasticOut(local / 0.7);
      return {
        ...baseFrame(),
        scale: 0.35 + 0.65 * p,
        alpha: easeOutCubic(local / 0.18) * exitAlpha(local, total, 0.35),
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
      const p = EASE_OUT_EXPO(local / 0.8);
      return {
        ...baseFrame(),
        alpha: easeOutCubic(local / 0.35) * exitAlpha(local, total, 0.45),
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
      const p = EASE_OUT_EXPO(local / 0.55);
      return {
        ...baseFrame(),
        offsetYRatio: (1 - p) * 0.16,
        alpha: easeOutCubic(local / 0.2) * exitAlpha(local, total, 0.4),
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
