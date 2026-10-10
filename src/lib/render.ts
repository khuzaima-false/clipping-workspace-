import type {
  AspectRatio,
  CaptionAnimation,
  CaptionStyle,
  ColorAdjustments,
  SpeedPoint,
  TextOverlay,
  VideoEffect,
} from "@/store/editor";
import {
  clampSpeed,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_COLOR_ADJUSTMENTS,
} from "@/store/editor";

/** Target output resolution for each supported aspect ratio (1080p-class). */
export const ASPECT_RESOLUTIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
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
   * Timed visual effects (zoom, shake, flash, vignette) composited over the
   * frame. Applied when `sceneTime` falls inside an effect's window.
   */
  activeEffects?: VideoEffect[];
};

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
  const { brightness, contrast, saturation, hue, blur } = adjustments;
  const totalBlur = blur + extraBlur;
  if (
    brightness === 0 &&
    contrast === 0 &&
    saturation === 0 &&
    hue === 0 &&
    totalBlur <= 0
  ) {
    return "none";
  }
  const parts = [
    `brightness(${Math.max(0, 100 + brightness)}%)`,
    `contrast(${Math.max(0, 100 + contrast)}%)`,
    `saturate(${Math.max(0, 100 + saturation)}%)`,
  ];
  if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);
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

  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    const filter = buildCanvasFilter(
      config.colorAdjustments ?? DEFAULT_COLOR_ADJUSTMENTS,
      fx?.blur ?? 0
    );
    if (filter !== "none") ctx.filter = filter;
    drawVideoFrame(ctx, video, config);
    // Reset so captions/overlays are never colour-graded.
    if (filter !== "none") ctx.filter = "none";
  } else if (options.placeholder) {
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

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: SceneConfig
): void {
  const { width, height, fit, offsetX, offsetY } = config;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const scale =
    fit === "contain" ? Math.min(width / vw, height / vh) : Math.max(width / vw, height / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;

  const range = panRange(drawW, drawH, width, height);
  const x = (width - drawW) / 2 + (offsetX / 100) * range.x;
  const y = (height - drawH) / 2 + (offsetY / 100) * range.y;

  ctx.drawImage(video, x, y, drawW, drawH);
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

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
  sceneTime: number,
  style: CaptionStyle
): void {
  const text = overlay.text.trim();
  if (!text) return;

  ctx.save();
  ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`;
  ctx.textBaseline = "middle";

  const maxTextW = Math.max(40, width * 0.9 - overlay.padding * 2);
  const textWords = text.split(/\s+/).filter(Boolean);
  // Only trust word timings when they still line up with the (editable) text.
  const timing =
    overlay.words && overlay.words.length === textWords.length ? overlay.words : null;

  const lines: LayoutLine[] = timing
    ? layoutTimedLines(ctx, textWords, maxTextW)
    : layoutPlainLines(ctx, wrapText(ctx, text, maxTextW));

  if (lines.length === 0) {
    ctx.restore();
    return;
  }

  let textW = 0;
  for (const line of lines) textW = Math.max(textW, line.width);

  const lineHeight = overlay.fontSize * 1.25;
  const boxW = textW + overlay.padding * 2;
  const boxH = lines.length * lineHeight + overlay.padding * 2;

  const anchorX = (overlay.x / 100) * width;
  const centerY = (overlay.y / 100) * height;
  let boxX =
    overlay.alignment === "left"
      ? anchorX
      : overlay.alignment === "right"
        ? anchorX - boxW
        : anchorX - boxW / 2;
  const boxY = centerY - boxH / 2;
  // Keep the box on-canvas even at extreme anchor positions.
  boxX = Math.min(Math.max(boxX, 0), Math.max(0, width - boxW));

  // Pop the whole block in for overlays without word-level timing.
  if (!timing) {
    const scale = animationScale(style.animation, sceneTime - overlay.startTime);
    if (scale !== 1) {
      const cx = boxX + boxW / 2;
      const cy = boxY + boxH / 2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
  }

  if (overlay.bgColor) {
    ctx.fillStyle = overlay.bgColor;
    roundedRect(ctx, boxX, boxY, boxW, boxH, overlay.radius);
    ctx.fill();
  }

  const strokeWidth = style.textStroke ? Math.max(2, overlay.fontSize * 0.12) : 0;
  const spaceWidth = ctx.measureText(" ").width;
  const highlightColor = style.highlightColor || "#facc15";

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

      if (timing) {
        const wordTiming = timing[word.wordIndex];
        if (wordTiming) {
          const active =
            sceneTime >= wordTiming.start && sceneTime <= wordTiming.end;
          const spoken = sceneTime > wordTiming.end;
          if (style.animation === "karaoke") {
            // Karaoke progressively fills already-spoken words.
            if (active || spoken) fill = highlightColor;
          } else if (style.activeWordHighlight && active) {
            fill = highlightColor;
          }
          if (active) scale = animationScale(style.animation, sceneTime - wordTiming.start);
        }
      }

      drawWord(ctx, word.text, cursorX, baselineY, word.width, fill, strokeWidth, scale);
      cursorX += word.width + spaceWidth;
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
  scale: number
): void {
  ctx.save();
  ctx.translate(x + width / 2, baselineY);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

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
