"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, Download, Layers, Sparkles, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useEditorStore, type TextOverlay } from "@/store/editor";
import { cn } from "@/lib/utils";

const STUDIO_PRESETS: { id: string; label: string; patch: Record<string, number> }[] = [
  { id: "none", label: "Neutral", patch: { brightness: 0, exposure: 0, contrast: 0, saturation: 0, hue: 0, tint: 0, blur: 0 } },
  { id: "tealorange", label: "Teal & Orange", patch: { saturation: 22, contrast: 16, hue: 6, tint: 10 } },
  { id: "noir", label: "Moody Noir", patch: { saturation: -70, contrast: 30, brightness: -6 } },
  { id: "cyberpunk", label: "Cyberpunk", patch: { saturation: 48, contrast: 26, hue: -55, tint: 36 } },
  { id: "golden", label: "Golden Hour", patch: { saturation: 18, contrast: 8, brightness: 6, hue: 14, tint: 8 } },
];

const STUDIO_FONTS = ["Arial Black", "Impact", "Arial", "Georgia"] as const;
type StudioFont = (typeof STUDIO_FONTS)[number];

export type StudioTemplateId =
  | "jersey"
  | "football"
  | "poster"
  | "versus"
  | "esports"
  | "stream"
  | "roster"
  | "statcard"
  | "fixture"
  | "scoreboard"
  | "bracket"
  | "sponsor"
  | "highlight"
  | "scorebug";

export const STUDIO_TEMPLATES: {
  id: StudioTemplateId;
  label: string;
  group: "sports" | "gaming" | "broadcast";
}[] = [
  { id: "jersey", label: "Cricket Jersey", group: "sports" },
  { id: "football", label: "Football Kit", group: "sports" },
  { id: "poster", label: "Match Day Poster", group: "sports" },
  { id: "versus", label: "Versus Card", group: "sports" },
  { id: "roster", label: "Team Roster", group: "sports" },
  { id: "statcard", label: "Player Stats", group: "sports" },
  { id: "fixture", label: "Fixture List", group: "sports" },
  { id: "esports", label: "Esports Clan Logo", group: "gaming" },
  { id: "stream", label: "Stream Starting Soon", group: "gaming" },
  { id: "highlight", label: "Highlight Reel Intro", group: "gaming" },
  { id: "scoreboard", label: "Live Scoreboard", group: "broadcast" },
  { id: "bracket", label: "Tournament Bracket", group: "broadcast" },
  { id: "sponsor", label: "Sponsor Board", group: "broadcast" },
  { id: "scorebug", label: "Score Bug", group: "broadcast" },
];

type StudioOptions = {
  template: StudioTemplateId;
  name: string;
  number: string;
  opponent: string;
  font: StudioFont;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  curvature: number;
};

function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  arc: number,
  font: string,
  fill: string,
  stroke: string,
  strokeWidth: number
): void {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  if (!arc) {
    ctx.strokeText(text, cx, cy);
    ctx.fillText(text, cx, cy);
    return;
  }
  const chars = [...text];
  const radius = 380;
  const step = arc / Math.max(1, chars.length);
  let angle = -arc / 2;
  for (const ch of chars) {
    const x = cx + Math.sin(angle) * radius;
    const y = cy + radius - Math.cos(angle) * radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += step;
  }
}

function renderStudio(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  o: StudioOptions
): void {
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const name = o.name.toUpperCase();
  const opponent = (o.opponent || "RIVALS").toUpperCase();
  const font = o.font;
  const fs = o.fontSize;
  const fill = o.color;
  const stroke = o.strokeColor;
  const sw = o.strokeWidth;

  const text = (value: string, x: number, y: number, size: number, weight = 700) => {
    ctx.font = `${weight} ${Math.max(8, Math.round(size))}px ${font}`;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = sw;
    if (sw > 0) ctx.strokeText(value, x, y);
    ctx.fillText(value, x, y);
  };
  const panel = (x: number, y: number, pw: number, ph: number, bg: string, radius = 24) => {
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, pw, ph, radius);
    else ctx.rect(x, y, pw, ph);
    ctx.fill();
  };

  switch (o.template) {
    case "jersey":
      text(o.number, w / 2, h * 0.62, fs);
      drawArcText(ctx, name, w / 2, h * 0.34, o.curvature * 0.02, `700 ${Math.round(fs * 0.34)}px ${font}`, fill, stroke, sw * 0.6);
      break;
    case "football":
      panel(w * 0.2, h * 0.16, w * 0.6, h * 0.68, "#0b0b0f", 40);
      text(o.number, w / 2, h * 0.6, fs);
      text(name, w / 2, h * 0.28, fs * 0.28);
      text(opponent, w / 2, h * 0.82, fs * 0.2);
      break;
    case "poster":
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
      text("VS", w * 0.5, h * 0.52, fs * 0.5);
      text("TEAM A", w * 0.24, h * 0.52, fs * 0.26);
      text(opponent, w * 0.76, h * 0.52, fs * 0.26);
      text("MATCH DAY", w * 0.5, h * 0.14, fs * 0.14, 600);
      break;
    case "versus":
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, w, h);
      panel(0, h * 0.36, w * 0.42, h * 0.28, "#1d4ed8", 8);
      panel(w * 0.58, h * 0.36, w * 0.42, h * 0.28, "#b91c1c", 8);
      text(name, w * 0.21, h * 0.5, fs * 0.22);
      text(opponent, w * 0.79, h * 0.5, fs * 0.22);
      text("VS", w * 0.5, h * 0.5, fs * 0.36);
      break;
    case "esports": {
      const cx = w / 2;
      const cy = h * 0.46;
      const radius = Math.min(w, h) * 0.3;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "#0f172a";
      ctx.fill();
      ctx.lineWidth = Math.max(4, sw);
      ctx.strokeStyle = fill;
      ctx.stroke();
      text((name || "CLAN").slice(0, 5), cx, cy, fs * 0.3);
      text(`#${o.number || "01"}`, cx, h * 0.86, fs * 0.18);
      break;
    }
    case "stream":
      ctx.fillStyle = "#0b0b12";
      ctx.fillRect(0, 0, w, h);
      text("STARTING SOON", w / 2, h * 0.34, fs * 0.3);
      text(name, w / 2, h * 0.56, fs * 0.5);
      text(`LIVE · ${opponent}`, w / 2, h * 0.74, fs * 0.16, 600);
      break;
    case "roster":
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
      text(name, w / 2, h * 0.14, fs * 0.24);
      ["1", "2", "3", "4"].forEach((n, i) => text(n, w * 0.18 + i * w * 0.22, h * 0.42, fs * 0.3));
      ["A", "B", "C", "D"].forEach((t, i) => text(t, w * 0.18 + i * w * 0.22, h * 0.66, fs * 0.14, 600));
      break;
    case "statcard":
      panel(w * 0.08, h * 0.08, w * 0.84, h * 0.84, "#111827", 32);
      text(name, w / 2, h * 0.24, fs * 0.24);
      text("SCORE", w * 0.3, h * 0.5, fs * 0.12, 600);
      text(o.number || "0", w * 0.3, h * 0.62, fs * 0.34);
      text("ASSISTS", w * 0.7, h * 0.5, fs * 0.12, 600);
      text(opponent.slice(0, 2) || "0", w * 0.7, h * 0.62, fs * 0.34);
      break;
    case "fixture":
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
      text("FIXTURES", w / 2, h * 0.12, fs * 0.2);
      ["ROUND 1", "ROUND 2", "ROUND 3"].forEach((label, i) => {
        const y = h * 0.3 + i * h * 0.2;
        panel(w * 0.08, y - h * 0.06, w * 0.84, h * 0.12, "#18181b", 16);
        text(`${name}  vs  ${opponent}`, w / 2, y, fs * 0.12, 600);
        text(label, w / 2, y + h * 0.035, fs * 0.08, 500);
      });
      break;
    case "scoreboard":
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
      panel(w * 0.06, h * 0.3, w * 0.88, h * 0.4, "#111827", 28);
      text(name, w * 0.28, h * 0.42, fs * 0.18);
      text(opponent, w * 0.72, h * 0.42, fs * 0.18);
      text(o.number || "0", w * 0.28, h * 0.58, fs * 0.3);
      text("0", w * 0.72, h * 0.58, fs * 0.3);
      text("-", w * 0.5, h * 0.5, fs * 0.28);
      break;
    case "bracket":
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
      text("BRACKET", w / 2, h * 0.1, fs * 0.18);
      for (let i = 0; i < 4; i += 1) {
        panel(w * 0.08, h * 0.25 + i * h * 0.16, w * 0.34, h * 0.1, "#18181b", 12);
        panel(w * 0.58, h * 0.33 + i * h * 0.16, w * 0.34, h * 0.1, "#18181b", 12);
      }
      panel(w * 0.38, h * 0.45, w * 0.24, h * 0.1, stroke || "#7c3aed", 12);
      break;
    case "sponsor":
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
      text("SPONSORED BY", w / 2, h * 0.18, fs * 0.14, 600);
      panel(w * 0.18, h * 0.32, w * 0.64, h * 0.36, stroke || "#7c3aed", 28);
      text(name, w / 2, h * 0.5, fs * 0.28);
      text(opponent, w / 2, h * 0.82, fs * 0.12, 500);
      break;
    case "highlight":
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
      text("HIGHLIGHTS", w / 2, h * 0.3, fs * 0.34);
      text(name, w / 2, h * 0.6, fs * 0.24);
      text(`vs ${opponent}`, w / 2, h * 0.74, fs * 0.16, 600);
      break;
    case "scorebug":
      panel(w * 0.12, h * 0.42, w * 0.76, h * 0.16, "#111827", 18);
      panel(w * 0.12, h * 0.42, w * 0.06, h * 0.16, stroke || "#7c3aed", 18);
      text(`${name}  ${o.number || "0"} - 0  ${opponent}`, w / 2, h * 0.5, fs * 0.12, 600);
      break;
  }
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full accent-violet-500"
      />
    </label>
  );
}

const fieldClass =
  "w-full rounded-lg border border-studio-border bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-100 focus:border-violet-500 focus:outline-none";

/** 1. Cricket Jersey & Match-Day Poster designer. */
export function StudioPanel() {
  const addImageOverlay = useEditorStore((s) => s.addImageOverlay);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<StudioTemplateId>("jersey");
  const [name, setName] = useState("SHARMA");
  const [number, setNumber] = useState("7");
  const [opponent, setOpponent] = useState("TITANS");
  const [font, setFont] = useState<StudioFont>("Arial Black");
  const [fontSize, setFontSize] = useState(180);
  const [color, setColor] = useState("#f4f4f5");
  const [strokeColor, setStrokeColor] = useState("#7c3aed");
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [curvature, setCurvature] = useState(24);

  const options: StudioOptions = {
    template,
    name,
    number,
    opponent,
    font,
    fontSize,
    color,
    strokeColor,
    strokeWidth,
    curvature,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderStudio(ctx, canvas.width, canvas.height, { ...options, fontSize: fontSize * 0.28 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, name, number, opponent, font, fontSize, color, strokeColor, strokeWidth, curvature]);

  const exportToTimeline = () => {
    const off = document.createElement("canvas");
    off.width = 1080;
    off.height = 1080;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    renderStudio(ctx, off.width, off.height, options);
    addImageOverlay(off.toDataURL("image/png"), 0);
  };

  return (
    <div className="space-y-3">
      <div className="custom-scrollbar flex items-center gap-2 overflow-x-auto whitespace-nowrap py-2">
        {STUDIO_TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTemplate(item.id)}
            aria-pressed={template === item.id}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition-colors",
              template === item.id
                ? "border-violet-500 bg-violet-600/15 text-violet-200"
                : "border-studio-border bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-studio-border bg-zinc-950/60">
        <canvas ref={canvasRef} width={280} height={280} className="h-40 w-full" />
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] text-zinc-400">Player / Team name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-400">Jersey number</span>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-400">Opponent</span>
          <input value={opponent} onChange={(e) => setOpponent(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] text-zinc-400">Font style</span>
        <select
          value={font}
          onChange={(e) => setFont(e.target.value as StudioFont)}
          className={fieldClass}
        >
          {STUDIO_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      <Slider label="Font size" value={fontSize} min={80} max={320} onChange={setFontSize} />
      <Slider label="Stroke width" value={strokeWidth} min={0} max={20} onChange={setStrokeWidth} />
      <Slider label="Curvature" value={curvature} min={0} max={60} onChange={setCurvature} />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-400">Text color</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-full rounded border border-studio-border bg-zinc-950" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-400">Stroke color</span>
          <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="h-8 w-full rounded border border-studio-border bg-zinc-950" />
        </label>
      </div>

      <button
        type="button"
        onClick={exportToTimeline}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient brand-gradient-hover px-3 py-2 text-[11px] font-semibold text-white"
      >
        <Layers className="h-3.5 w-3.5" aria-hidden /> Export to Timeline (V2)
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. AI Studio: background removal + blur                             */
/* ------------------------------------------------------------------ */

/** Loads an image from a (data) URL. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Client-side background removal. Estimates the background colour from the
 * image border (median-ish average), then cuts matching pixels to full
 * transparency and feathers the edge so the subject stays smooth. `tolerance`
 * is 0..1 (higher removes more of the background).
 */
async function removeBackground(
  src: string,
  onProgress: (percent: number) => void,
  tolerance = 0.22
): Promise<string | null> {
  const image = await loadImage(src);
  if (!image) return null;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (w === 0 || h === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  // Average the border pixels to estimate the background colour.
  let br = 0;
  let bg = 0;
  let bb = 0;
  let count = 0;
  const stepX = Math.max(1, Math.floor(w / 64));
  const stepY = Math.max(1, Math.floor(h / 64));
  for (let x = 0; x < w; x += stepX) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      br += px[i];
      bg += px[i + 1];
      bb += px[i + 2];
      count += 1;
    }
  }
  for (let y = 0; y < h; y += stepY) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      br += px[i];
      bg += px[i + 1];
      bb += px[i + 2];
      count += 1;
    }
  }
  if (count === 0) return null;
  br /= count;
  bg /= count;
  bb /= count;

  const maxDist = Math.sqrt(3) * 255;
  const outer = Math.min(Math.max(tolerance, 0.02), 0.9) * maxDist;
  const inner = outer * 0.7;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const dr = px[i] - br;
      const dg = px[i + 1] - bg;
      const db = px[i + 2] - bb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= inner) {
        px[i + 3] = 0;
      } else if (dist < outer) {
        px[i + 3] = px[i + 3] * ((dist - inner) / (outer - inner));
      }
    }
    if (y % 24 === 0) {
      onProgress(Math.round((y / h) * 100));
      // Yield so the progress bar can paint.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  ctx.putImageData(data, 0, 0);
  onProgress(100);
  return canvas.toDataURL("image/png");
}

export function AiStudioSection({ selected }: { selected: TextOverlay | null }) {
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const addImageOverlay = useEditorStore((s) => s.addImageOverlay);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tolerance, setTolerance] = useState(0.22);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const runRemoval = async (src: string, target: "overlay" | "frame") => {
    setBusy(true);
    setError(null);
    setStatus(null);
    setProgress(0);
    try {
      const result = await removeBackground(src, setProgress, tolerance);
      if (!result) throw new Error("Could not read the image.");
      if (target === "overlay" && selected) {
        updateOverlay(selected.id, { imageSrc: result });
        setStatus("Background removed — overlay updated.");
      } else {
        addImageOverlay(result, 0);
        setStatus("Background removed — added as a new overlay.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const captureFrame = (): string | null => {
    const video = useEditorStore.getState().videoEl;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      return null;
    }
    return canvas.toDataURL("image/png");
  };

  const canProcessImage = Boolean(selected?.imageSrc);

  return (
    <div className="space-y-2 border-t border-studio-border pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        AI Studio
      </p>

      <button
        type="button"
        disabled={busy || !canProcessImage}
        onClick={() => selected?.imageSrc && void runRemoval(selected.imageSrc, "overlay")}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-studio-border bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600 disabled:opacity-40"
      >
        <Sparkles className="h-3.5 w-3.5 text-violet-400" aria-hidden /> Remove background (image)
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const frame = captureFrame();
          if (frame) void runRemoval(frame, "frame");
          else setError("No video frame available.");
        }}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-studio-border bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600 disabled:opacity-40"
      >
        <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" aria-hidden /> Remove background (current frame)
      </button>

      <Slider
        label="Edge tolerance"
        value={Math.round(tolerance * 100)}
        min={5}
        max={70}
        onChange={(value) => setTolerance(value / 100)}
      />

      {busy && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>Processing…</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="brand-gradient h-full" style={{ width: `${Math.max(3, progress)}%` }} />
          </div>
        </div>
      )}
      {error && <p className="text-[10px] leading-4 text-red-400">{error}</p>}
      {status && !error && (
        <p className="text-[10px] leading-4 text-emerald-400">{status}</p>
      )}

      {selected?.imageSrc && (
        <Slider
          label="Backdrop blur"
          value={selected.bgBlur ?? 0}
          min={0}
          max={24}
          onChange={(value) => updateOverlay(selected.id, { bgBlur: value })}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Batch queue                                                      */
/* ------------------------------------------------------------------ */

export function BatchTools({
  selectedIds,
  onClear,
  onBatchExport,
}: {
  selectedIds: string[];
  onClear: () => void;
  onBatchExport?: (clipIds: string[]) => void;
}) {
  const sequence = useEditorStore((s) => s.sequence);
  const assets = useEditorStore((s) => s.assets);
  const resetColorAdjustments = useEditorStore((s) => s.resetColorAdjustments);
  const setColorAdjustment = useEditorStore((s) => s.setColorAdjustment);
  const setAspect = useEditorStore((s) => s.setAspect);
  const [queueOpen, setQueueOpen] = useState(false);

  const nameFor = (id: string) =>
    assets.find((a) => a.id === sequence.find((c) => c.id === id)?.assetId)?.name ??
    "Clip";

  if (selectedIds.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">
          Batch Actions · {selectedIds.length}
        </p>
        <button type="button" onClick={onClear} className="rounded p-0.5 text-zinc-400 hover:text-white">
          <X className="h-3 w-3" aria-hidden />
        </button>
      </div>

      <p className="text-[10px] text-zinc-400">Bulk color preset</p>
      <div className="grid grid-cols-3 gap-1">
        {STUDIO_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              resetColorAdjustments();
              if (preset.id !== "none") setColorAdjustment(preset.patch);
            }}
            className="rounded-md border border-studio-border bg-zinc-950/60 px-1.5 py-1 text-[10px] text-zinc-300 hover:border-zinc-600"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-zinc-400">Bulk resize / aspect</p>
      <div className="grid grid-cols-3 gap-1">
        {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
          <button
            key={ratio}
            type="button"
            onClick={() => setAspect(ratio)}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-studio-border bg-zinc-950/60 px-1.5 py-1 text-[10px] text-zinc-300 hover:border-zinc-600"
          >
            <Crop className="h-3 w-3" aria-hidden /> {ratio}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setQueueOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-studio-border bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600"
      >
        <Download className="h-3.5 w-3.5 text-violet-400" aria-hidden /> Batch export queue
      </button>

      <Modal open={queueOpen} title="Batch Export Queue" onClose={() => setQueueOpen(false)}>
        <ul className="space-y-1.5">
          {selectedIds.map((id) => (
            <li
              key={id}
              className="truncate rounded-lg border border-studio-border bg-zinc-950/60 px-2 py-1.5 text-[11px] text-zinc-300"
            >
              {nameFor(id)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setQueueOpen(false);
            onBatchExport?.(selectedIds);
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient brand-gradient-hover px-3 py-2 text-[11px] font-semibold text-white"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Export all ({selectedIds.length})
        </button>
      </Modal>
    </div>
  );
}
