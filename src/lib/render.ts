import type {
  AspectRatio,
  CaptionAnimation,
  CaptionStyle,
  ChromaKeySettings,
  ColorAdjustments,
  OverlayKeyframe,
  SpeedPoint,
  TextOverlay,
  VideoEffect,
} from "@/store/editor";
import {
  clampSpeed,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_COLOR_ADJUSTMENTS,
} from "@/store/editor";
import type { TransitionType } from "@/lib/video-storage";

/** Target output resolution for each supported aspect ratio (1080p-class). */
export const ASPECT_RESOLUTIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "21:9": { width: 2560, height: 1080 },
};

export type SceneConfig = {
  width: number;
  height: number;
  /** `contain` letterboxes the video, `cover` fills and crops it. */
  fit: "contain" | "cover";
  /** Horizontal pan, -100..100 (only meaningful when cropping). */
  offsetX: number;
  /** Vertical pan, -100..100 (only meaningful when cropping). */
  offsetY: number;
  overlays: TextOverlay[];
  /**
   * Timeline position (seconds) of the frame being drawn. Overlays only
   * render between their startTime and endTime.
   */
  sceneTime: number;
  /**
   * Word-highlight / animation styling for AI captions. Falls back to the
   * default style when omitted.
   */
  captionStyle?: CaptionStyle;
  /**
   * Colour grading applied to the video frame (before overlays are drawn).
   * Falls back to neutral when omitted.
   */
  colorAdjustments?: ColorAdjustments;
  /**
   * Use high-quality (crisp) canvas scaling. Defaults to `true`.
   */
  crisp?: boolean;
  /**
   * Timed visual effects (zoom, shake, flash, vignette) composited over the
   * frame. Applied when `sceneTime` falls inside an effect's window.
   */
  activeEffects?: VideoEffect[];
  /**
   * Source-video out-point (seconds). When set, the video frame is never drawn
   * past this time — the canvas stays black — so a clip's trimmed endpoint is
   * respected even if playback overshoots by a frame.
   */
  clipEnd?: number;
  /**
   * Chroma-key (green/blue screen) settings. When enabled, matching pixels are
   * made transparent before the frame is composited.
   */
  chromaKey?: ChromaKeySettings;
  /**
   * Background fill for letterboxed / mismatched media. `blur` paints a
   * blurred, cover-scaled copy of the frame behind the contained video.
   */
  canvasFill?: "black" | "blur";
  /**
   * Cross-clip transition frame. When present, `fromVideo` (the outgoing clip)
   * is composited with the main video according to `type` and `progress`.
   */
  transition?: {
    type: TransitionType;
    /** 0..1 across the transition window. */
    progress: number;
    fromVideo: HTMLVideoElement;
  };
};

/** Per-frame overlay transform resolved from its keyframes (or its base pose). */
export type OverlayTransform = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Resolves an overlay's animated transform at `sceneTime`, linearly
 * interpolating between adjacent keyframes (clamped outside the range).
 */
export function resolveOverlayTransform(
  overlay: TextOverlay,
  sceneTime: number
): OverlayTransform {
  const base: OverlayTransform = {
    x: overlay.x,
    y: overlay.y,
    scale: 1,
    opacity: overlay.opacity,
    rotation: overlay.rotation,
  };
  const keyframes = overlay.keyframes;
  if (!keyframes || keyframes.length === 0) return base;

  const pose = (frame: OverlayKeyframe): OverlayTransform => ({
    x: frame.x,
    y: frame.y,
    scale: frame.scale,
    opacity: frame.opacity,
    rotation: frame.rotation,
  });

  if (sceneTime <= keyframes[0].time) return pose(keyframes[0]);
  const last = keyframes[keyframes.length - 1];
  if (sceneTime >= last.time) return pose(last);

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (sceneTime >= a.time && sceneTime <= b.time) {
      const span = b.time - a.time;
      const t = span <= 0 ? 0 : (sceneTime - a.time) / span;
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        scale: lerp(a.scale, b.scale, t),
        opacity: lerp(a.opacity, b.opacity, t),
        rotation: lerp(a.rotation, b.rotation, t),
      };
    }
  }
  return base;
}

/**
 * Instantaneous playback speed for a source time, linearly interpolated
 * between keyframes and clamped to the first/last keyframe outside the range.
 */
export function speedAt(points: SpeedPoint[], time: number): number {
  if (!points || points.length === 0) return 1;
  const first = points[0];
  if (time <= first.time) return clampSpeed(first.speed);
  const last = points[points.length - 1];
  if (time >= last.time) return clampSpeed(last.speed);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      if (span <= 0) return clampSpeed(b.speed);
      const t = (time - a.time) / span;
      return clampSpeed(a.speed + (b.speed - a.speed) * t);
    }
  }
  return clampSpeed(last.speed);
}

/** True when the curve deviates from 1× anywhere. */
export function isSpeedRamped(points: SpeedPoint[]): boolean {
  return points.some((point) => Math.abs(point.speed - 1) > 1e-3);
}

/**
 * Integrates the velocity curve to get the source-video position for every
 * output frame. Output frame `i` lands at `result[i]`; the video plays that
 * source time at a constant `fps`, so the resulting MP4 shows the ramp.
 */
export function computeSourceFrameTimes(
  points: SpeedPoint[],
  trimStart: number,
  trimEnd: number,
  fps: number
): number[] {
  const safeFps = fps > 0 ? fps : 30;
  const dt = 1 / safeFps;
  const span = Math.max(0, trimEnd - trimStart);
  if (span <= 0) return [];

  const times: number[] = [];
  // Guard: the slowest supported speed (0.2×) produces 5× the frames.
  const maxFrames = Math.ceil(span * safeFps * 5) + safeFps;
  let t = trimStart;
  while (t < trimEnd - 1e-6 && times.length < maxFrames) {
    times.push(t);
    t += speedAt(points, t) * dt;
  }
  if (times.length === 0) times.push(trimStart);
  return times;
}

export type EffectFrame = {
  scale: number;
  offsetX: number;
  offsetY: number;
  blur: number;
  flashAlpha: number;
  vignetteAlpha: number;
};

/** Resolves all active effects at `sceneTime` into one compositing frame. */
export function computeEffectFrame(
  effects: VideoEffect[],
  sceneTime: number
): EffectFrame {
  const frame: EffectFrame = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    flashAlpha: 0,
    vignetteAlpha: 0,
  };

  for (const effect of effects) {
    const end = effect.startTime + effect.duration;
    if (sceneTime < effect.startTime || sceneTime > end) continue;
    const progress =
      effect.duration > 0
        ? Math.min(1, Math.max(0, (sceneTime - effect.startTime) / effect.duration))
        : 1;
    const intensity = Math.min(Math.max(effect.intensity, 0), 1);

    switch (effect.type) {
      case "zoom-in":
        frame.scale *= 1 + 0.35 * intensity * easeInOut(progress);
        break;
      case "zoom-out":
        frame.scale *= 1 + 0.35 * intensity * easeInOut(1 - progress);
        break;
      case "camera-shake": {
        const amplitude = 26 * intensity;
        const seed = sceneTime * 60;
        frame.offsetX +=
          (Math.sin(seed * 12.9898) + Math.sin(seed * 4.1414) * 0.5) * amplitude;
        frame.offsetY +=
          (Math.cos(seed * 7.233) + Math.cos(seed * 2.718) * 0.5) * amplitude;
        break;
      }
      case "flash":
        frame.flashAlpha = Math.min(
          1,
          frame.flashAlpha + intensity * Math.pow(1 - progress, 2)
        );
        break;
      case "blur-vignette": {
        const envelope = Math.sin(Math.PI * progress);
        frame.blur = Math.max(frame.blur, 8 * intensity * envelope);
        frame.vignetteAlpha = Math.min(
          1,
          frame.vignetteAlpha + intensity * 0.85 * envelope
        );
        break;
      }
    }
  }

  frame.scale = Math.max(0.1, frame.scale);
  return frame;
}

function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/**
 * Builds the canvas `filter` string for a set of colour adjustments, plus an
 * optional extra blur (from the Blur Vignette effect). Returns `"none"` when
 * everything is neutral.
 */
export function buildCanvasFilter(
  adjustments: ColorAdjustments,
  extraBlur = 0
): string {
  const { brightness, exposure, contrast, saturation, hue, tint, blur } = adjustments;
  const totalBlur = blur + extraBlur;
  if (
    brightness === 0 &&
    exposure === 0 &&
    contrast === 0 &&
    saturation === 0 &&
    hue === 0 &&
    tint === 0 &&
    totalBlur <= 0
  ) {
    return "none";
  }
  const parts = [
    // Exposure and brightness both lift luminance (exposure weighted heavier).
    `brightness(${Math.max(0, 100 + brightness + exposure * 1.5)}%)`,
    `contrast(${Math.max(0, 100 + contrast)}%)`,
    `saturate(${Math.max(0, 100 + saturation)}%)`,
  ];
  // Temperature (hue) and tint both fold into a single hue rotation.
  const hueShift = hue + tint * 0.5;
  if (hueShift !== 0) parts.push(`hue-rotate(${hueShift}deg)`);
  if (totalBlur > 0) parts.push(`blur(${totalBlur.toFixed(2)}px)`);
  return parts.join(" ");
}

/**
 * Draws one full scene frame: black canvas background, the video frame at the
 * configured fit/offset, then every text overlay. Used by both the preview
 * rAF loop and the export pipeline, so preview and output stay pixel-identical.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  config: SceneConfig,
  options: { placeholder?: boolean } = {}
): void {
  const { width, height } = config;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const effects = config.activeEffects ?? [];
  const fx = effects.length > 0 ? computeEffectFrame(effects, config.sceneTime) : null;

  // Camera transform (zoom + shake) moves the video *and* the overlays so the
  // whole frame feels like a camera move.
  ctx.save();
  if (fx && (fx.scale !== 1 || fx.offsetX !== 0 || fx.offsetY !== 0)) {
    ctx.translate(width / 2 + fx.offsetX, height / 2 + fx.offsetY);
    ctx.scale(fx.scale, fx.scale);
    ctx.translate(-width / 2, -height / 2);
  }

  const pastOutPoint =
    typeof config.clipEnd === "number" && config.sceneTime > config.clipEnd + 0.02;

  if (video && video.videoWidth > 0 && video.videoHeight > 0 && !pastOutPoint) {
    // High-quality scaling keeps the frame sharp when up/down-scaled.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = config.crisp === false ? "low" : "high";

    // Blurred background fill behind letterboxed / mismatched media.
    if (config.canvasFill === "blur" && !config.transition) {
      drawBlurBackground(ctx, video, config);
    }

    const filter = buildCanvasFilter(
      config.colorAdjustments ?? DEFAULT_COLOR_ADJUSTMENTS,
      fx?.blur ?? 0
    );
    if (filter !== "none") ctx.filter = filter;
    if (config.transition) {
      drawTransition(ctx, config, video);
    } else {
      drawVideoFrame(ctx, video, config);
    }
    // Reset so captions/overlays are never colour-graded.
    if (filter !== "none") ctx.filter = "none";
  } else if (options.placeholder && !pastOutPoint) {
    drawPlaceholder(ctx, width, height);
  }

  for (const overlay of config.overlays) {
    if (config.sceneTime < overlay.startTime || config.sceneTime > overlay.endTime) {
      continue;
    }
    drawOverlay(
      ctx,
      overlay,
      width,
      height,
      config.sceneTime,
      config.captionStyle ?? DEFAULT_CAPTION_STYLE
    );
  }

  ctx.restore();

  // Full-frame overlays sit outside the camera transform.
  if (fx && fx.flashAlpha > 0.001) {
    ctx.fillStyle = `rgba(255, 255, 255, ${fx.flashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (fx && fx.vignetteAlpha > 0.001) {
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.hypot(width, height) / 2;
    const inner = outer * 0.45;
    const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, `rgba(0, 0, 0, ${fx.vignetteAlpha.toFixed(3)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/** Maximum pan distance (px) that keeps the video covering the canvas. */
function panRange(drawW: number, drawH: number, canvasW: number, canvasH: number) {
  return {
    x: Math.max(0, (drawW - canvasW) / 2),
    y: Math.max(0, (drawH - canvasH) / 2),
  };
}

/** Draws a video frame with an optional alpha / zoom / x-offset transform. */
function drawFrameTransformed(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: SceneConfig,
  opts: { alpha?: number; zoom?: number; offsetXRatio?: number } = {}
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return;
  const { width, height, fit, offsetX, offsetY } = config;
  const baseScale =
    fit === "contain" ? Math.min(width / vw, height / vh) : Math.max(width / vw, height / vh);
  const scale = baseScale * (opts.zoom ?? 1);
  const drawW = vw * scale;
  const drawH = vh * scale;

  const range = panRange(drawW, drawH, width, height);
  const x = (width - drawW) / 2 + (offsetX / 100) * range.x + (opts.offsetXRatio ?? 0) * width;
  const y = (height - drawH) / 2 + (offsetY / 100) * range.y;

  ctx.save();
  if (opts.alpha !== undefined) {
    ctx.globalAlpha *= Math.max(0, Math.min(1, opts.alpha));
  }
  const source =
    config.chromaKey?.enabled ? keyedVideoFrame(video, config.chromaKey) : video;
  ctx.drawImage(source, x, y, drawW, drawH);
  ctx.restore();
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: SceneConfig
): void {
  drawFrameTransformed(ctx, video, config);
}

/** Paints a blurred, cover-scaled copy of the frame to fill letterbox bars. */
function drawBlurBackground(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: SceneConfig
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return;
  const { width, height } = config;
  const scale = Math.max(width / vw, height / vh) * 1.15;
  const w = vw * scale;
  const h = vh * scale;
  ctx.save();
  ctx.filter = "blur(20px) brightness(0.7)";
  ctx.drawImage(video, (width - w) / 2, (height - h) / 2, w, h);
  ctx.restore();
}

/** Composites a cross-clip transition between the outgoing and incoming clip. */
function drawTransition(
  ctx: CanvasRenderingContext2D,
  config: SceneConfig,
  toVideo: HTMLVideoElement
): void {
  const transition = config.transition;
  if (!transition) return;
  const from = transition.fromVideo;
  const p = Math.max(0, Math.min(1, transition.progress));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, config.width, config.height);
  ctx.clip();

  switch (transition.type) {
    case "crossDissolve":
      drawFrameTransformed(ctx, from, config, { alpha: 1 - p });
      drawFrameTransformed(ctx, toVideo, config, { alpha: p });
      break;
    case "dipToBlack":
      if (p < 0.5) drawFrameTransformed(ctx, from, config, { alpha: 1 - p * 2 });
      else drawFrameTransformed(ctx, toVideo, config, { alpha: (p - 0.5) * 2 });
      break;
    case "whipPan":
      drawFrameTransformed(ctx, from, config, { alpha: 1, offsetXRatio: -p });
      drawFrameTransformed(ctx, toVideo, config, { alpha: 1, offsetXRatio: 1 - p });
      break;
    case "glitchCut": {
      const showTo = p >= 0.5;
      const jitter = (Math.random() - 0.5) * 0.04;
      drawFrameTransformed(ctx, showTo ? toVideo : from, config, {
        alpha: 1,
        offsetXRatio: jitter,
      });
      break;
    }
    case "zoomIn":
      drawFrameTransformed(ctx, from, config, { alpha: 1 - p, zoom: 1 + p * 0.5 });
      drawFrameTransformed(ctx, toVideo, config, { alpha: p, zoom: 1.5 - p * 0.5 });
      break;
  }
  ctx.restore();
}

/** Parses a `#rgb`/`#rrggbb` hex color into 0..255 channels. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = (hex || "#00ff00").replace("#", "").trim();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.padEnd(6, "0").slice(0, 6);
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return { r: 0, g: 255, b: 0 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

let chromaCanvas: HTMLCanvasElement | null = null;
let chromaCtx: CanvasRenderingContext2D | null = null;

function getChromaContext(
  width: number,
  height: number
): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!chromaCanvas) {
    chromaCanvas = document.createElement("canvas");
    chromaCtx = chromaCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!chromaCtx) return null;
  if (chromaCanvas.width !== width) chromaCanvas.width = width;
  if (chromaCanvas.height !== height) chromaCanvas.height = height;
  return chromaCtx;
}

/**
 * Samples the video frame, makes pixels close to the key color transparent
 * (with soft edge feathering) and returns the cutout canvas. Runs entirely on
 * the client — no GPU/shaders and no server round-trip.
 */
function keyedVideoFrame(
  video: HTMLVideoElement,
  chroma: ChromaKeySettings
): CanvasImageSource {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return video;
  const ctx = getChromaContext(vw, vh);
  if (!ctx) return video;

  ctx.clearRect(0, 0, vw, vh);
  ctx.drawImage(video, 0, 0, vw, vh);
  const image = ctx.getImageData(0, 0, vw, vh);
  const { data } = image;
  const key = hexToRgb(chroma.color);
  const maxDist = Math.sqrt(3) * 255;
  const tolerance = (Math.min(Math.max(chroma.tolerance, 0), 100) / 100) * maxDist;
  const feather = Math.min(Math.max(chroma.feather, 0), 100) / 100;
  const inner = tolerance * (1 - feather * 0.85);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dr = data[i] - key.r;
    const dg = data[i + 1] - key.g;
    const db = data[i + 2] - key.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= inner) {
      data[i + 3] = 0;
    } else if (tolerance > inner && dist < tolerance) {
      data[i + 3] = data[i + 3] * ((dist - inner) / (tolerance - inner));
    }
  }
  ctx.putImageData(image, 0, 0);
  return chromaCanvas as HTMLCanvasElement;
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.fillStyle = "#52525b";
  ctx.font = `${Math.round(Math.min(width, height) * 0.045)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Import a video to start", width / 2, height / 2);
}

type LayoutWord = { text: string; width: number; wordIndex: number };
type LayoutLine = { words: LayoutWord[]; width: number };

/** Cache of decoded overlay bitmaps (keyed by data URL). */
const overlayImageCache = new Map<string, HTMLImageElement>();

function getOverlayImage(src: string): HTMLImageElement | null {
  let image = overlayImageCache.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    overlayImageCache.set(src, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

/** Draws a bitmap overlay (poster/jersey graphic) with opacity, blur and rotation. */
function drawImageOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
  transform: OverlayTransform
): void {
  if (!overlay.imageSrc) return;
  const image = getOverlayImage(overlay.imageSrc);
  if (!image) return;

  const maxW = width * 0.8;
  const scale = Math.min(1, maxW / image.naturalWidth) * transform.scale;
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  const cx = (transform.x / 100) * width;
  const cy = (transform.y / 100) * height;

  ctx.save();
  const alpha = Math.min(1, Math.max(0, transform.opacity / 100));
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (overlay.bgBlur && overlay.bgBlur > 0) {
    ctx.filter = `blur(${overlay.bgBlur}px)`;
  }
  if (transform.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

/**
 * Measures an overlay's on-canvas bounding box (output px). Used for
 * hit-testing when dragging overlays directly on the preview monitor.
 */
export function measureOverlayBounds(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
  transform?: OverlayTransform
): { x: number; y: number; w: number; h: number } | null {
  const t: OverlayTransform = transform ?? {
    x: overlay.x,
    y: overlay.y,
    scale: 1,
    opacity: overlay.opacity,
    rotation: overlay.rotation,
  };
  const anchorX = (t.x / 100) * width;
  const anchorY = (t.y / 100) * height;

  if (overlay.imageSrc) {
    const image = getOverlayImage(overlay.imageSrc);
    if (image) {
      const maxW = width * 0.8;
      const scale = Math.min(1, maxW / image.naturalWidth) * t.scale;
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      return { x: anchorX - w / 2, y: anchorY - h / 2, w, h };
    }
    // Not decoded yet — fall back to a square placeholder box.
    const w = width * 0.4 * t.scale;
    return { x: anchorX - w / 2, y: anchorY - w / 2, w, h: w };
  }

  const text = overlay.text.trim();
  if (!text) return null;

  const fontSize = overlay.fontSize * t.scale;
  ctx.save();
  ctx.font = `${fontSize}px ${overlay.fontFamily}`;
  ctx.textBaseline = "middle";
  const maxTextW = Math.max(40, width * 0.9 - overlay.padding * 2);
  const textWords = text.split(/\s+/).filter(Boolean);
  const timing =
    overlay.words && overlay.words.length === textWords.length ? overlay.words : null;
  const lines = timing
    ? layoutTimedLines(ctx, textWords, maxTextW)
    : layoutPlainLines(ctx, wrapText(ctx, text, maxTextW));
  ctx.restore();
  if (lines.length === 0) return null;

  let textW = 0;
  for (const line of lines) textW = Math.max(textW, line.width);

  const lineHeight = fontSize * 1.25;
  const boxW = textW + overlay.padding * 2;
  const boxH = lines.length * lineHeight + overlay.padding * 2;
  let boxX =
    overlay.alignment === "left"
      ? anchorX
      : overlay.alignment === "right"
        ? anchorX - boxW
        : anchorX - boxW / 2;
  const boxY = anchorY - boxH / 2;
  boxX = Math.min(Math.max(boxX, 0), Math.max(0, width - boxW));
  return { x: boxX, y: boxY, w: boxW, h: boxH };
}

/**
 * Returns the top-most overlay whose box contains the canvas point, or `null`.
 * Only overlays visible at `sceneTime` are considered.
 */
export function hitTestOverlay(
  ctx: CanvasRenderingContext2D,
  overlays: TextOverlay[],
  width: number,
  height: number,
  sceneTime: number,
  px: number,
  py: number
): TextOverlay | null {
  for (let i = overlays.length - 1; i >= 0; i--) {
    const overlay = overlays[i];
    if (sceneTime < overlay.startTime || sceneTime > overlay.endTime) continue;
    const bounds = measureOverlayBounds(
      ctx,
      overlay,
      width,
      height,
      resolveOverlayTransform(overlay, sceneTime)
    );
    if (!bounds) continue;
    const pad = 10;
    if (
      px >= bounds.x - pad &&
      px <= bounds.x + bounds.w + pad &&
      py >= bounds.y - pad &&
      py <= bounds.y + bounds.h + pad
    ) {
      return overlay;
    }
  }
  return null;
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
  sceneTime: number,
  style: CaptionStyle
): void {
  const transform = resolveOverlayTransform(overlay, sceneTime);
  if (overlay.imageSrc) {
    drawImageOverlay(ctx, overlay, width, height, transform);
    return;
  }
  const text = overlay.text.trim();
  if (!text) return;

  const fontSize = overlay.fontSize * transform.scale;
  ctx.save();
  ctx.font = `${fontSize}px ${overlay.fontFamily}`;
  ctx.textBaseline = "middle";
  const baseAlpha = Math.min(1, Math.max(0, transform.opacity / 100));
  if (baseAlpha < 1) ctx.globalAlpha = baseAlpha;

  const maxTextW = Math.max(40, width * 0.9 - overlay.padding * 2);
  const textWords = text.split(/\s+/).filter(Boolean);
  // Only trust word timings when they still line up with the (editable) text.
  const timing =
    overlay.words && overlay.words.length === textWords.length ? overlay.words : null;
  const anim = overlay.animation ?? style.animation;

  const lines: LayoutLine[] = timing
    ? layoutTimedLines(ctx, textWords, maxTextW)
    : layoutPlainLines(ctx, wrapText(ctx, text, maxTextW));

  if (lines.length === 0) {
    ctx.restore();
    return;
  }

  let textW = 0;
  for (const line of lines) textW = Math.max(textW, line.width);

  const lineHeight = fontSize * 1.25;
  const boxW = textW + overlay.padding * 2;
  const boxH = lines.length * lineHeight + overlay.padding * 2;

  const anchorX = (transform.x / 100) * width;
  const centerY = (transform.y / 100) * height;
  let boxX =
    overlay.alignment === "left"
      ? anchorX
      : overlay.alignment === "right"
        ? anchorX - boxW
        : anchorX - boxW / 2;
  const boxY = centerY - boxH / 2;
  // Keep the box on-canvas even at extreme anchor positions.
  boxX = Math.min(Math.max(boxX, 0), Math.max(0, width - boxW));

  // Simple mask: clip the overlay to its text box.
  if (overlay.mask) {
    ctx.beginPath();
    roundedRect(ctx, boxX - 6, boxY - 6, boxW + 12, boxH + 12, overlay.radius + 6);
    ctx.clip();
  }

  // Rotate the whole block around its center.
  if (transform.rotation) {
    const rcx = boxX + boxW / 2;
    const rcy = boxY + boxH / 2;
    ctx.translate(rcx, rcy);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.translate(-rcx, -rcy);
  }

  // Pop the whole block in for overlays without word-level timing.
  if (!timing) {
    const scale = animationScale(anim, sceneTime - overlay.startTime);
    if (scale !== 1) {
      const cx = boxX + boxW / 2;
      const cy = boxY + boxH / 2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
  }

  if (overlay.bgColor) {
    const neon = style.preset === "neonBox";
    ctx.save();
    if (neon) {
      ctx.shadowColor = overlay.fillColor || style.highlightColor || "#a855f7";
      ctx.shadowBlur = Math.max(24, fontSize * 0.6);
    }
    ctx.fillStyle = overlay.bgColor;
    roundedRect(ctx, boxX, boxY, boxW, boxH, overlay.radius);
    ctx.fill();
    if (neon) {
      ctx.lineWidth = Math.max(2, fontSize * 0.06);
      ctx.strokeStyle = overlay.fillColor || style.highlightColor || "#a855f7";
      roundedRect(ctx, boxX, boxY, boxW, boxH, overlay.radius);
      ctx.stroke();
    }
    ctx.restore();
  }

  const strokeWidth = style.textStroke ? Math.max(2, fontSize * 0.12) : 0;
  const spaceWidth = ctx.measureText(" ").width;
  const highlightColor = style.highlightColor || "#facc15";

  let wordCounter = 0;
  lines.forEach((line, lineIndex) => {
    const baselineY = boxY + overlay.padding + lineHeight * (lineIndex + 0.5);
    let cursorX =
      overlay.alignment === "left"
        ? boxX + overlay.padding
        : overlay.alignment === "right"
          ? boxX + boxW - overlay.padding - line.width
          : boxX + boxW / 2 - line.width / 2;

    for (const word of line.words) {
      let fill = overlay.fillColor;
      let scale = 1;
      let alpha = 1;
      let glow = false;

      if (timing) {
        const wordTiming = timing[word.wordIndex];
        if (wordTiming) {
          const active =
            sceneTime >= wordTiming.start && sceneTime <= wordTiming.end;
          const spoken = sceneTime > wordTiming.end;
          if (anim === "karaoke") {
            // Karaoke progressively fills already-spoken words.
            if (active || spoken) fill = highlightColor;
          } else if (style.activeWordHighlight && active) {
            fill = highlightColor;
          }
          if (active) scale = animationScale(anim, sceneTime - wordTiming.start);
        }
      }

      // Non-scale animations.
      if (anim === "fadeIn") {
        alpha = Math.min(1, Math.max(0, (sceneTime - overlay.startTime) / 0.35));
      } else if (anim === "typewriter") {
        const start = timing
          ? timing[word.wordIndex]?.start ?? overlay.startTime
          : overlay.startTime + wordCounter * 0.06;
        if (sceneTime < start) alpha = 0;
      } else if (anim === "neon") {
        glow = true;
      }

      drawWord(
        ctx,
        word.text,
        cursorX,
        baselineY,
        word.width,
        fill,
        strokeWidth,
        scale,
        alpha,
        glow
      );
      cursorX += word.width + spaceWidth;
      wordCounter += 1;
    }
  });

  ctx.restore();
}

/** Wraps per-word text into lines while preserving each word's original index. */
function layoutTimedLines(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number
): LayoutLine[] {
  const spaceWidth = ctx.measureText(" ").width;
  const lines: LayoutLine[] = [];
  let line: LayoutLine = { words: [], width: 0 };

  words.forEach((word, wordIndex) => {
    const width = ctx.measureText(word).width;
    const projected = line.words.length === 0 ? width : line.width + spaceWidth + width;
    if (line.words.length > 0 && projected > maxWidth) {
      lines.push(line);
      line = { words: [], width: 0 };
    }
    line.words.push({ text: word, width, wordIndex });
    line.width = line.words.length === 1 ? width : line.width + spaceWidth + width;
  });

  if (line.words.length > 0) lines.push(line);
  return lines;
}

/** Re-measures pre-wrapped lines into positioned words for stroked rendering. */
function layoutPlainLines(
  ctx: CanvasRenderingContext2D,
  rawLines: string[]
): LayoutLine[] {
  const spaceWidth = ctx.measureText(" ").width;
  return rawLines.map((raw) => {
    const pieces = raw
      .split(/\s+/)
      .filter(Boolean)
      .map((text, wordIndex) => ({ text, width: ctx.measureText(text).width, wordIndex }));
    let width = 0;
    pieces.forEach((piece, index) => {
      width += piece.width + (index > 0 ? spaceWidth : 0);
    });
    return { words: pieces, width };
  });
}

/** Smooth scale for a word/block as it enters (1.05 pop by default). */
function animationScale(
  animation: CaptionAnimation,
  elapsed: number
): number {
  if (elapsed < 0 || animation === "none") return 1;
  if (
    animation === "typewriter" ||
    animation === "fadeIn" ||
    animation === "neon"
  ) {
    return 1;
  }
  if (animation === "bounce") {
    const t = Math.min(1, elapsed / 0.3);
    return 1 + 0.16 * (1 - t) * Math.cos(t * Math.PI * 1.5);
  }
  const duration = animation === "karaoke" ? 0.15 : 0.18;
  const amount = animation === "karaoke" ? 0.04 : 0.05;
  const t = Math.min(1, elapsed / duration);
  return 1 + amount * (1 - t) * (1 - t);
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baselineY: number,
  width: number,
  fill: string,
  strokeWidth: number,
  scale: number,
  alpha = 1,
  glow = false
): void {
  if (alpha <= 0) return;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.translate(x + width / 2, baselineY);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  if (glow) {
    ctx.shadowColor = fill;
    ctx.shadowBlur = Math.max(12, strokeWidth * 6);
  }

  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "#000000";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(text, -width / 2, 0);
  }

  ctx.fillStyle = fill;
  ctx.fillText(text, -width / 2, 0);
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        continue;
      }
      // Hard-break a single word that is wider than the canvas.
      let chunk = "";
      for (const char of word) {
        if (chunk && ctx.measureText(chunk + char).width > maxWidth) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}
