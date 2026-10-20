import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import {
  loadProjectMedia,
  loadVideoSource,
  saveProjectMedia,
  saveVideoSource,
  type StoredAssetMeta,
  type StoredAudio,
  type TimelineClip,
  type TransitionType,
  type VideoAsset,
} from "@/lib/video-storage";
import {
  deleteMediaFile,
  getMediaFile,
  newMediaId,
  saveMediaFile,
} from "@/lib/media-storage";
import { renderSoundEffect, SOUND_EFFECTS, type SoundEffectId } from "@/lib/sfx";
import { audioPreview } from "@/lib/audio-preview";
import { unlockAudio } from "@/lib/media-recovery";
import { applyElementAudio } from "@/lib/element-audio";
import { mountPreviewMedia, unmountPreviewMedia } from "@/lib/preview-media";
import { type MotionPresetId } from "@/lib/motion-presets";
import {
  AUDIO_TRACK_KEYS,
  DEFAULT_TRACK_STATE,
  defaultTrackStates,
  laneKeyFor,
  normalizeTrackStates,
  type TrackField,
  type TrackKey,
  type TrackState,
} from "@/lib/tracks";
import { computeWaveformPeaks } from "@/lib/waveform-peaks";
import type { CaptionLanguageId } from "@/lib/transcribe";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "21:9";
/** How mismatched media fills the canvas behind the letterboxed frame. */
export type CanvasFill = "black" | "blur";
export type VideoFit = "contain" | "cover";
export type OverlayAlign = "left" | "center" | "right";

/** A single spoken word with its timing (seconds from the start of the video). */
export type CaptionWord = {
  text: string;
  start: number;
  end: number;
};

/** How AI-generated words animate as they are spoken. */
export type CaptionAnimation =
  | "none"
  | "pop"
  | "bounce"
  | "karaoke"
  | "typewriter"
  | "fadeIn"
  | "neon"
  | "slideUp"
  | "zoomPunch"
  | "blurIn"
  | "gradientWave"
  | "matrixRain"
  | "flip"
  | "shake"
  | "glitchText"
  | "outlinePulse"
  | "underline"
  | "highlightBox"
  | "wave"
  | "stomp";

/** One-tap social caption looks (20+ style gallery). */
export type CaptionPreset =
  | "classic"
  | "karaoke"
  | "bounce"
  | "popup"
  | "typewriter"
  | "neonBox"
  | "matrix"
  | "gradientWave"
  | "cinematic"
  | "slideUp"
  | "zoomPunch"
  | "glitch"
  | "outline"
  | "underline"
  | "highlightBox"
  | "stomp"
  | "wave"
  | "flip"
  | "shake"
  | "softShadow"
  | "boldYellow"
  | "minimal"
  | "boxed";

/** A ready-made caption style shown in the gallery. */
export type CaptionPresetDef = {
  id: CaptionPreset;
  label: string;
  animation: CaptionAnimation;
  activeWordHighlight: boolean;
  textStroke: boolean;
  fillColor: string;
  highlightColor: string;
  bgColor: string;
  padding: number;
  radius: number;
  swatch: string;
};

export const CAPTION_PRESETS: CaptionPresetDef[] = [
  { id: "classic", label: "Classic", animation: "pop", activeWordHighlight: true, textStroke: true, fillColor: "#ffffff", highlightColor: "#facc15", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#f8fafc,#a1a1aa)" },
  { id: "karaoke", label: "Karaoke", animation: "karaoke", activeWordHighlight: true, textStroke: true, fillColor: "#ffffff", highlightColor: "#facc15", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#facc15,#f97316)" },
  { id: "bounce", label: "Bounce", animation: "bounce", activeWordHighlight: true, textStroke: true, fillColor: "#ffffff", highlightColor: "#38bdf8", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#38bdf8,#6366f1)" },
  { id: "popup", label: "Pop-Up", animation: "pop", activeWordHighlight: false, textStroke: true, fillColor: "#fde047", highlightColor: "#fde047", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#fde047,#f59e0b)" },
  { id: "typewriter", label: "Typewriter", animation: "typewriter", activeWordHighlight: false, textStroke: false, fillColor: "#f4f4f5", highlightColor: "#f4f4f5", bgColor: "#0b0b0f", padding: 20, radius: 6, swatch: "linear-gradient(135deg,#d4d4d8,#3f3f46)" },
  { id: "neonBox", label: "Neon Glow Box", animation: "neon", activeWordHighlight: false, textStroke: false, fillColor: "#ffffff", highlightColor: "#22d3ee", bgColor: "#09090b", padding: 30, radius: 18, swatch: "linear-gradient(135deg,#22d3ee,#a855f7)" },
  { id: "matrix", label: "Matrix Rain", animation: "matrixRain", activeWordHighlight: false, textStroke: false, fillColor: "#22c55e", highlightColor: "#86efac", bgColor: "#001a05", padding: 22, radius: 6, swatch: "linear-gradient(135deg,#052e16,#22c55e)" },
  { id: "gradientWave", label: "Gradient Wave", animation: "gradientWave", activeWordHighlight: false, textStroke: true, fillColor: "#ffffff", highlightColor: "#f472b6", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#f472b6,#22d3ee,#a855f7)" },
  { id: "cinematic", label: "Cinematic Blur", animation: "blurIn", activeWordHighlight: false, textStroke: false, fillColor: "#e5e7eb", highlightColor: "#e5e7eb", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#0ea5e9,#0f172a)" },
  { id: "slideUp", label: "Slide Up", animation: "slideUp", activeWordHighlight: true, textStroke: true, fillColor: "#ffffff", highlightColor: "#facc15", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#fbbf24,#7c3aed)" },
  { id: "zoomPunch", label: "Zoom Punch", animation: "zoomPunch", activeWordHighlight: true, textStroke: true, fillColor: "#ffffff", highlightColor: "#ef4444", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#ef4444,#111827)" },
  { id: "glitch", label: "Glitch Text", animation: "glitchText", activeWordHighlight: false, textStroke: false, fillColor: "#ffffff", highlightColor: "#22d3ee", bgColor: "#0b0b0f", padding: 16, radius: 4, swatch: "linear-gradient(135deg,#22d3ee,#f43f5e)" },
  { id: "outline", label: "Outline Pulse", animation: "outlinePulse", activeWordHighlight: false, textStroke: true, fillColor: "#ffffff", highlightColor: "#ffffff", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#ffffff,#52525b)" },
  { id: "underline", label: "Underline", animation: "underline", activeWordHighlight: true, textStroke: false, fillColor: "#ffffff", highlightColor: "#34d399", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#34d399,#065f46)" },
  { id: "highlightBox", label: "Word Highlight Box", animation: "highlightBox", activeWordHighlight: true, textStroke: false, fillColor: "#ffffff", highlightColor: "#facc15", bgColor: "#0b0b0f", padding: 22, radius: 10, swatch: "linear-gradient(135deg,#facc15,#0b0b0f)" },
  { id: "stomp", label: "Stomp", animation: "stomp", activeWordHighlight: true, textStroke: true, fillColor: "#ffffff", highlightColor: "#fb7185", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#fb7185,#4c0519)" },
  { id: "wave", label: "Wave", animation: "wave", activeWordHighlight: false, textStroke: true, fillColor: "#ffffff", highlightColor: "#a78bfa", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#a78bfa,#2563eb)" },
  { id: "flip", label: "Flip In", animation: "flip", activeWordHighlight: false, textStroke: true, fillColor: "#ffffff", highlightColor: "#facc15", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#64748b,#0f172a)" },
  { id: "shake", label: "Shake", animation: "shake", activeWordHighlight: false, textStroke: true, fillColor: "#ffffff", highlightColor: "#f97316", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#f97316,#7c2d12)" },
  { id: "softShadow", label: "Soft Shadow", animation: "fadeIn", activeWordHighlight: false, textStroke: false, fillColor: "#ffffff", highlightColor: "#ffffff", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#e4e4e7,#71717a)" },
  { id: "boldYellow", label: "Bold Yellow", animation: "pop", activeWordHighlight: false, textStroke: true, fillColor: "#facc15", highlightColor: "#fde047", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#fde047,#ca8a04)" },
  { id: "minimal", label: "Minimal", animation: "none", activeWordHighlight: false, textStroke: false, fillColor: "#ffffff", highlightColor: "#ffffff", bgColor: "", padding: 0, radius: 0, swatch: "linear-gradient(135deg,#fafafa,#d4d4d8)" },
  { id: "boxed", label: "Boxed", animation: "fadeIn", activeWordHighlight: false, textStroke: false, fillColor: "#ffffff", highlightColor: "#ffffff", bgColor: "#18181b", padding: 24, radius: 8, swatch: "linear-gradient(135deg,#3f3f46,#09090b)" },
];

/** Global styling applied to every auto-generated caption overlay. */
export type CaptionStyle = {
  /** Highlight the word currently being spoken (Hormozi / CapCut style). */
  activeWordHighlight: boolean;
  /** Draw a thick black outline behind caption text for contrast. */
  textStroke: boolean;
  /** Per-word entrance animation preset. */
  animation: CaptionAnimation;
  /** Fill color for the active/highlighted word. */
  highlightColor: string;
  /** Selected social-media caption look (drives the fields above). */
  preset: CaptionPreset;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  activeWordHighlight: true,
  textStroke: true,
  animation: "pop",
  highlightColor: "#facc15",
  preset: "classic",
};

/** Chroma-key (green/blue screen) settings. Runs entirely on the CPU canvas. */
export type ChromaKeySettings = {
  enabled: boolean;
  /** Key color, hex. */
  color: string;
  /** 0..100 — how far a pixel may stray from the key color before it is cut. */
  tolerance: number;
  /** 0..100 — softens the cut edge to avoid a hard, aliased matte. */
  feather: number;
};

export const DEFAULT_CHROMA_KEY: ChromaKeySettings = {
  enabled: false,
  color: "#00ff00",
  tolerance: 32,
  feather: 22,
};

/**
 * A transform keyframe for an overlay. Values are linear-interpolated between
 * adjacent keyframes during playback so overlays can animate over time.
 */
export type OverlayKeyframe = {
  id: string;
  /** Position on the timeline (seconds) where this pose applies. */
  time: number;
  /** Scale multiplier, 1 = the overlay's base size. */
  scale: number;
  /** Horizontal anchor, 0..100 (% of canvas width). */
  x: number;
  /** Vertical anchor, 0..100 (% of canvas height). */
  y: number;
  /** Opacity, 0..100. */
  opacity: number;
  /** Rotation, degrees. */
  rotation: number;
};

/** Default frame rate used for frame-stepping and export. */
export const DEFAULT_FPS = 30;

/** Colour-grading controls applied to the video frame before overlays. */
export type ColorAdjustments = {
  /** -100..100 (%) */
  brightness: number;
  /** -100..100 (%) overall exposure, stacked on brightness. */
  exposure: number;
  /** -100..100 (%) */
  contrast: number;
  /** -100..100 (%) — recover/boost the bright end. */
  highlights: number;
  /** -100..100 (%) — lift/crush the dark end. */
  shadows: number;
  /** -100..100 (%) — clip point of the brightest tones. */
  whites: number;
  /** -100..100 (%) — clip point of the darkest tones. */
  blacks: number;
  /** -100..100 (%) — saturation weighted toward muted colours. */
  vibrance: number;
  /** -100..100 (%) */
  saturation: number;
  /** -100..100 — cool (blue) ↔ warm (orange). */
  hue: number;
  /** -100..100 — green ↔ magenta. */
  tint: number;
  /** 0..20 (px) */
  blur: number;
  /** 0..100 — edge sharpening (unsharp mask). */
  sharpness: number;
  /** 0..100 — local midtone contrast. */
  clarity: number;
};

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  vibrance: 0,
  saturation: 0,
  hue: 0,
  tint: 0,
  blur: 0,
  sharpness: 0,
  clarity: 0,
};

/** One colour-wheel handle position (-1..1 on each axis) plus trim controls. */
export type WheelPoint = {
  x: number;
  y: number;
  /** Per-channel offsets in the wheel's tonal range, -100..100. */
  r?: number;
  g?: number;
  b?: number;
  /** Luminance offset in the wheel's tonal range, -100..100. */
  lum?: number;
  /** Saturation multiplier in the wheel's tonal range, -100..100. */
  sat?: number;
};

/** Lift / Gamma / Gain colour wheels (shadows / midtones / highlights). */
export type ColorWheels = {
  lift: WheelPoint;
  gamma: WheelPoint;
  gain: WheelPoint;
};

export const DEFAULT_COLOR_WHEELS: ColorWheels = {
  lift: { x: 0, y: 0 },
  gamma: { x: 0, y: 0 },
  gain: { x: 0, y: 0 },
};

/**
 * An external audio track / sound effect layered on top of the video.
 * Times are in seconds on the master timeline.
 */
export type AudioTrack = {
  id: string;
  /** Stable id of the persisted source blob in media storage. */
  mediaId: string;
  name: string;
  /** Object URL for preview playback. */
  url: string;
  /** Original upload, kept so the exporter can re-decode if needed. */
  file: File;
  /** Decoded PCM used for mixing and export. */
  buffer: AudioBuffer | null;
  /** Timeline position where the track starts. */
  startTime: number;
  /** Playback gain, 0..1. */
  volume: number;
  /** Offset into the source file where playback begins. */
  trimStart: number;
  /** Usable length of the source after `trimStart`. */
  duration: number;
  /** Mute this track during preview + export. */
  muted: boolean;
  /** Solo this track (all non-soloed tracks are silenced). */
  solo: boolean;
  /** Fade-in length in seconds. */
  fadeIn: number;
  /** Fade-out length in seconds. */
  fadeOut: number;
  /** True for built-in synthesized sound effects. */
  synth?: boolean;
  /** Zero-based audio lane this track lives on (A1 = 0, A2 = 1, A3 = 2). */
  lane?: number;
  /** Normalized 0..1 waveform peaks, pre-computed at import for the lanes. */
  peaks?: number[];
};

export type TextOverlay = {
  id: string;
  text: string;
  /** Horizontal anchor, 0..100 (% of canvas width). */
  x: number;
  /** Vertical anchor (box center), 0..100 (% of canvas height). */
  y: number;
  fontFamily: string;
  /** Font size in output pixels (canvas is rendered at target resolution). */
  fontSize: number;
  /** Text color, hex. */
  fillColor: string;
  /** Background fill, hex — empty string means transparent. */
  bgColor: string;
  /** Background pill opacity, 0..100 (defaults to 100). */
  bgOpacity?: number;
  /** Text outline colour (hex). */
  strokeColor?: string;
  /** Text outline width in output px (overrides the caption-style default). */
  strokeWidth?: number;
  /** Drop-shadow colour (hex) and blur radius in output px. */
  shadowColor?: string;
  shadowBlur?: number;
  /** Inner padding around the text, output px. */
  padding: number;
  /** Background corner radius, output px. */
  radius: number;
  alignment: OverlayAlign;
  /** Rotation around the overlay's center, degrees. */
  rotation: number;
  /** Layer opacity, 0..100. */
  opacity: number;
  /** Clip the overlay to its text box (simple mask). */
  mask: boolean;
  /** Seconds from the start of the video when this overlay appears. */
  startTime: number;
  /** Seconds from the start of the video when this overlay disappears. */
  endTime: number;
  /**
   * Word-level timings for AI-generated captions. When present the renderer
   * can highlight the active word and animate words as they are spoken.
   */
  words?: CaptionWord[];
  /** Marks a caption produced by the AI transcriber so it can be replaced on regeneration. */
  auto?: boolean;
  /** Per-overlay animation; falls back to the global caption style. */
  animation?: CaptionAnimation;
  /** Bitmap overlay (PNG data URL); when set, the overlay renders as an image. */
  imageSrc?: string;
  /** Blur (px) applied behind an image overlay. */
  bgBlur?: number;
  /** Transform keyframes; when present the renderer LERPs between them. */
  keyframes?: OverlayKeyframe[];
  /** Uniform size multiplier (mainly for image/sticker overlays). */
  scale?: number;
  /**
   * In/out motion preset applied on top of the overlay's own transform while
   * rendering (see `lib/motion-presets`).
   */
  motion?: MotionPresetId;
};

/** A keyframe on the speed (velocity) curve. `time` is in source-video seconds. */
export type SpeedPoint = {
  time: number;
  speed: number;
};

export const MIN_SPEED = 0.2;
export const MAX_SPEED = 5;

/** Named velocity presets, plus `custom` once the user edits the curve. */
export type SpeedPreset = "none" | "montage" | "hero" | "bullet" | "jumpCut" | "custom";

/** Cross-clip transition presets offered by the Transitions library. */
export type TransitionPreset = {
  id: TransitionType;
  label: string;
  /** Default overlap length (seconds). */
  duration: number;
};

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: "crossDissolve", label: "Cross Dissolve", duration: 0.6 },
  { id: "dipToBlack", label: "Dip to Black", duration: 0.5 },
  { id: "whipPan", label: "Whip Pan", duration: 0.4 },
  { id: "glitchCut", label: "Glitch Cut", duration: 0.3 },
  { id: "zoomBlur", label: "Zoom Blur", duration: 0.5 },
];

/** Export resolution preset id. */
export type ExportResolutionId = "720p" | "1080p" | "4k" | "vertical";

/** Client-side render targets: dimensions + target bitrate per preset. */
export const EXPORT_RESOLUTIONS: Record<
  ExportResolutionId,
  { label: string; width: number; height: number; bitrate: number }
> = {
  "720p": { label: "720p", width: 1280, height: 720, bitrate: 6_000_000 },
  "1080p": { label: "1080p", width: 1920, height: 1080, bitrate: 12_000_000 },
  "4k": { label: "4K", width: 3840, height: 2160, bitrate: 35_000_000 },
  vertical: { label: "9:16", width: 1080, height: 1920, bitrate: 12_000_000 },
};

export type VideoEffectType =
  // Transform / camera
  | "zoom-in"
  | "zoom-out"
  | "punch-in"
  | "pull-back"
  | "camera-shake"
  | "orbit-drift"
  | "vertical-drift"
  | "rotate-sway"
  | "bounce-pulse"
  | "handheld"
  // Colour / grade
  | "sepia"
  | "invert"
  | "grayscale"
  | "warm-flash"
  | "cool-shift"
  | "hue-cycle"
  | "brightness-pulse"
  | "contrast-pump"
  | "chromatic-bleed"
  | "duotone"
  // Light / atmosphere
  | "flash"
  | "light-leak"
  | "cinematic-glow"
  | "bloom"
  | "vignette"
  | "blur-vignette"
  | "sparkle"
  | "god-rays"
  // Film / retro
  | "film-grain"
  | "scanlines"
  | "vhs-glitch"
  | "glitch-rgb"
  | "pixelate"
  | "retro-tv"
  | "crt-warp";

/** A timed visual effect applied on top of the video frame. */
export type VideoEffect = {
  id: string;
  type: VideoEffectType;
  /** Source-video time (seconds) where the effect begins. */
  startTime: number;
  /** Effect length in seconds. */
  duration: number;
  /** Strength, 0..1. */
  intensity: number;
};

/** Human labels + sensible default length/strength for every effect. */
export const EFFECT_DEFAULTS: Record<
  VideoEffectType,
  { duration: number; intensity: number }
> = {
  "zoom-in": { duration: 2, intensity: 0.6 },
  "zoom-out": { duration: 2, intensity: 0.6 },
  "punch-in": { duration: 0.5, intensity: 0.7 },
  "pull-back": { duration: 0.6, intensity: 0.7 },
  "camera-shake": { duration: 0.8, intensity: 0.5 },
  "orbit-drift": { duration: 3, intensity: 0.5 },
  "vertical-drift": { duration: 3, intensity: 0.5 },
  "rotate-sway": { duration: 2.5, intensity: 0.5 },
  "bounce-pulse": { duration: 1.2, intensity: 0.6 },
  handheld: { duration: 3, intensity: 0.4 },
  sepia: { duration: 2, intensity: 0.8 },
  invert: { duration: 1.5, intensity: 1 },
  grayscale: { duration: 2, intensity: 1 },
  "warm-flash": { duration: 0.6, intensity: 0.7 },
  "cool-shift": { duration: 2, intensity: 0.7 },
  "hue-cycle": { duration: 2, intensity: 0.7 },
  "brightness-pulse": { duration: 1, intensity: 0.5 },
  "contrast-pump": { duration: 1, intensity: 0.6 },
  "chromatic-bleed": { duration: 1.5, intensity: 0.6 },
  duotone: { duration: 2.5, intensity: 0.7 },
  flash: { duration: 0.5, intensity: 0.8 },
  "light-leak": { duration: 1.6, intensity: 0.7 },
  "cinematic-glow": { duration: 2.5, intensity: 0.6 },
  bloom: { duration: 2, intensity: 0.6 },
  vignette: { duration: 2.5, intensity: 0.7 },
  "blur-vignette": { duration: 2, intensity: 0.6 },
  sparkle: { duration: 1.5, intensity: 0.7 },
  "god-rays": { duration: 2.5, intensity: 0.6 },
  "film-grain": { duration: 2.5, intensity: 0.5 },
  scanlines: { duration: 2.5, intensity: 0.5 },
  "vhs-glitch": { duration: 1, intensity: 0.7 },
  "glitch-rgb": { duration: 0.8, intensity: 0.7 },
  pixelate: { duration: 1.5, intensity: 0.6 },
  "retro-tv": { duration: 2.5, intensity: 0.6 },
  "crt-warp": { duration: 2.5, intensity: 0.6 },
};

/** Display label for an effect type (e.g. "chromatic-bleed" → "Chromatic Bleed"). */
export function effectLabel(type: VideoEffectType): string {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The 35 effects, grouped for the effect pickers. */
export const EFFECT_GROUPS: { label: string; types: VideoEffectType[] }[] = [
  {
    label: "Transform & Camera",
    types: ["zoom-in", "zoom-out", "punch-in", "pull-back", "camera-shake", "orbit-drift", "vertical-drift", "rotate-sway", "bounce-pulse", "handheld"],
  },
  {
    label: "Color & Grade",
    types: ["sepia", "invert", "grayscale", "warm-flash", "cool-shift", "hue-cycle", "brightness-pulse", "contrast-pump", "chromatic-bleed", "duotone"],
  },
  {
    label: "Light & Atmosphere",
    types: ["flash", "light-leak", "cinematic-glow", "bloom", "vignette", "blur-vignette", "sparkle", "god-rays"],
  },
  {
    label: "Film & Retro",
    types: ["film-grain", "scanlines", "vhs-glitch", "glitch-rgb", "pixelate", "retro-tv", "crt-warp"],
  },
];

export function clampSpeed(speed: number): number {
  return Math.min(Math.max(speed, MIN_SPEED), MAX_SPEED);
}

/** Clamps, sorts and de-duplicates a speed-point list. */
export function normalizeSpeedPoints(points: SpeedPoint[]): SpeedPoint[] {
  const cleaned = points
    .map((point) => ({
      time: Math.max(0, point.time),
      speed: clampSpeed(point.speed),
    }))
    .sort((a, b) => a.time - b.time);

  if (cleaned.length === 0) return [{ time: 0, speed: 1 }];

  const result: SpeedPoint[] = [];
  for (const point of cleaned) {
    const previous = result[result.length - 1];
    if (previous && Math.abs(point.time - previous.time) < 0.02) {
      result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }
  return result;
}

/** Normalized shapes (0..1 of the clip) expanded across the video duration. */
const PRESET_SHAPES: Record<"montage" | "hero" | "bullet" | "jumpCut", SpeedPoint[]> = {
  montage: [
    { time: 0, speed: 1 },
    { time: 0.15, speed: 3 },
    { time: 0.45, speed: 1 },
    { time: 0.7, speed: 3 },
    { time: 1, speed: 1 },
  ],
  hero: [
    { time: 0, speed: 1 },
    { time: 0.3, speed: 0.4 },
    { time: 0.55, speed: 0.4 },
    { time: 0.8, speed: 2.2 },
    { time: 1, speed: 2.2 },
  ],
  bullet: [
    { time: 0, speed: 1.5 },
    { time: 0.35, speed: 1.5 },
    { time: 0.45, speed: 0.25 },
    { time: 0.62, speed: 0.25 },
    { time: 0.72, speed: 1.5 },
    { time: 1, speed: 1.5 },
  ],
  // Fast spikes that read like hard jump cuts without changing clip count.
  jumpCut: [
    { time: 0, speed: 1 },
    { time: 0.18, speed: 1 },
    { time: 0.2, speed: 5 },
    { time: 0.28, speed: 1 },
    { time: 0.46, speed: 1 },
    { time: 0.48, speed: 5 },
    { time: 0.56, speed: 1 },
    { time: 0.74, speed: 1 },
    { time: 0.76, speed: 5 },
    { time: 0.84, speed: 1 },
    { time: 1, speed: 1 },
  ],
};

/** Builds the keypoint list for a named preset across the clip duration. */
export function buildSpeedPreset(
  preset: SpeedPreset,
  duration: number
): SpeedPoint[] {
  if (preset === "none" || preset === "custom") {
    return [{ time: 0, speed: 1 }];
  }
  const span = duration > 0 ? duration : 1;
  return PRESET_SHAPES[preset].map((point) => ({
    time: point.time * span,
    speed: point.speed,
  }));
}

export const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
] as const;

/**
 * Clamps AI-caption display windows to a clip's in/out range after a trim.
 * Non-destructive: word timings are preserved so re-trimming can't lose text.
 */
function clampCaptionsToClipWindow(
  overlays: TextOverlay[],
  from: number,
  to: number
): TextOverlay[] {
  if (to <= from) return overlays;
  return overlays.map((overlay) => {
    if (!overlay.auto) return overlay;
    // Only captions that actually intersect the new window are touched.
    if (overlay.endTime <= from || overlay.startTime >= to) return overlay;
    const startTime = Math.max(overlay.startTime, from);
    const endTime = Math.max(startTime + 0.05, Math.min(overlay.endTime, to));
    if (startTime === overlay.startTime && endTime === overlay.endTime) {
      return overlay;
    }
    return { ...overlay, startTime, endTime };
  });
}

/**
 * Splits captions that straddle a razor cut into two independent overlays, so
 * the words before the cut stay on the first half and the rest on the second.
 * Prevents the "subtitle jumps / desyncs after split" bug.
 */
function splitCaptionsAt(overlays: TextOverlay[], cutAt: number): TextOverlay[] {
  const out: TextOverlay[] = [];
  for (const overlay of overlays) {
    const words = overlay.words;
    if (!overlay.auto || !words || words.length === 0) {
      out.push(overlay);
      continue;
    }
    if (overlay.endTime <= cutAt || overlay.startTime >= cutAt) {
      out.push(overlay);
      continue;
    }
    const before = words.filter((word) => word.start < cutAt);
    const after = words.filter((word) => word.end > cutAt);
    if (before.length > 0) {
      out.push({
        ...overlay,
        endTime: cutAt,
        words: before,
        text: before.map((word) => word.text).join(" "),
      });
    }
    if (after.length > 0) {
      out.push({
        ...overlay,
        id: createId("caption"),
        startTime: cutAt,
        words: after,
        text: after.map((word) => word.text).join(" "),
      });
    }
  }
  return out;
}

/** Snaps a time to the 0.1s control grid and clamps it into [min, max]. */
function snapTime(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value * 10) / 10, min), max);
}

/**
 * Interpolated overlay pose at `time`, mirroring the renderer's transform.
 * Used when dropping a keyframe so un-edited properties keep their current
 * animated value instead of snapping back to 0 / 1.
 */
function overlayPoseAt(
  overlay: TextOverlay,
  time: number
): { x: number; y: number; scale: number; opacity: number; rotation: number } {
  const base = {
    x: overlay.x,
    y: overlay.y,
    scale: 1,
    opacity: overlay.opacity,
    rotation: overlay.rotation,
  };
  const frames = overlay.keyframes;
  if (!frames || frames.length === 0) return base;

  const poseOf = (frame: OverlayKeyframe) => ({
    x: frame.x,
    y: frame.y,
    scale: frame.scale,
    opacity: frame.opacity,
    rotation: frame.rotation,
  });

  if (time <= frames[0].time) return poseOf(frames[0]);
  const last = frames[frames.length - 1];
  if (time >= last.time) return poseOf(last);

  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i];
    const b = frames[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      const t = span <= 0 ? 0 : (time - a.time) / span;
      const mix = (from: number, to: number) => from + (to - from) * t;
      return {
        x: mix(a.x, b.x),
        y: mix(a.y, b.y),
        scale: mix(a.scale, b.scale),
        opacity: mix(a.opacity, b.opacity),
        rotation: mix(a.rotation, b.rotation),
      };
    }
  }
  return base;
}

/** Generates a collision-resistant id, falling back when `crypto.randomUUID` is unavailable. */
export function createId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Resolves every sequence clip to its absolute timeline position and length.
 * Clips without an explicit `timelineStart` flow after the previous clip, so
 * sequential projects keep their layout while dragged clips stay put.
 */
export function computeClipStarts(
  sequence: TimelineClip[]
): { clip: TimelineClip; start: number; dur: number }[] {
  let cursor = 0;
  return sequence.map((clip) => {
    const dur = Math.max(0.1, clip.trimEnd - clip.trimStart);
    const start =
      typeof clip.timelineStart === "number" && clip.timelineStart >= 0
        ? clip.timelineStart
        : cursor;
    cursor = start + dur;
    return { clip, start, dur };
  });
}

/* ------------------------------------------------------------------ */
/* Clip transform keyframes                                            */
/* ------------------------------------------------------------------ */

/** A clip's video-frame transform (percent offsets, scale multiplier, degrees). */
export type ClipTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type ClipTransformKeyframe = ClipTransform & {
  id: string;
  /** Source-time position (seconds) of the keyframe. */
  time: number;
};

export const DEFAULT_CLIP_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

/**
 * Resolves a clip's transform at a source time. Keyframes take precedence over
 * the base transform and are linearly interpolated (clamped at the ends), so
 * the preview and exporter always agree.
 */
export function resolveClipTransform(
  clip: TimelineClip | null | undefined,
  sourceTime: number
): ClipTransform {
  if (!clip) return DEFAULT_CLIP_TRANSFORM;
  const base: ClipTransform = {
    ...DEFAULT_CLIP_TRANSFORM,
    ...(clip.transform ?? {}),
  };
  const frames = clip.transformKeyframes;
  if (!frames || frames.length === 0) return base;

  const poseOf = (frame: ClipTransformKeyframe): ClipTransform => ({
    x: frame.x,
    y: frame.y,
    scale: frame.scale,
    rotation: frame.rotation,
  });

  if (sourceTime <= frames[0].time) return poseOf(frames[0]);
  const last = frames[frames.length - 1];
  if (sourceTime >= last.time) return poseOf(last);

  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i];
    const b = frames[i + 1];
    if (sourceTime >= a.time && sourceTime <= b.time) {
      const span = b.time - a.time;
      const t = span <= 0 ? 0 : (sourceTime - a.time) / span;
      const mix = (from: number, to: number) => from + (to - from) * t;
      return {
        x: mix(a.x, b.x),
        y: mix(a.y, b.y),
        scale: mix(a.scale, b.scale),
        rotation: mix(a.rotation, b.rotation),
      };
    }
  }
  return base;
}

function createOverlay(duration: number): TextOverlay {
  return {
    id: createId("overlay"),
    text: "Your caption here",
    x: 50,
    y: 85,
    fontFamily: "Arial",
    fontSize: 64,
    fillColor: "#ffffff",
    bgColor: "",
    padding: 24,
    radius: 16,
    alignment: "center",
    rotation: 0,
    opacity: 100,
    mask: false,
    startTime: 0,
    // Default to the first five seconds, or the whole clip when shorter.
    endTime: duration > 0 ? Math.min(5, duration) : 5,
  };
}

/** A snapshot of everything undo/redo can restore. */
export type EditSnapshot = {
  sequence: TimelineClip[];
  overlays: TextOverlay[];
  trimStart: number;
  trimEnd: number;
  colorAdjustments: ColorAdjustments;
  colorWheels: ColorWheels;
  activeEffects: VideoEffect[];
  aspect: AspectRatio;
  speedPoints: SpeedPoint[];
  speedPreset: SpeedPreset;
  captionStyle: CaptionStyle;
  fit: VideoFit;
  offsetX: number;
  offsetY: number;
  canvasFill: CanvasFill;
  chromaKey: ChromaKeySettings;
  /** Lane mute/solo/lock/visibility state (track-lock changes are undoable). */
  trackStates: Record<TrackKey, TrackState>;
};

/** Autosave lifecycle shown in the editor header. */
export type SaveStatus = "saved" | "saving" | "unsaved";

type EditorState = {
  /** Current preview/export video element (owned by the store, not React). */
  videoEl: HTMLVideoElement | null;
  videoUrl: string | null;
  videoFile: File | null;
  videoName: string | null;
  videoError: string | null;

  /** Active project id — keys the locally persisted source video. */
  projectId: string | null;
  /** True when a project is open but its source video isn't stored locally. */
  videoMissing: boolean;
  /** True while restoring a persisted source video from IndexedDB. */
  videoRestoring: boolean;

  /** Uploaded media library (multiple clips per project, persisted in IndexedDB). */
  assets: VideoAsset[];
  /** Ordered clip sequence used to merge clips into one export. */
  sequence: TimelineClip[];
  /** Sequence clip currently loaded in the preview/editor. */
  activeClipId: string | null;
  /** True while the project's media library is loading. */
  assetsLoading: boolean;
  /** Trim applied once a selected clip's metadata loads. */
  pendingTrim: { trimStart: number; trimEnd: number } | null;
  /** Source-time to seek to once the clip's metadata loads (timeline scrub). */
  pendingSeek: number | null;
  /** Spoken language used for AI caption transcription. */
  captionLanguage: CaptionLanguageId;

  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  /** Playback/render region marks (seconds), or null when unset. */
  markIn: number | null;
  markOut: number | null;
  volume: number;
  playing: boolean;

  aspect: AspectRatio;
  fit: VideoFit;
  offsetX: number;
  offsetY: number;
  /** Background fill strategy for letterboxed / mismatched media. */
  canvasFill: CanvasFill;

  overlays: TextOverlay[];
  selectedId: string | null;

  /** Global styling for AI-generated captions. */
  captionStyle: CaptionStyle;
  /** True while the Whisper model is downloading / transcribing. */
  transcribing: boolean;
  /** Model + transcription progress, 0..100. */
  transcribingProgress: number;
  /** Human-readable status line shown in the caption progress UI. */
  transcribingStatus: string;
  /** Last transcription failure, if any. */
  transcriptionError: string | null;

  /** Frame rate used for frame stepping and export. */
  fps: number;
  /** Use high-quality canvas scaling (crisp) for preview and export. */
  hdRendering: boolean;
  /** Active export resolution preset (dimensions + target bitrate). */
  exportResolution: ExportResolutionId;
  /** Colour grading applied to the video frame. */
  colorAdjustments: ColorAdjustments;
  /** Lift / Gamma / Gain colour wheels. */
  colorWheels: ColorWheels;
  /** External audio tracks / sound effects layered on the timeline. */
  audioTracks: AudioTrack[];
  /** Last audio-import failure, if any. */
  audioTrackError: string | null;

  /** Per-lane mute / solo / lock / hide state for the timeline workspace. */
  trackStates: Record<TrackKey, TrackState>;
  /** Toggles (or explicitly sets) a lane flag. */
  setTrackFlag: (key: TrackKey, field: TrackField, value?: boolean) => void;
  /** Splits a sequence clip at a source time into two independent clips. */
  splitClip: (clipId: string, sourceTime: number) => void;
  /**
   * Text-based editing: removes the source-time range `[from, to]` from the
   * active clip, closes the resulting timeline gap (ripple) and re-times every
   * caption word, overlay, effect and audio track so nothing drifts.
   */
  deleteTranscriptRange: (from: number, to: number) => void;
  /** Deletes a clip and shifts later clips on the track left to close the gap. */
  rippleDeleteClip: (clipId: string) => void;

  /** Active speed (velocity) preset. */
  speedPreset: SpeedPreset;
  /** Speed keyframes along the source-video timeline. */
  speedPoints: SpeedPoint[];
  /** Timed visual effects applied over the video frame. */
  activeEffects: VideoEffect[];
  /** Chroma-key (green screen) settings for the active clip. */
  chromaKey: ChromaKeySettings;
  /** True while the program monitor acts as a color eyedropper. */
  eyedropper: boolean;

  loadVideo: (file: File) => void;
  /** Applies raw video bytes (e.g. restored from IndexedDB) to the editor. */
  loadVideoBlob: (
    blob: Blob,
    name: string,
    options?: { autoplay?: boolean }
  ) => void;
  /** Restores the source video persisted for `projectId`, if available. */
  restoreVideo: (projectId: string) => Promise<void>;
  /** Sets the language used for AI caption transcription. */
  setCaptionLanguage: (language: CaptionLanguageId) => void;
  /** Loads the project's media library + sequence and the first clip. */
  loadProjectMedia: (projectId: string) => Promise<void>;
  /** Adds one or more videos to the library and the timeline sequence. */
  addVideoAssets: (files: FileList | File[]) => Promise<void>;
  /** Removes a library asset and any sequence clips that used it. */
  removeAsset: (assetId: string) => void;
  /** Loads a sequence clip into the preview/editor. */
  selectClip: (clipId: string) => void;
  /** Scrubs to a source time inside a clip (used by the mobile filmstrip). */
  scrubTo: (clipId: string, sourceTime: number) => void;
  /** Advances to the next clip during playback; false when on the last clip. */
  advanceClip: (wrap?: boolean) => boolean;
  /** Removes a clip from the sequence. */
  removeClip: (clipId: string) => void;
  /** Splits the active clip into two clips at the current playhead. */
  splitActiveClip: () => void;
  /** Duplicates the active clip immediately after it. */
  duplicateActiveClip: () => void;
  /** Reorders a clip up (-1) or down (+1). */
  moveClip: (clipId: string, direction: -1 | 1) => void;
  /** Repositions a clip freely along the timeline (seconds). */
  moveClipTo: (clipId: string, timelineStart: number) => void;
  /** Moves a clip to a new index in the sequence (drag-to-reorder). */
  reorderClip: (clipId: string, toIndex: number) => void;
  /** Updates a clip's trim range. */
  setClipTrim: (
    clipId: string,
    patch: { trimStart?: number; trimEnd?: number }
  ) => void;
  /**
   * Writes transform values to a clip. With no keyframes it updates the base
   * pose; once the clip is animated it upserts a keyframe at the playhead.
   */
  setClipTransformAtPlayhead: (
    clipId: string,
    patch: Partial<ClipTransform>
  ) => void;
  /** Adds a transform keyframe at the playhead capturing the current pose. */
  addClipTransformKeyframe: (clipId: string) => void;
  removeClipTransformKeyframe: (clipId: string, keyframeId: string) => void;
  clearClipTransformKeyframes: (clipId: string) => void;
  /** Sets (or clears) the transition blended into a clip from the previous one. */
  setClipTransition: (
    clipId: string,
    type: TransitionType | null,
    duration?: number
  ) => void;
  /** Restores an undo/redo snapshot of the editable timeline state. */
  restoreEdit: (snapshot: EditSnapshot) => void;
  /** Undo/redo stacks for the editing session (capped for safety). */
  history: EditSnapshot[];
  future: EditSnapshot[];
  undo: () => void;
  redo: () => void;
  /** Debounced-persist status shown in the editor header. */
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;
  /** Forces an immediate IndexedDB checkpoint of the active project. */
  checkpoint: () => Promise<void>;
  resetEditor: () => void;
  seek: (time: number) => void;
  /** Moves the playhead by `delta` frames (negative steps backwards). */
  stepFrame: (delta: number) => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setTrimStart: (time: number) => void;
  setTrimEnd: (time: number) => void;
  resetTrim: () => void;
  /** Sets the In mark (playback + export region start). */
  setMarkIn: (time: number) => void;
  /** Sets the Out mark (playback + export region end). */
  setMarkOut: (time: number) => void;
  /** Clears both marks so the full clip region is used. */
  clearMarks: () => void;
  setAspect: (aspect: AspectRatio) => void;
  /** Toggle high-quality (crisp) canvas scaling. */
  setHdRendering: (enabled: boolean) => void;
  /** Selects the export resolution preset. */
  setExportResolution: (id: ExportResolutionId) => void;
  setFit: (fit: VideoFit) => void;
  setOffset: (x: number, y: number) => void;
  /** Sets the letterbox background fill strategy. */
  setCanvasFill: (fill: CanvasFill) => void;
  addOverlay: () => void;
  /** Adds a text/emoji sticker overlay at a larger default size. */
  addTextSticker: (text: string, fontSize?: number) => void;
  /** Adds a graphic (SVG data URL) sticker overlay, centered. */
  addStickerImage: (src: string) => void;
  /** Adds a bitmap (PNG data URL) overlay layer (renders on V2). */
  addImageOverlay: (src: string, duration?: number) => void;
  updateOverlay: (id: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  setOverlayStartTime: (id: string, time: number) => void;
  setOverlayEndTime: (id: string, time: number) => void;
  /** Shifts an overlay along the timeline, preserving its duration. */
  moveOverlayTo: (id: string, startTime: number) => void;
  removeOverlay: (id: string) => void;
  selectOverlay: (id: string | null) => void;
  setCaptionStyle: (patch: Partial<CaptionStyle>) => void;
  /** Runs client-side Whisper transcription and replaces the auto captions. */
  generateAutoCaptions: () => Promise<void>;
  /** Removes every AI-generated caption, keeping hand-made overlays. */
  clearAutoCaptions: () => void;
  /** Merges a partial colour-grading update. */
  setColorAdjustment: (patch: Partial<ColorAdjustments>) => void;
  /** Sets one colour wheel's handle position (-1..1 per axis). */
  setColorWheel: (region: keyof ColorWheels, point: WheelPoint) => void;
  /** Recentres a single colour wheel (leaves the other two untouched). */
  resetColorWheel: (region: keyof ColorWheels) => void;
  /** Restores neutral colour grading (sliders + wheels). */
  resetColorAdjustments: () => void;
  /** Decodes and appends one or more uploaded audio files. */
  addAudioFiles: (files: FileList | File[]) => Promise<void>;
  /** Decodes a recorded blob (voiceover / mic) and appends it as a track. */
  addAudioTrackFromBlob: (blob: Blob, name: string) => Promise<void>;
  updateAudioTrack: (id: string, patch: Partial<Omit<AudioTrack, "id">>) => void;
  /** Repositions an audio track along the timeline (seconds). */
  moveAudioTrackTo: (id: string, startTime: number) => void;
  removeAudioTrack: (id: string) => void;
  /** Applies a named velocity preset (scaled to the clip duration). */
  setSpeedPreset: (preset: SpeedPreset) => void;
  setSpeedPoints: (points: SpeedPoint[]) => void;
  /** Adds a keyframe; returns with points sorted by time. */
  addSpeedPoint: (point: SpeedPoint) => void;
  /** Updates a keyframe in place (index-stable, used while dragging). */
  updateSpeedPoint: (index: number, patch: Partial<SpeedPoint>) => void;
  removeSpeedPoint: (index: number) => void;
  /** Adds an effect of `type` starting at `atTime` seconds. */
  addEffect: (type: VideoEffectType, atTime: number) => void;
  updateEffect: (
    id: string,
    patch: Partial<Omit<VideoEffect, "id" | "type">>
  ) => void;
  /** Repositions an effect along the timeline (seconds). */
  moveEffectTo: (id: string, startTime: number) => void;
  removeEffect: (id: string) => void;
  clearEffects: () => void;

  /* Chroma key (green/blue screen) */
  /** Merges a chroma-key update for the active clip. */
  setChromaKey: (patch: Partial<ChromaKeySettings>) => void;
  /** Disables and resets chroma keying. */
  resetChromaKey: () => void;
  /** Toggles the program-monitor eyedropper (color picker) mode. */
  setEyedropper: (active: boolean) => void;

  /* Overlay keyframes */
  /** Records the selected overlay's current transform at the playhead. */
  addOverlayKeyframe: (overlayId?: string) => void;
  removeOverlayKeyframe: (overlayId: string, keyframeId: string) => void;
  clearOverlayKeyframes: (overlayId: string) => void;

  /* Captions */
  /** Applies a one-tap social caption preset. */
  applyCaptionPreset: (preset: CaptionPreset) => void;
  /** Builds timed caption overlays from a typed script (no server). */
  generateCaptionsFromScript: (script: string) => Promise<void>;

  /* Sound effects */
  /** Synthesizes and appends a royalty-free sound effect. */
  addSoundEffect: (id: SoundEffectId) => Promise<void>;
};

function releaseVideo(el: HTMLVideoElement | null, url: string | null): void {
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
    unmountPreviewMedia(el);
  }
  if (url) URL.revokeObjectURL(url);
}

/** True when the file looks like an importable video. */
function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
  );
}

/** Serializes the project's media metadata to IndexedDB (best-effort). */
function persistProject(state: EditorState): Promise<void> {
  if (!state.projectId) return Promise.resolve();
  const token = ++checkpointToken;
  const assetMeta: StoredAssetMeta[] = state.assets.map(
    ({ id, mediaId, name, type, size, updatedAt }) => ({
      id,
      mediaId,
      name,
      type,
      size,
      updatedAt,
    })
  );
  const audioMeta: StoredAudio[] = state.audioTracks.map(
    ({ id, mediaId, name, startTime, volume, trimStart, duration, muted, solo, fadeIn, fadeOut, synth, lane, peaks }) => ({
      id,
      mediaId,
      name,
      startTime,
      volume,
      trimStart,
      duration,
      muted,
      solo,
      fadeIn,
      fadeOut,
      synth,
      lane,
      peaks,
    })
  );
  return saveProjectMedia(state.projectId, {
    assets: assetMeta,
    sequence: state.sequence,
    overlays: state.overlays,
    audio: audioMeta,
    trackStates: state.trackStates,
    currentTime: state.currentTime,
    savedAt: Date.now(),
  })
    .then(() => {
      if (token === checkpointToken) {
        useEditorStore.setState({ saveStatus: "saved" });
      }
    })
    .catch(() => {
      // IndexedDB can fail (quota / private mode); the session still works.
      if (token === checkpointToken) {
        useEditorStore.setState({ saveStatus: "unsaved" });
      }
    });
}

/** True when the lane hosting `key` is locked (edits are blocked). */
export function isTrackLocked(state: EditorState, key: TrackKey): boolean {
  return state.trackStates[key]?.locked ?? false;
}

/**
 * Resolves the lane an audio track lives on. Legacy projects (saved before
 * lanes existed) alternate A1/A2 by index, which is how they were displayed.
 */
export function trackLane(track: AudioTrack, index: number): number {
  if (typeof track.lane === "number" && Number.isFinite(track.lane)) {
    return Math.max(0, Math.min(AUDIO_TRACK_KEYS.length - 1, Math.round(track.lane)));
  }
  return index % 2;
}

/** The next lane a newly-added track should land on (round-robin). */
function nextLaneIndex(state: EditorState): number {
  const counts = AUDIO_TRACK_KEYS.map(() => 0);
  state.audioTracks.forEach((track, index) => {
    counts[trackLane(track, index)] += 1;
  });
  let best = 0;
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i] < counts[best]) best = i;
  }
  return best;
}

/** Audio tracks with each lane's mute/solo folded in, so a lane-level M/S in the
 * timeline silences preview *and* export without touching the per-track flags.
 * A lane hidden by its eye toggle is treated as muted. */
export function effectiveAudioTracks(state: EditorState): AudioTrack[] {
  const audioSoloActive = hasActiveAudioSolo(state);
  // A V1 solo isolates the base video audio unless an audio lane/clip is
  // explicitly soloed too. This keeps V1 and A1–A3 in one routing model.
  const muteForV1Solo = state.trackStates.V1.solo && !audioSoloActive;
  return state.audioTracks.map((track, index) => {
    const lane = state.trackStates[laneKeyFor(trackLane(track, index))];
    const laneMuted = Boolean(lane?.muted) || lane?.isVisible === false;
    const laneSolo = Boolean(lane?.solo);
    if (!laneMuted && !laneSolo && !muteForV1Solo) return track;
    return {
      ...track,
      muted: track.muted || laneMuted || muteForV1Solo,
      solo: track.solo || laneSolo,
    };
  });
}

/** Whether any audible A1–A3 lane or clip is currently soloed. */
function hasActiveAudioSolo(state: EditorState): boolean {
  const laneIsSoloed = AUDIO_TRACK_KEYS.some((key) => {
    const lane = state.trackStates[key];
    return Boolean(lane?.solo) && !lane?.muted && lane?.isVisible !== false;
  });
  if (laneIsSoloed) return true;

  return state.audioTracks.some((track, index) => {
    const lane = state.trackStates[laneKeyFor(trackLane(track, index))];
    return (
      track.solo &&
      !track.muted &&
      !lane?.muted &&
      lane?.isVisible !== false
    );
  });
}

/** The single mute decision for V1's native HTMLVideoElement audio output. */
export function isBaseVideoAudioMuted(state: EditorState): boolean {
  const v1 = state.trackStates.V1;
  if (v1.muted || v1.isVisible === false) return true;
  // An audio solo excludes V1 unless V1 is also soloed.
  return !v1.solo && hasActiveAudioSolo(state);
}

/** True when the lane hosting the given audio track is locked. */
function isAudioTrackLocked(state: EditorState, trackId: string): boolean {
  const index = state.audioTracks.findIndex((track) => track.id === trackId);
  if (index < 0) return false;
  const track = state.audioTracks[index];
  return state.trackStates[laneKeyFor(trackLane(track, index))]?.locked ?? false;
}

/** Writes the current global velocity curve onto the active clip (persisted). */
function sequenceWithSpeed(state: EditorState): TimelineClip[] {
  if (!state.activeClipId) return state.sequence;
  return state.sequence.map((clip) =>
    clip.id === state.activeClipId
      ? { ...clip, speedPreset: state.speedPreset, speedPoints: state.speedPoints }
      : clip
  );
}

/** The speed state to restore when a clip is selected. */
function speedPatchForClip(clip: TimelineClip | undefined): {
  speedPreset: SpeedPreset;
  speedPoints: SpeedPoint[];
} {
  return {
    speedPreset: (clip?.speedPreset as SpeedPreset) ?? "none",
    speedPoints:
      clip?.speedPoints && clip.speedPoints.length > 0
        ? clip.speedPoints.map((point) => ({ ...point }))
        : [{ time: 0, speed: 1 }],
  };
}

/** Deep-ish snapshot of the editable state (arrays/objects are immutable in the store). */
function snapshotOf(state: EditorState): EditSnapshot {
  return {
    sequence: state.sequence,
    overlays: state.overlays,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    colorAdjustments: state.colorAdjustments,
    colorWheels: state.colorWheels,
    activeEffects: state.activeEffects,
    aspect: state.aspect,
    speedPoints: state.speedPoints,
    speedPreset: state.speedPreset,
    captionStyle: state.captionStyle,
    fit: state.fit,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    canvasFill: state.canvasFill,
    chromaKey: state.chromaKey,
    trackStates: state.trackStates,
  };
}

/** Suppresses history capture while an undo/redo is being applied. */
let historyPaused = false;

/** Monotonic checkpoint id so only the newest write may set the save status. */
let checkpointToken = 0;

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
  videoEl: null,
  videoUrl: null,
  videoFile: null,
  videoName: null,
  videoError: null,

  projectId: null,
  videoMissing: false,
  videoRestoring: false,

  assets: [],
  sequence: [],
  activeClipId: null,
  assetsLoading: false,
  pendingTrim: null,
  pendingSeek: null,
  captionLanguage: "auto",

  duration: 0,
  currentTime: 0,
  trimStart: 0,
  trimEnd: 0,
  markIn: null,
  markOut: null,
  volume: 1,
  playing: false,

  aspect: "16:9",
  fit: "contain",
  offsetX: 0,
  offsetY: 0,
  canvasFill: "black",

  overlays: [],
  selectedId: null,

  captionStyle: DEFAULT_CAPTION_STYLE,
  transcribing: false,
  transcribingProgress: 0,
  transcribingStatus: "",
  transcriptionError: null,

  fps: DEFAULT_FPS,
  hdRendering: true,
  exportResolution: "1080p",
  history: [],
  future: [],
  saveStatus: "saved",
  setSaveStatus: (status) => set({ saveStatus: status }),
  checkpoint: async () => {
    const state = get();
    if (!state.projectId) {
      set({ saveStatus: "saved" });
      return;
    }
    await persistProject(state);
  },
  colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,
  colorWheels: DEFAULT_COLOR_WHEELS,
  audioTracks: [],
  audioTrackError: null,
  trackStates: defaultTrackStates(),

  setTrackFlag: (key, field, value) =>
    set((state) => {
      const current = state.trackStates[key] ?? { ...DEFAULT_TRACK_STATE };
      const next = { ...current, [field]: value ?? !current[field] };
      return { trackStates: { ...state.trackStates, [key]: next } };
    }),

  splitClip: (clipId, sourceTime) => {
    const { sequence, trackStates } = get();
    if (trackStates.V1.locked) return;
    const index = sequence.findIndex((clip) => clip.id === clipId);
    if (index < 0) return;
    const clip = sequence[index];
    const at = Math.min(
      Math.max(sourceTime, clip.trimStart + 0.05),
      clip.trimEnd - 0.05
    );
    if (at <= clip.trimStart + 0.01 || at >= clip.trimEnd - 0.01) return;
    const start = computeClipStarts(sequence)[index]?.start ?? 0;
    const first: TimelineClip = { ...clip, trimEnd: at };
    const second: TimelineClip = {
      id: createId("clip"),
      assetId: clip.assetId,
      trimStart: at,
      trimEnd: clip.trimEnd,
      // Keep the cut halves touching even when the source clip was free-placed.
      timelineStart: start + (at - clip.trimStart),
      ...(clip.chromaKey ? { chromaKey: clip.chromaKey } : {}),
      ...(clip.speedPreset ? { speedPreset: clip.speedPreset } : {}),
      ...(clip.speedPoints ? { speedPoints: clip.speedPoints } : {}),
    };
    const next = [
      ...sequence.slice(0, index),
      first,
      second,
      ...sequence.slice(index + 1),
    ];
    set({
      sequence: next,
      // Re-index captions across the cut so each half keeps its own words.
      overlays: splitCaptionsAt(get().overlays, at),
      activeClipId: second.id,
      trimStart: second.trimStart,
      trimEnd: second.trimEnd,
      pendingTrim: { trimStart: second.trimStart, trimEnd: second.trimEnd },
      ...speedPatchForClip(second),
    });
    persistProject(get());
  },

  rippleDeleteClip: (clipId) => {
    const { sequence, trackStates } = get();
    if (trackStates.V1.locked) return;
    const blocks = computeClipStarts(sequence);
    const index = blocks.findIndex((block) => block.clip.id === clipId);
    if (index < 0) return;
    const removed = blocks[index];
    const next = blocks
      .filter((_, i) => i !== index)
      .map((block, i) => {
        // Everything after the cut slides left to close the gap.
        if (i < index) return block.clip;
        return {
          ...block.clip,
          timelineStart: Math.max(0, block.start - removed.dur),
        };
      });
    set({ sequence: next });
    persistProject(get());
    if (get().activeClipId === clipId) {
      const fallback = next[Math.min(index, next.length - 1)];
      if (fallback) get().selectClip(fallback.id);
      else get().removeClip(clipId);
    }
  },

  deleteTranscriptRange: (from, to) => {
    const state = get();
    if (state.trackStates.V1.locked) return;
    const { sequence, activeClipId } = state;
    if (!activeClipId) return;
    const index = sequence.findIndex((clip) => clip.id === activeClipId);
    if (index < 0) return;
    const clip = sequence[index];

    const cutFrom = Math.min(Math.max(from, clip.trimStart), clip.trimEnd);
    const cutTo = Math.min(Math.max(to, cutFrom), clip.trimEnd);
    const cut = cutTo - cutFrom;
    if (cut < 0.05) return;

    const blockStart = computeClipStarts(sequence)[index]?.start ?? 0;
    // Ripple time-mapping: anything after the cut slides left by `cut`, and
    // anything inside the cut collapses onto its start.
    const mapTime = (t: number) =>
      t <= cutFrom ? t : t >= cutTo ? t - cut : cutFrom;

    // --- 1. Split the clip around the deleted words -------------------
    const head: TimelineClip | null =
      cutFrom > clip.trimStart + 0.05 ? { ...clip, trimEnd: cutFrom } : null;
    const tail: TimelineClip | null =
      clip.trimEnd > cutTo + 0.05
        ? {
            id: createId("clip"),
            assetId: clip.assetId,
            trimStart: cutTo,
            trimEnd: clip.trimEnd,
            timelineStart: blockStart + Math.max(0, cutFrom - clip.trimStart),
            ...(clip.chromaKey ? { chromaKey: clip.chromaKey } : {}),
            ...(clip.speedPreset ? { speedPreset: clip.speedPreset } : {}),
            ...(clip.speedPoints ? { speedPoints: clip.speedPoints } : {}),
          }
        : null;

    const removedEnd = blockStart + (cutTo - clip.trimStart);
    const next = [
      ...sequence.slice(0, index),
      ...(head ? [head] : []),
      ...(tail ? [tail] : []),
      ...sequence.slice(index + 1),
    ].map((item) => {
      if (item === head || (tail && item.id === tail.id)) return item;
      // Free-positioned clips sitting after the cut slide left to close the gap.
      if (
        typeof item.timelineStart === "number" &&
        item.timelineStart >= removedEnd - 0.001
      ) {
        return { ...item, timelineStart: Math.max(0, item.timelineStart - cut) };
      }
      return item;
    });

    // --- 2. Re-time captions, overlays, effects and audio -------------
    const overlays: TextOverlay[] = [];
    for (const overlay of state.overlays) {
      const startTime = mapTime(overlay.startTime);
      const endTime = mapTime(overlay.endTime);
      if (endTime - startTime < 0.05) continue;

      let words = overlay.words;
      let text = overlay.text;
      if (words && words.length > 0) {
        // Keep only the surviving words and rebuild the text so the renderer's
        // word-count guard still matches.
        const survivors = words
          .map((word) => ({
            text: word.text,
            start: mapTime(word.start),
            end: mapTime(word.end),
          }))
          .filter((word) => word.end - word.start > 0.001);
        if (survivors.length === 0) continue;
        words = survivors;
        text = survivors.map((word) => word.text).join(" ");
      }

      overlays.push({ ...overlay, startTime, endTime, words, text });
    }

    const activeEffects = state.activeEffects.map((effect) => {
      const startTime = mapTime(effect.startTime);
      const end = mapTime(effect.startTime + effect.duration);
      return { ...effect, startTime, duration: Math.max(0.1, end - startTime) };
    });

    const audioTracks = state.audioTracks
      .map((track) => {
        const startTime = mapTime(track.startTime);
        const end = mapTime(track.startTime + track.duration);
        return { ...track, startTime, duration: Math.max(0, end - startTime) };
      })
      .filter((track) => track.duration > 0.05);

    set({
      sequence: next,
      overlays,
      activeEffects,
      audioTracks,
      currentTime: mapTime(state.currentTime),
    });
    persistProject(get());

    // Reload a surviving clip so the preview reflects the cut immediately and
    // the playhead lands where the gap closed up.
    const resumeId =
      tail?.id ?? head?.id ?? next[Math.min(index, next.length - 1)]?.id;
    const resumeTarget = next.find((item) => item.id === resumeId);
    const resumeAsset = resumeTarget
      ? get().assets.find((asset) => asset.id === resumeTarget.assetId)
      : undefined;
    if (resumeTarget && resumeAsset) {
      const at = Math.min(
        Math.max(mapTime(state.currentTime), resumeTarget.trimStart),
        resumeTarget.trimEnd
      );
      set({
        activeClipId: resumeTarget.id,
        pendingTrim: {
          trimStart: resumeTarget.trimStart,
          trimEnd: resumeTarget.trimEnd,
        },
        pendingSeek: at,
        chromaKey: resumeTarget.chromaKey ?? DEFAULT_CHROMA_KEY,
        ...speedPatchForClip(resumeTarget),
      });
      get().loadVideoBlob(resumeAsset.blob, resumeAsset.name);
    }
  },

  speedPreset: "none",
  speedPoints: [{ time: 0, speed: 1 }],
  activeEffects: [],
  chromaKey: DEFAULT_CHROMA_KEY,
  eyedropper: false,

  loadVideo: (file) => {
    const isVideo =
      file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!isVideo) {
      set({ videoError: "Please choose an MP4 or WebM video file." });
      return;
    }

    // Persist the raw bytes so the source survives reloads and tab closes.
    const projectId = get().projectId;
    if (projectId) {
      void saveVideoSource(projectId, file, file.name).catch(() => {
        // IndexedDB can fail (quota, private mode); playback still works now.
      });
    }

    set({
      activeClipId: null,
      speedPreset: "none",
      speedPoints: [{ time: 0, speed: 1 }],
    });
    get().loadVideoBlob(file, file.name);
  },

  loadVideoBlob: (blob, name, options) => {
    const autoplay = options?.autoplay ?? false;
    // Release the previous source before swapping in the new one.
    const previous = get();
    releaseVideo(previous.videoEl, previous.videoUrl);
    set({
      videoEl: null,
      videoUrl: null,
      videoFile: null,
      videoName: null,
      videoError: null,
      videoMissing: false,
      duration: 0,
      currentTime: 0,
      trimStart: 0,
      trimEnd: 0,
      markIn: null,
      markOut: null,
      playing: false,
      transcribing: false,
      transcribingProgress: 0,
      transcribingStatus: "",
      transcriptionError: null,
    });

    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.preload = "auto";
    el.playsInline = true;
    el.muted = false;
    // Set a known audible default before applying the editor's volume control.
    el.volume = 1;
    el.src = url;
    el.volume = get().volume;
    mountPreviewMedia(el);

    // One-shot source recovery for browser-throttling / eviction failures.
    let recovering = false;
    let sourceRecovered = false;
    const recoverSource = async (): Promise<boolean> => {
      if (get().videoEl !== el) return false;
      const state = get();
      const clip = state.activeClipId
        ? state.sequence.find((item) => item.id === state.activeClipId)
        : undefined;
      const asset = clip
        ? state.assets.find((item) => item.id === clip.assetId)
        : undefined;
      let fresh: Blob | null = blob instanceof Blob ? blob : null;
      if (asset?.blob instanceof Blob) fresh = asset.blob;
      if (!fresh && asset) {
        try {
          fresh = await getMediaFile(asset.mediaId);
        } catch {
          fresh = null;
        }
      }
      if (!fresh || get().videoEl !== el) return false;

      const resumeAt = state.currentTime;
      const wasPlaying = state.playing;
      const nextUrl = URL.createObjectURL(fresh);
      const previousUrl = get().videoUrl;
      el.addEventListener(
        "loadedmetadata",
        () => {
          if (get().videoEl !== el) return;
          const max = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : resumeAt;
          try {
            el.currentTime = Math.min(Math.max(resumeAt, 0), max);
          } catch {
            // Not seekable yet; the preview loop settles it.
          }
          if (wasPlaying) void el.play().catch(() => {});
        },
        { once: true }
      );
      el.src = nextUrl;
      el.load();
      set({ videoUrl: nextUrl, videoError: null });
      if (previousUrl && previousUrl !== nextUrl) URL.revokeObjectURL(previousUrl);
      return true;
    };

    const applyDuration = (value: number) => {
      if (get().videoEl !== el) return;
      // Prefer the active clip's stored velocity curve so custom keyframes
      // survive clip switches / loops (and persist in the sequence).
      const activeClip = get().activeClipId
        ? get().sequence.find((item) => item.id === get().activeClipId)
        : undefined;
      const preset = ((activeClip?.speedPreset as SpeedPreset) ??
        get().speedPreset) as SpeedPreset;
      const sourcePoints = activeClip?.speedPoints ?? get().speedPoints;
      const speedPoints =
        preset === "none"
          ? [{ time: 0, speed: 1 }]
          : preset === "custom"
            ? normalizeSpeedPoints(sourcePoints).map((point) => ({
                ...point,
                time: Math.min(point.time, value),
              }))
            : buildSpeedPreset(preset, value);
      // Restore a clip's saved trims when re-selecting it; otherwise default
      // to the full range.
      const pending = get().pendingTrim;
      const trimStart = pending
        ? Math.min(Math.max(pending.trimStart, 0), value)
        : 0;
      const trimEnd = pending
        ? Math.min(Math.max(pending.trimEnd, trimStart + 0.1), value)
        : value;
      // A timeline scrub queues a source time to land on once metadata loads.
      const pendingSeek = get().pendingSeek;
      const seekTo =
        pendingSeek !== null
          ? Math.min(Math.max(pendingSeek, trimStart), trimEnd)
          : 0;
      set({
        duration: value,
        trimStart,
        trimEnd,
        currentTime: seekTo,
        pendingTrim: null,
        pendingSeek: null,
        speedPreset: preset,
        speedPoints,
      });
      if (seekTo > 0) {
        try {
          el.currentTime = seekTo;
        } catch {
          // Element not seekable yet; the next frame will settle.
        }
      }
      const activeId = get().activeClipId;
      if (activeId) get().setClipTrim(activeId, { trimStart, trimEnd });
    };

    el.addEventListener("loadedmetadata", () => {
      if (get().videoEl !== el) return;

      if (Number.isFinite(el.duration) && el.duration > 0) {
        applyDuration(el.duration);
        return;
      }

      // Some WebM files (e.g. MediaRecorder/screen-recording output) omit
      // duration metadata and report Infinity. Seeking far past the end
      // forces the browser to scan the file and fire durationchange with
      // the real duration.
      const resolveDuration = () => {
        if (get().videoEl !== el) return;
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.removeEventListener("durationchange", resolveDuration);
          el.currentTime = 0;
          applyDuration(el.duration);
        }
      };
      el.addEventListener("durationchange", resolveDuration);
      el.currentTime = 1e101;
    });

    el.addEventListener("ended", () => {
      if (get().videoEl !== el) return;
      // Keep `playing` true so the preview loop can advance to the next clip
      // (or loop / stop) — the loop owns the boundary decision.
      set({ currentTime: el.currentTime });
    });

    el.addEventListener("error", () => {
      if (get().videoEl !== el) return;
      // The browser can drop a backgrounded element's source. Rebuild it once
      // from the live asset blob (or IndexedDB) instead of failing outright.
      if (recovering || sourceRecovered) {
        set({
          playing: false,
          videoError: "This video could not be decoded by your browser.",
        });
        return;
      }
      recovering = true;
      void recoverSource()
        .then((ok) => {
          sourceRecovered = ok;
          recovering = false;
          if (!ok && get().videoEl === el) {
            set({
              playing: false,
              videoError: "This video could not be decoded by your browser.",
            });
          }
        })
        .catch(() => {
          recovering = false;
          if (get().videoEl === el) {
            set({
              playing: false,
              videoError: "This video could not be decoded by your browser.",
            });
          }
        });
    });

    const file =
      blob instanceof File
        ? blob
        : new File([blob], name, { type: blob.type || "video/mp4" });

    set({
      videoEl: el,
      videoUrl: url,
      videoFile: file,
      videoName: name,
      videoMissing: false,
    });

    if (autoplay) {
      set({ playing: true });
      el.addEventListener("canplay", () => {
        if (get().videoEl !== el || !get().playing) return;
        void el.play().catch(() => {
          if (get().videoEl === el) set({ playing: false });
        });
      });
    }
  },

  restoreVideo: async (projectId) => {
    if (!projectId) return;

    const current = get();
    if (current.projectId === projectId && current.videoEl) return;
    // Switching projects: drop the previous project's in-memory source.
    if (current.projectId !== projectId) {
      get().resetEditor();
    }

    set({ projectId, videoRestoring: true, videoMissing: false });

    try {
      const stored = await loadVideoSource(projectId);
      if (get().projectId !== projectId) return; // navigated away mid-load
      if (stored) {
        get().loadVideoBlob(stored.blob, stored.name);
        set({ videoRestoring: false });
      } else {
        set({ videoRestoring: false, videoMissing: true });
      }
    } catch {
      set({ videoRestoring: false, videoMissing: true });
    }
  },

  setCaptionLanguage: (language) => set({ captionLanguage: language }),

  loadProjectMedia: async (projectId) => {
    set({ projectId, assetsLoading: true });
    try {
      const media = await loadProjectMedia(projectId);
      if (get().projectId !== projectId) return;

      // Rehydrate asset blobs from media storage (migrating legacy inline blobs).
      const assets: VideoAsset[] = [];
      for (const raw of media.assets as (StoredAssetMeta & { blob?: Blob })[]) {
        let mediaId = raw.mediaId;
        let blob: Blob | null = raw.blob ?? null;
        if (!blob && mediaId) blob = await getMediaFile(mediaId);
        if (!blob) continue; // binary missing → drop the asset
        if (!mediaId) {
          mediaId = newMediaId();
          try {
            await saveMediaFile(mediaId, blob);
          } catch {
            // ignore
          }
        }
        assets.push({
          id: raw.id,
          mediaId,
          name: raw.name,
          type: raw.type,
          size: raw.size,
          updatedAt: raw.updatedAt,
          blob,
        });
      }

      const assetIds = new Set(assets.map((asset) => asset.id));
      // Free timeline positions are preserved (clips may overlap on a track).
      const sequence = media.sequence.filter((clip) => assetIds.has(clip.assetId));
      const overlays = (media.overlays as TextOverlay[]).filter(Boolean);

      // Rehydrate audio tracks (fetch + decode).
      const audioTracks: AudioTrack[] = [];
      for (const raw of media.audio) {
        const blob = await getMediaFile(raw.mediaId);
        if (!blob) continue;
        const file =
          blob instanceof File
            ? blob
            : new File([blob], raw.name, { type: blob.type || "audio/mpeg" });
        let buffer: AudioBuffer | null = null;
        try {
          const { decodeAudioFile } = await import("@/lib/audio");
          buffer = (await decodeAudioFile(file))?.buffer ?? null;
        } catch {
          buffer = null;
        }
        audioTracks.push({
          id: raw.id,
          mediaId: raw.mediaId,
          name: raw.name,
          url: URL.createObjectURL(blob),
          file,
          buffer,
          startTime: raw.startTime,
          volume: raw.volume,
          trimStart: raw.trimStart,
          duration: raw.duration,
          muted: raw.muted ?? false,
          solo: raw.solo ?? false,
          fadeIn: raw.fadeIn ?? 0,
          fadeOut: raw.fadeOut ?? 0,
          synth: raw.synth,
          lane: raw.lane,
          // Reuse persisted peaks; otherwise rebuild them from the decoded PCM.
          peaks:
            raw.peaks && raw.peaks.length > 0
              ? raw.peaks
              : computeWaveformPeaks(buffer),
        });
      }

      set({
        assets,
        sequence,
        overlays,
        audioTracks,
        trackStates: normalizeTrackStates(media.trackStates),
        assetsLoading: false,
      });

      const firstClip = sequence[0];
      const asset = firstClip
        ? assets.find((item) => item.id === firstClip.assetId)
        : undefined;
      if (firstClip && asset) {
        // Crash recovery: resume at the last checkpointed playhead when it
        // still falls inside the restored clip.
        const resumeAt =
          typeof media.currentTime === "number" && media.currentTime > 0
            ? Math.min(
                Math.max(media.currentTime, firstClip.trimStart),
                firstClip.trimEnd
              )
            : null;
        set({
          activeClipId: firstClip.id,
          pendingTrim: {
            trimStart: firstClip.trimStart,
            trimEnd: firstClip.trimEnd,
          },
          pendingSeek: resumeAt,
          chromaKey: firstClip.chromaKey ?? DEFAULT_CHROMA_KEY,
          ...speedPatchForClip(firstClip),
        });
        get().loadVideoBlob(asset.blob, asset.name);
        return;
      }
      if (assets.length === 0) set({ videoMissing: true });
    } catch {
      set({ assetsLoading: false, videoMissing: true });
    }
  },

  addVideoAssets: async (files) => {
    const list = Array.from(files).filter(isVideoFile);
    if (list.length === 0) {
      set({ videoError: "Please choose MP4 or WebM video files." });
      return;
    }

    const assets = [...get().assets];
    const sequence = [...get().sequence];
    const newClips: TimelineClip[] = [];
    for (const file of list) {
      const mediaId = newMediaId();
      try {
        await saveMediaFile(mediaId, file);
      } catch {
        // Storage can fail (quota / private mode); the session still works.
      }
      const asset: VideoAsset = {
        id: createId("asset"),
        mediaId,
        name: file.name,
        type: file.type || "video/mp4",
        size: file.size,
        updatedAt: Date.now(),
        blob: file,
      };
      assets.push(asset);
      const clip: TimelineClip = {
        id: createId("clip"),
        assetId: asset.id,
        trimStart: 0,
        trimEnd: 0,
      };
      sequence.push(clip);
      newClips.push(clip);
    }

    set({ assets, sequence, videoError: null });
    persistProject(get());

    const firstClip = newClips[0];
    const firstAsset = assets.find((asset) => asset.id === firstClip.assetId);
    if (firstAsset) {
      set({
        activeClipId: firstClip.id,
        pendingTrim: null,
        pendingSeek: null,
        chromaKey: DEFAULT_CHROMA_KEY,
        ...speedPatchForClip(firstClip),
      });
      get().loadVideoBlob(firstAsset.blob, firstAsset.name);
    }
  },

  removeAsset: (assetId) => {
    const removed = get().assets.find((asset) => asset.id === assetId);
    if (removed) void deleteMediaFile(removed.mediaId);
    const assets = get().assets.filter((asset) => asset.id !== assetId);
    const sequence = get().sequence.filter((clip) => clip.assetId !== assetId);
    set({ assets, sequence });
    persistProject(get());

    const activeGone =
      !get().activeClipId ||
      !sequence.some((clip) => clip.id === get().activeClipId);
    if (activeGone && get().activeClipId) {
      const { videoEl, videoUrl } = get();
      releaseVideo(videoEl, videoUrl);
      set({
        videoEl: null,
        videoUrl: null,
        videoFile: null,
        videoName: null,
        activeClipId: null,
        pendingTrim: null,
        duration: 0,
        currentTime: 0,
        trimStart: 0,
        trimEnd: 0,
        playing: false,
        videoMissing: sequence.length === 0,
      });
      const next = sequence[0];
      if (next) get().selectClip(next.id);
    }
  },

  selectClip: (clipId) => {
    const clip = get().sequence.find((item) => item.id === clipId);
    if (!clip) return;
    const asset = get().assets.find((item) => item.id === clip.assetId);
    if (!asset) return;
    set({
      activeClipId: clipId,
      pendingTrim: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
      pendingSeek: null,
      chromaKey: clip.chromaKey ?? DEFAULT_CHROMA_KEY,
      ...speedPatchForClip(clip),
    });
    get().loadVideoBlob(asset.blob, asset.name);
  },

  scrubTo: (clipId, sourceTime) => {
    const clip = get().sequence.find((item) => item.id === clipId);
    if (!clip) return;
    const time = Math.min(Math.max(sourceTime, clip.trimStart), clip.trimEnd);
    const active = get().activeClipId;
    const el = get().videoEl;

    // Same clip: seek directly when the element is ready, otherwise queue it.
    if (clipId === active) {
      if (el && el.readyState >= 1) get().seek(time);
      else set({ pendingSeek: time });
      return;
    }

    // Different clip: swap the source and land on `time` once it loads.
    const asset = get().assets.find((item) => item.id === clip.assetId);
    if (!asset) return;
    set({
      activeClipId: clipId,
      pendingTrim: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
      pendingSeek: time,
      chromaKey: clip.chromaKey ?? DEFAULT_CHROMA_KEY,
      ...speedPatchForClip(clip),
    });
    get().loadVideoBlob(asset.blob, asset.name);
  },

  advanceClip: (wrap = false) => {
    const { sequence, activeClipId } = get();
    if (sequence.length === 0) return false;
    // Order by absolute timeline position so playback follows the visual order
    // even when clips have been dragged around (overlaps included).
    const ordered = computeClipStarts(sequence).sort((a, b) => a.start - b.start);
    const index = ordered.findIndex((entry) => entry.clip.id === activeClipId);
    let next: TimelineClip | undefined;
    if (index >= 0 && index + 1 < ordered.length) next = ordered[index + 1].clip;
    else if (wrap) next = ordered[0].clip;
    // Single-clip wrap loops in place; the preview loop handles it.
    if (!next || next.id === activeClipId) return false;
    const asset = get().assets.find((item) => item.id === next.assetId);
    if (!asset) return false;
    set({
      activeClipId: next.id,
      pendingTrim: { trimStart: next.trimStart, trimEnd: next.trimEnd },
      pendingSeek: next.trimStart,
      chromaKey: next.chromaKey ?? DEFAULT_CHROMA_KEY,
    });
    // Autoplay so the sequence keeps rolling from one clip into the next.
    get().loadVideoBlob(asset.blob, asset.name, { autoplay: true });
    return true;
  },

  removeClip: (clipId) => {
    if (get().trackStates.V1.locked) return;
    const sequence = get().sequence.filter((clip) => clip.id !== clipId);
    set({ sequence });
    // Garbage-collect assets whose clips are all gone (frees media storage).
    const used = new Set(sequence.map((clip) => clip.assetId));
    const orphaned = get().assets.filter((asset) => !used.has(asset.id));
    if (orphaned.length > 0) {
      for (const asset of orphaned) void deleteMediaFile(asset.mediaId);
      set({ assets: get().assets.filter((asset) => used.has(asset.id)) });
    }
    persistProject(get());

    if (get().activeClipId === clipId) {
      const { videoEl, videoUrl } = get();
      releaseVideo(videoEl, videoUrl);
      set({
        videoEl: null,
        videoUrl: null,
        videoFile: null,
        videoName: null,
        activeClipId: null,
        pendingTrim: null,
        duration: 0,
        currentTime: 0,
        trimStart: 0,
        trimEnd: 0,
        playing: false,
        videoMissing: sequence.length === 0,
      });
      const next = sequence[0];
      if (next) get().selectClip(next.id);
    }
  },

  moveClip: (clipId, direction) => {
    const sequence = [...get().sequence];
    const index = sequence.findIndex((clip) => clip.id === clipId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sequence.length) return;
    const [clip] = sequence.splice(index, 1);
    sequence.splice(target, 0, clip);
    set({ sequence });
    persistProject(get());
  },

  moveClipTo: (clipId, timelineStart) => {
    if (get().trackStates.V1.locked) return;
    set({
      sequence: get().sequence.map((clip) =>
        clip.id === clipId
          ? { ...clip, timelineStart: Math.max(0, timelineStart) }
          : clip
      ),
    });
    persistProject(get());
  },

  reorderClip: (clipId, toIndex) => {
    const sequence = get().sequence.slice();
    const from = sequence.findIndex((clip) => clip.id === clipId);
    if (from < 0) return;
    const [clip] = sequence.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, sequence.length));
    if (clamped === from) return;
    sequence.splice(clamped, 0, clip);
    // Reordering re-flows the timeline: drop stale free-position offsets so the
    // array order *is* the play order.
    const normalized = sequence.map((item) => {
      const copy = { ...item };
      delete copy.timelineStart;
      return copy;
    });
    set({ sequence: normalized });
    persistProject(get());
  },

  setClipTrim: (clipId, patch) => {
    if (get().trackStates.V1.locked) return;
    const sequence = get().sequence.map((clip) => {
      if (clip.id !== clipId) return clip;
      const next = { ...clip, ...patch };
      next.trimStart = Math.max(0, next.trimStart);
      if (!(next.trimEnd > next.trimStart + 0.05)) {
        // Keep a minimum span, honouring whichever edge was just moved.
        if (patch.trimEnd !== undefined) next.trimEnd = next.trimStart + 0.1;
        else next.trimStart = Math.max(0, next.trimEnd - 0.1);
      }
      return next;
    });
    // Keep AI captions locked to the active clip's new in/out window.
    const trimmed = sequence.find((clip) => clip.id === clipId);
    const isActive = get().activeClipId === clipId;
    set({
      sequence,
      ...(isActive && trimmed
        ? {
            overlays: clampCaptionsToClipWindow(
              get().overlays,
              trimmed.trimStart,
              trimmed.trimEnd
            ),
          }
        : {}),
    });
    persistProject(get());
  },

  setClipTransformAtPlayhead: (clipId, patch) => {
    if (get().trackStates.V1.locked) return;
    const state = get();
    const clip = state.sequence.find((item) => item.id === clipId);
    if (!clip) return;
    const time = clipId === state.activeClipId ? state.currentTime : clip.trimStart;
    const animated = (clip.transformKeyframes?.length ?? 0) > 0;

    if (!animated) {
      const transform = { ...DEFAULT_CLIP_TRANSFORM, ...(clip.transform ?? {}), ...patch };
      set({
        sequence: state.sequence.map((item) =>
          item.id === clipId ? { ...item, transform } : item
        ),
      });
      persistProject(get());
      return;
    }

    // Auto-key: merge into the keyframe at (or nearest) the playhead.
    const pose = { ...resolveClipTransform(clip, time), ...patch };
    const frames = [...(clip.transformKeyframes ?? [])];
    const existingIndex = frames.findIndex((frame) => Math.abs(frame.time - time) <= 0.03);
    if (existingIndex >= 0) {
      frames[existingIndex] = { ...frames[existingIndex], ...pose };
    } else {
      frames.push({ id: createId("ckf"), time, ...pose });
      frames.sort((a, b) => a.time - b.time);
    }
    set({
      sequence: state.sequence.map((item) =>
        item.id === clipId ? { ...item, transformKeyframes: frames } : item
      ),
    });
    persistProject(get());
  },

  addClipTransformKeyframe: (clipId) => {
    if (get().trackStates.V1.locked) return;
    const state = get();
    const clip = state.sequence.find((item) => item.id === clipId);
    if (!clip) return;
    const time = clipId === state.activeClipId ? state.currentTime : clip.trimStart;
    // Capture the *current* pose so un-keyed properties are preserved.
    const pose = resolveClipTransform(clip, time);
    const frames = [
      ...(clip.transformKeyframes ?? []).filter(
        (frame) => Math.abs(frame.time - time) > 0.03
      ),
      { id: createId("ckf"), time, ...pose },
    ].sort((a, b) => a.time - b.time);
    set({
      sequence: state.sequence.map((item) =>
        item.id === clipId ? { ...item, transformKeyframes: frames } : item
      ),
    });
    persistProject(get());
  },

  removeClipTransformKeyframe: (clipId, keyframeId) => {
    const state = get();
    set({
      sequence: state.sequence.map((item) =>
        item.id === clipId
          ? {
              ...item,
              transformKeyframes: (item.transformKeyframes ?? []).filter(
                (frame) => frame.id !== keyframeId
              ),
            }
          : item
      ),
    });
    persistProject(get());
  },

  clearClipTransformKeyframes: (clipId) => {
    const state = get();
    set({
      sequence: state.sequence.map((item) =>
        item.id === clipId ? { ...item, transformKeyframes: [] } : item
      ),
    });
    persistProject(get());
  },

  setClipTransition: (clipId, type, duration) => {
    set({
      sequence: get().sequence.map((clip) => {
        if (clip.id !== clipId) return clip;
        if (!type) {
          const rest = { ...clip };
          delete rest.transitionIn;
          return rest;
        }
        const preset = TRANSITION_PRESETS.find((item) => item.id === type);
        return {
          ...clip,
          transitionIn: {
            type,
            duration: Math.max(0.1, duration ?? preset?.duration ?? 0.5),
          },
        };
      }),
    });
    persistProject(get());
  },

  restoreEdit: (snapshot) =>
    set({
      sequence: snapshot.sequence,
      overlays: snapshot.overlays,
      trimStart: snapshot.trimStart,
      trimEnd: snapshot.trimEnd,
      colorAdjustments: snapshot.colorAdjustments,
      colorWheels: snapshot.colorWheels,
      activeEffects: snapshot.activeEffects,
      aspect: snapshot.aspect,
      speedPoints: snapshot.speedPoints,
      speedPreset: snapshot.speedPreset,
      captionStyle: snapshot.captionStyle,
      fit: snapshot.fit,
      offsetX: snapshot.offsetX,
      offsetY: snapshot.offsetY,
      canvasFill: snapshot.canvasFill,
      chromaKey: snapshot.chromaKey,
      trackStates: snapshot.trackStates,
    }),

  undo: () => {
    const { history, future } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const current = snapshotOf(get());
    historyPaused = true;
    set({ history: history.slice(0, -1), future: [...future, current] });
    get().restoreEdit(previous);
    historyPaused = false;
  },

  redo: () => {
    const { history, future } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = snapshotOf(get());
    historyPaused = true;
    set({ future: future.slice(0, -1), history: [...history, current] });
    get().restoreEdit(next);
    historyPaused = false;
  },

  splitActiveClip: () => {
    const { activeClipId, currentTime } = get();
    if (!activeClipId) return;
    get().splitClip(activeClipId, currentTime);
  },

  duplicateActiveClip: () => {
    if (get().trackStates.V1.locked) return;
    const { activeClipId, sequence } = get();
    if (!activeClipId) return;
    const index = sequence.findIndex((clip) => clip.id === activeClipId);
    if (index < 0) return;
    const clip = sequence[index];
    const copy: TimelineClip = {
      id: createId("clip"),
      assetId: clip.assetId,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
    };
    const next = [
      ...sequence.slice(0, index + 1),
      copy,
      ...sequence.slice(index + 1),
    ];
    set({ sequence: next, activeClipId: copy.id });
    persistProject(get());
  },

  resetEditor: () => {
    const { videoEl, videoUrl, audioTracks } = get();
    releaseVideo(videoEl, videoUrl);
    for (const track of audioTracks) URL.revokeObjectURL(track.url);
    audioPreview.stop();

    set({
      videoEl: null,
      videoUrl: null,
      videoFile: null,
      videoName: null,
      videoError: null,
      projectId: null,
      videoMissing: false,
      videoRestoring: false,
      assets: [],
      sequence: [],
      activeClipId: null,
      assetsLoading: false,
      pendingTrim: null,
      pendingSeek: null,
      captionLanguage: "auto",
      duration: 0,
      currentTime: 0,
      trimStart: 0,
      trimEnd: 0,
      markIn: null,
      markOut: null,
      playing: false,
      aspect: "16:9",
      fit: "contain",
      offsetX: 0,
      offsetY: 0,
      canvasFill: "black",
      overlays: [],
      selectedId: null,
      captionStyle: DEFAULT_CAPTION_STYLE,
      transcribing: false,
      transcribingProgress: 0,
      transcribingStatus: "",
      transcriptionError: null,
      fps: DEFAULT_FPS,
      hdRendering: true,
      history: [],
      future: [],
      colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,
      colorWheels: DEFAULT_COLOR_WHEELS,
      audioTracks: [],
      audioTrackError: null,
      trackStates: defaultTrackStates(),
      speedPreset: "none",
      speedPoints: [{ time: 0, speed: 1 }],
      activeEffects: [],
      chromaKey: DEFAULT_CHROMA_KEY,
      eyedropper: false,
    });
  },

  seek: (time) => {
    const { videoEl, duration } = get();
    const clamped = Math.min(Math.max(time, 0), duration || Number.MAX_SAFE_INTEGER);
    if (videoEl) videoEl.currentTime = clamped;
    set({ currentTime: clamped });
  },

  stepFrame: (delta) => {
    const { currentTime, duration, fps } = get();
    const safeFps = fps > 0 ? fps : DEFAULT_FPS;
    const lastFrame = duration > 0 ? Math.round(duration * safeFps) : Number.MAX_SAFE_INTEGER;
    // Snap to the frame grid so repeated steps never drift.
    const frame = Math.min(Math.max(Math.round(currentTime * safeFps) + delta, 0), lastFrame);
    get().seek(frame / safeFps);
  },

  setPlaying: (playing) => {
    const { videoEl } = get();
    if (!videoEl) return;

    if (playing) {
      // This runs in the Play-click call stack, which is the reliable moment
      // to unlock Web Audio and start every HTML audio track under autoplay
      // policy. The rAF loop then only keeps the already-started media synced.
      unlockAudio();
      set({ playing: true });
      // Route the element's audio through the Web Audio graph (gain node) so it
      // plays to the speakers while its frames are drawn to the canvas.
      applyElementAudio(videoEl, isBaseVideoAudioMuted(get()), get().volume);
      audioPreview.sync(effectiveAudioTracks(get()), videoEl.currentTime, true);
      videoEl.play().catch(() => {
        if (get().videoEl === videoEl) set({ playing: false });
      });
    } else {
      videoEl.pause();
      audioPreview.sync(effectiveAudioTracks(get()), videoEl.currentTime, false);
      set({ playing: false, currentTime: videoEl.currentTime });
    }
  },

  setVolume: (volume) => {
    const clamped = Math.min(Math.max(volume, 0), 1);
    const { videoEl } = get();
    if (videoEl) videoEl.volume = clamped;
    set({ volume: clamped });
  },

  setTrimStart: (time) => {
    const { trimEnd, duration, videoEl } = get();
    const max = Math.max(0, Math.min(trimEnd - 0.1, duration || trimEnd));
    const next = Math.min(Math.max(time, 0), max);
    set({ trimStart: next });
    // Bring the playhead up to the new in-point so the trimmed head is visible.
    if (videoEl && videoEl.currentTime < next) {
      videoEl.currentTime = next;
      set({ currentTime: next });
    }
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimStart: next });
  },

  setTrimEnd: (time) => {
    const { trimStart, duration, videoEl } = get();
    if (duration <= 0) return;
    const min = Math.min(Math.max(trimStart + 0.1, 0), duration);
    const next = Math.max(Math.min(time, duration), min);
    set({ trimEnd: next });
    // If the out-point was pulled before the playhead, snap it back so the
    // preview never renders past the trimmed endpoint.
    if (videoEl && videoEl.currentTime > next) {
      videoEl.currentTime = next;
      set({ currentTime: next });
    }
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimEnd: next });
  },

  resetTrim: () => {
    const { duration } = get();
    set({ trimStart: 0, trimEnd: duration });
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimStart: 0, trimEnd: duration });
  },

  setMarkIn: (time) => {
    const { duration, markOut } = get();
    const upper = markOut !== null ? markOut : duration || time;
    set({ markIn: Math.min(Math.max(time, 0), upper) });
  },

  setMarkOut: (time) => {
    const { duration, markIn } = get();
    const lower = markIn !== null ? markIn : 0;
    set({ markOut: Math.max(Math.min(time, duration || time), lower) });
  },

  clearMarks: () => set({ markIn: null, markOut: null }),

  setAspect: (aspect) => set({ aspect }),

  setHdRendering: (enabled) => set({ hdRendering: enabled }),

  setExportResolution: (id) => set({ exportResolution: id }),

  setFit: (fit) => set({ fit, offsetX: fit === "contain" ? 0 : get().offsetX, offsetY: fit === "contain" ? 0 : get().offsetY }),

  setOffset: (x, y) =>
    set({
      offsetX: Math.min(Math.max(x, -100), 100),
      offsetY: Math.min(Math.max(y, -100), 100),
    }),

  setCanvasFill: (fill) => set({ canvasFill: fill }),

  addOverlay: () => {
    const overlay = createOverlay(get().duration);
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  addTextSticker: (text, fontSize = 120) => {
    const overlay: TextOverlay = {
      ...createOverlay(get().duration),
      text,
      fontSize,
      x: 50,
      y: 50,
      padding: 0,
      bgColor: "",
    };
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  addStickerImage: (src) => {
    const overlay: TextOverlay = {
      ...createOverlay(get().duration),
      text: "",
      imageSrc: src,
      x: 50,
      y: 50,
    };
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  addImageOverlay: (src, duration = 0) => {
    const overlay: TextOverlay = {
      ...createOverlay(duration),
      text: "",
      imageSrc: src,
    };
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  updateOverlay: (id, patch) =>
    set({
      overlays: get().overlays.map((overlay) =>
        overlay.id === id ? { ...overlay, ...patch } : overlay
      ),
    }),

  setOverlayStartTime: (id, time) => {
    if (get().trackStates.V2.locked) return;
    const { overlays, duration } = get();
    const overlay = overlays.find((item) => item.id === id);
    if (!overlay) return;
    // The start can never pass the end (or the video's duration).
    const upper = duration > 0 ? Math.min(duration, overlay.endTime) : overlay.endTime;
    const startTime = snapTime(time, 0, upper);
    if (startTime === overlay.startTime) return;
    set({
      overlays: overlays.map((item) =>
        item.id === id ? { ...item, startTime } : item
      ),
    });
  },

  setOverlayEndTime: (id, time) => {
    if (get().trackStates.V2.locked) return;
    const { overlays, duration } = get();
    const overlay = overlays.find((item) => item.id === id);
    if (!overlay) return;
    const upper = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const endTime = snapTime(time, overlay.startTime, upper);
    if (endTime === overlay.endTime) return;
    set({
      overlays: overlays.map((item) =>
        item.id === id ? { ...item, endTime } : item
      ),
    });
  },

  moveOverlayTo: (id, startTime) => {
    if (get().trackStates.V2.locked) return;
    const { overlays, duration } = get();
    const overlay = overlays.find((item) => item.id === id);
    if (!overlay) return;
    const span = Math.max(0.1, overlay.endTime - overlay.startTime);
    const upper = duration > 0 ? Math.max(0, duration - span) : Number.MAX_SAFE_INTEGER;
    const start = Math.min(Math.max(startTime, 0), upper);
    set({
      overlays: overlays.map((item) =>
        item.id === id ? { ...item, startTime: start, endTime: start + span } : item
      ),
    });
  },

  removeOverlay: (id) => {
    if (get().trackStates.V2.locked) return;
    set({
      overlays: get().overlays.filter((overlay) => overlay.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },

  selectOverlay: (id) => set({ selectedId: id }),

  setCaptionStyle: (patch) =>
    set({ captionStyle: { ...get().captionStyle, ...patch } }),

  generateAutoCaptions: async () => {
    const { videoFile, transcribing } = get();
    if (!videoFile) {
      set({ transcriptionError: "Import a video before generating captions." });
      return;
    }
    if (transcribing) return;

    set({
      transcribing: true,
      transcribingProgress: 0,
      transcribingStatus: "Preparing audio…",
      transcriptionError: null,
    });

    try {
      // Loaded on demand so the large WASM runtime never ships in the
      // initial editor bundle, and never touches the server.
      const { transcribeVideoFile } = await import("@/lib/transcribe");
      const { buildAutoCaptions } = await import("@/lib/captions");

      const words = await transcribeVideoFile(videoFile, {
        language: get().captionLanguage,
        onProgress: (status, progress) =>
          set({
            transcribingStatus: status,
            transcribingProgress: Math.round(progress),
          }),
      });

      if (words.length === 0) {
        set({
          transcribing: false,
          transcribingProgress: 0,
          transcribingStatus: "",
          transcriptionError: "No speech was detected in this video.",
        });
        return;
      }

      const captions = buildAutoCaptions(words, {
        duration: get().duration,
        aspect: get().aspect,
      });

      set({
        overlays: [...get().overlays.filter((overlay) => !overlay.auto), ...captions],
        selectedId: captions[0]?.id ?? get().selectedId,
        transcribing: false,
        transcribingProgress: 100,
        transcribingStatus: "",
        transcriptionError: null,
      });
    } catch (error) {
      set({
        transcribing: false,
        transcribingProgress: 0,
        transcribingStatus: "",
        transcriptionError:
          error instanceof Error
            ? error.message
            : "Transcription failed in this browser.",
      });
    }
  },

  clearAutoCaptions: () => {
    const { overlays, selectedId } = get();
    const selected = overlays.find((overlay) => overlay.id === selectedId);
    set({
      overlays: overlays.filter((overlay) => !overlay.auto),
      selectedId: selected?.auto ? null : selectedId,
    });
  },

  setColorAdjustment: (patch) =>
    set({ colorAdjustments: { ...get().colorAdjustments, ...patch } }),

  setColorWheel: (region, point) => {
    const clampAxis = (value: number | undefined) =>
      value === undefined ? undefined : Math.min(Math.max(value, -100), 100);
    const current = get().colorWheels[region];
    set({
      colorWheels: {
        ...get().colorWheels,
        [region]: {
          // Merge so dragging the puck keeps the trim values (and vice versa).
          ...current,
          x: Math.min(Math.max(point.x, -1), 1),
          y: Math.min(Math.max(point.y, -1), 1),
          r: clampAxis(point.r ?? current.r),
          g: clampAxis(point.g ?? current.g),
          b: clampAxis(point.b ?? current.b),
          lum: clampAxis(point.lum ?? current.lum),
          sat: clampAxis(point.sat ?? current.sat),
        },
      },
    });
  },

  resetColorWheel: (region) =>
    set({
      colorWheels: {
        ...get().colorWheels,
        // Replace (not merge) so any legacy trims are cleared too.
        [region]: { x: 0, y: 0 },
      },
    }),

  resetColorAdjustments: () =>
    set({
      colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,
      colorWheels: DEFAULT_COLOR_WHEELS,
    }),

  addAudioFiles: async (files) => {
    const list = Array.from(files).filter(
      (file) =>
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|m4a|aac|ogg|oga|flac|webm)$/i.test(file.name)
    );
    if (list.length === 0) {
      set({ audioTrackError: "Please choose an MP3 or WAV audio file." });
      return;
    }

    try {
      const { decodeAudioFile } = await import("@/lib/audio");
      for (const file of list) {
        const mediaId = newMediaId();
        try {
          await saveMediaFile(mediaId, file);
        } catch {
          // ignore
        }
        const url = URL.createObjectURL(file);
        const decoded = await decodeAudioFile(file);
        const track: AudioTrack = {
          id: createId("audio"),
          mediaId,
          name: file.name,
          url,
          file,
          buffer: decoded?.buffer ?? null,
          startTime: 0,
          volume: 1,
          trimStart: 0,
          duration: decoded?.duration ?? 0,
          muted: false,
          solo: false,
          fadeIn: 0,
          fadeOut: 0,
          lane: nextLaneIndex(get()),
          peaks: computeWaveformPeaks(decoded?.buffer),
        };
        set({ audioTracks: [...get().audioTracks, track], audioTrackError: null });
      }
    } catch (error) {
      set({
        audioTrackError:
          error instanceof Error
            ? error.message
            : "That audio file could not be decoded.",
      });
    }
  },

  addAudioTrackFromBlob: async (blob, name) => {
    try {
      const { decodeAudioFile } = await import("@/lib/audio");
      const mediaId = newMediaId();
      try {
        await saveMediaFile(mediaId, blob);
      } catch {
        // Storage can fail; playback still works this session.
      }
      const url = URL.createObjectURL(blob);
      const file =
        blob instanceof File
          ? blob
          : new File([blob], name, { type: blob.type || "audio/webm" });
      const decoded = await decodeAudioFile(file);
      const track: AudioTrack = {
        id: createId("audio"),
        mediaId,
        name,
        url,
        file,
        buffer: decoded?.buffer ?? null,
        startTime: get().currentTime,
        volume: 1,
        trimStart: 0,
        duration: decoded?.duration ?? 0,
        muted: false,
        solo: false,
        fadeIn: 0,
        fadeOut: 0,
        // Voiceovers land on A2 by default.
        lane: 1,
        peaks: computeWaveformPeaks(decoded?.buffer),
      };
      set({ audioTracks: [...get().audioTracks, track], audioTrackError: null });
    } catch (error) {
      set({
        audioTrackError:
          error instanceof Error
            ? error.message
            : "That recording could not be decoded.",
      });
    }
  },

  updateAudioTrack: (id, patch) => {
    // A locked lane keeps its position/size; volume, fades and mute/solo are fine.
    if (
      isAudioTrackLocked(get(), id) &&
      ("trimStart" in patch || "duration" in patch)
    ) {
      return;
    }
    set({
      audioTracks: get().audioTracks.map((track) => {
        if (track.id !== id) return track;
        const next = { ...track, ...patch };
        const maxDuration = track.buffer ? track.buffer.duration : track.duration;
        next.trimStart = Math.min(Math.max(next.trimStart, 0), Math.max(0, maxDuration - 0.05));
        next.volume = Math.min(Math.max(next.volume, 0), 1);
        next.startTime = Math.max(0, next.startTime);
        next.duration = Math.min(Math.max(next.duration, 0), Math.max(0, maxDuration - next.trimStart));
        next.fadeIn = Math.max(0, Math.min(next.fadeIn ?? 0, next.duration));
        next.fadeOut = Math.max(0, Math.min(next.fadeOut ?? 0, next.duration));
        return next;
      }),
    });
  },

  moveAudioTrackTo: (id, startTime) => {
    if (isAudioTrackLocked(get(), id)) return;
    set({
      audioTracks: get().audioTracks.map((track) =>
        track.id === id ? { ...track, startTime: Math.max(0, startTime) } : track
      ),
    });
  },

  removeAudioTrack: (id) => {
    if (isAudioTrackLocked(get(), id)) return;
    const track = get().audioTracks.find((item) => item.id === id);
    if (track) {
      URL.revokeObjectURL(track.url);
      void deleteMediaFile(track.mediaId);
    }
    set({ audioTracks: get().audioTracks.filter((item) => item.id !== id) });
  },

  setSpeedPreset: (preset) => {
    if (preset === "custom") {
      set({ speedPreset: preset });
    } else {
      set({
        speedPreset: preset,
        speedPoints: buildSpeedPreset(preset, get().duration),
      });
    }
    // Mirror the curve onto the active clip so it persists with the project.
    set({ sequence: sequenceWithSpeed(get()) });
  },

  setSpeedPoints: (points) => {
    set({ speedPoints: normalizeSpeedPoints(points), speedPreset: "custom" });
    set({ sequence: sequenceWithSpeed(get()) });
  },

  addSpeedPoint: (point) => {
    const points = [...get().speedPoints, point].sort((a, b) => a.time - b.time);
    set({ speedPoints: normalizeSpeedPoints(points), speedPreset: "custom" });
    set({ sequence: sequenceWithSpeed(get()) });
  },

  updateSpeedPoint: (index, patch) => {
    const points = get().speedPoints.slice();
    const current = points[index];
    if (!current) return;
    const next = {
      time: current.time,
      speed: clampSpeed(current.speed),
      ...patch,
    };
    next.speed = clampSpeed(next.speed);
    // Keep points ordered: a keyframe may not cross its neighbours.
    const lower = index > 0 ? points[index - 1].time + 0.001 : 0;
    const upper =
      index < points.length - 1
        ? points[index + 1].time - 0.001
        : Number.MAX_SAFE_INTEGER;
    next.time = Math.min(Math.max(next.time, lower), Math.max(lower, upper));
    points[index] = next;
    set({ speedPoints: points, speedPreset: "custom" });
    set({ sequence: sequenceWithSpeed(get()) });
  },

  removeSpeedPoint: (index) => {
    const points = get().speedPoints.filter((_, i) => i !== index);
    set({
      speedPoints: points.length > 0 ? points : [{ time: 0, speed: 1 }],
      speedPreset: "custom",
    });
    set({ sequence: sequenceWithSpeed(get()) });
  },

  addEffect: (type, atTime) => {
    const preset = EFFECT_DEFAULTS[type];
    const duration = get().duration;
    const startTime =
      duration > 0 ? Math.min(Math.max(0, atTime), Math.max(0, duration - 0.05)) : Math.max(0, atTime);
    const effect: VideoEffect = {
      id: createId("fx"),
      type,
      startTime,
      duration: preset.duration,
      intensity: preset.intensity,
    };
    set({ activeEffects: [...get().activeEffects, effect] });
  },

  updateEffect: (id, patch) => {
    // Locked V3 still allows value tweaks; timing edits are blocked.
    if (
      get().trackStates.V3.locked &&
      ("startTime" in patch || "duration" in patch)
    ) {
      return;
    }
    set({
      activeEffects: get().activeEffects.map((effect) =>
        effect.id === id ? { ...effect, ...patch } : effect
      ),
    });
  },

  moveEffectTo: (id, startTime) => {
    if (get().trackStates.V3.locked) return;
    const { activeEffects, duration } = get();
    set({
      activeEffects: activeEffects.map((effect) => {
        if (effect.id !== id) return effect;
        const upper =
          duration > 0
            ? Math.max(0, duration - effect.duration)
            : Number.MAX_SAFE_INTEGER;
        return { ...effect, startTime: Math.min(Math.max(startTime, 0), upper) };
      }),
    });
  },

  removeEffect: (id) => {
    if (get().trackStates.V3.locked) return;
    set({
      activeEffects: get().activeEffects.filter((effect) => effect.id !== id),
    });
  },

  clearEffects: () => set({ activeEffects: [] }),

  setChromaKey: (patch) => {
    const next = { ...get().chromaKey, ...patch };
    set({ chromaKey: next });
    const id = get().activeClipId;
    if (id) {
      set({
        sequence: get().sequence.map((clip) =>
          clip.id === id ? { ...clip, chromaKey: next } : clip
        ),
      });
      persistProject(get());
    }
  },

  resetChromaKey: () => get().setChromaKey({ ...DEFAULT_CHROMA_KEY }),

  setEyedropper: (active) => set({ eyedropper: active }),

  addOverlayKeyframe: (overlayId) => {
    const id = overlayId ?? get().selectedId;
    if (!id) return;
    const overlay = get().overlays.find((item) => item.id === id);
    if (!overlay) return;
    const time = get().currentTime;
    // Preserve the *current animated* pose instead of resetting un-keyed props.
    const pose = overlayPoseAt(overlay, time);
    const keyframe: OverlayKeyframe = {
      id: createId("kf"),
      time,
      scale: pose.scale,
      x: pose.x,
      y: pose.y,
      opacity: pose.opacity,
      rotation: pose.rotation,
    };
    // Replace any existing keyframe at (nearly) the same time.
    const existing = (overlay.keyframes ?? []).filter(
      (frame) => Math.abs(frame.time - time) > 0.05
    );
    const keyframes = [...existing, keyframe].sort((a, b) => a.time - b.time);
    set({
      overlays: get().overlays.map((item) =>
        item.id === id ? { ...item, keyframes } : item
      ),
      selectedId: id,
    });
  },

  removeOverlayKeyframe: (overlayId, keyframeId) =>
    set({
      overlays: get().overlays.map((item) =>
        item.id === overlayId
          ? {
              ...item,
              keyframes: (item.keyframes ?? []).filter(
                (frame) => frame.id !== keyframeId
              ),
            }
          : item
      ),
    }),

  clearOverlayKeyframes: (overlayId) =>
    set({
      overlays: get().overlays.map((item) =>
        item.id === overlayId ? { ...item, keyframes: [] } : item
      ),
    }),

  applyCaptionPreset: (preset) => {
    const def = CAPTION_PRESETS.find((item) => item.id === preset);
    if (!def) return;
    set({
      captionStyle: {
        ...get().captionStyle,
        preset: def.id,
        animation: def.animation,
        activeWordHighlight: def.activeWordHighlight,
        textStroke: def.textStroke,
        highlightColor: def.highlightColor,
      },
    });
    // Restyle the generated captions to match the chosen look (manual overlays
    // are left untouched so multiple independent captions can coexist).
    set({
      overlays: get().overlays.map((overlay) =>
        overlay.auto
          ? {
              ...overlay,
              animation: def.animation,
              fillColor: def.fillColor,
              bgColor: def.bgColor,
              padding: def.padding,
              radius: def.radius,
            }
          : overlay
      ),
    });
  },

  generateCaptionsFromScript: async (script) => {
    const trimmed = script.trim();
    if (!trimmed) {
      set({ transcriptionError: "Type or dictate a script first." });
      return;
    }
    const { buildScriptCaptions } = await import("@/lib/captions");
    const captions = buildScriptCaptions(trimmed, {
      duration: get().duration,
      aspect: get().aspect,
    }).map((caption) => ({ ...caption, auto: false }));
    if (captions.length === 0) return;
    // Append independent captions — never replace the existing ones.
    set({
      overlays: [...get().overlays, ...captions],
      selectedId: captions[0]?.id ?? get().selectedId,
      transcriptionError: null,
    });
  },

  addSoundEffect: async (id) => {
    const spec = SOUND_EFFECTS.find((effect) => effect.id === id);
    const rendered = await renderSoundEffect(id);
    if (!rendered) {
      set({ audioTrackError: "Sound effects are not supported in this browser." });
      return;
    }
    const mediaId = newMediaId();
    try {
      await saveMediaFile(mediaId, rendered.blob);
    } catch {
      // Storage can fail (quota / private mode); playback still works now.
    }
    const url = URL.createObjectURL(rendered.blob);
    const file = new File([rendered.blob], `${id}.wav`, { type: "audio/wav" });
    const track: AudioTrack = {
      id: createId("sfx"),
      mediaId,
      name: spec?.label ?? id,
      url,
      file,
      buffer: rendered.buffer,
      startTime: get().currentTime,
      volume: 1,
      trimStart: 0,
      duration: rendered.buffer.duration,
      muted: false,
      solo: false,
      fadeIn: 0.01,
      fadeOut: 0.12,
      synth: true,
      lane: nextLaneIndex(get()),
      peaks: computeWaveformPeaks(rendered.buffer),
    };
    set({ audioTracks: [...get().audioTracks, track], audioTrackError: null });
  },
  })),
);

/**
 * Auto-capture an undo snapshot whenever any editable field changes. The
 * selector shape mirrors {@link EditSnapshot}, so `previous` is exactly the
 * state to restore on undo.
 */
useEditorStore.subscribe(
  (state) => ({
    sequence: state.sequence,
    overlays: state.overlays,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    colorAdjustments: state.colorAdjustments,
    colorWheels: state.colorWheels,
    activeEffects: state.activeEffects,
    aspect: state.aspect,
    speedPoints: state.speedPoints,
    speedPreset: state.speedPreset,
    captionStyle: state.captionStyle,
    fit: state.fit,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    canvasFill: state.canvasFill,
    chromaKey: state.chromaKey,
    trackStates: state.trackStates,
  }),
  (_current, previous) => {
    if (historyPaused) return;
    useEditorStore.setState((state) => {
      const history = [...state.history, previous as EditSnapshot];
      if (history.length > 500) history.shift();
      return { history, future: [] };
    });
  },
  { equalityFn: shallow }
);

/**
 * Persist the project's media metadata whenever assets / sequence / overlays /
 * audio change. `projectId` is intentionally excluded so loading a project
 * (which sets `projectId` before the data arrives) can never wipe storage.
 */
useEditorStore.subscribe(
  (state) => ({
    assets: state.assets,
    sequence: state.sequence,
    overlays: state.overlays,
    audioTracks: state.audioTracks,
    trackStates: state.trackStates,
  }),
  () => {
    // Mark dirty only — the debounced autosave hook (plus the 60s heartbeat)
    // performs the actual write so rapid drags don't hammer IndexedDB.
    if (!historyPaused) useEditorStore.setState({ saveStatus: "unsaved" });
  },
  { equalityFn: shallow }
);
