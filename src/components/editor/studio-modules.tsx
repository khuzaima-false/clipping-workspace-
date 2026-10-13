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

type StudioOptions = {
  template: "jersey" | "poster";
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

  if (o.template === "jersey") {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${o.fontSize}px ${o.font}`;
    ctx.fillStyle = o.color;
    ctx.strokeStyle = o.strokeColor;
    ctx.lineWidth = o.strokeWidth;
    ctx.strokeText(o.number, w / 2, h * 0.62);
    ctx.fillText(o.number, w / 2, h * 0.62);
    drawArcText(
      ctx,
      o.name.toUpperCase(),
      w / 2,
      h * 0.34,
      o.curvature * 0.02,
      `700 ${Math.round(o.fontSize * 0.34)}px ${o.font}`,
      o.color,
      o.strokeColor,
      o.strokeWidth * 0.6
    );
  } else {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = o.color;
    ctx.strokeStyle = o.strokeColor;
    ctx.lineWidth = o.strokeWidth;
    ctx.font = `700 ${Math.round(o.fontSize * 0.5)}px ${o.font}`;
    ctx.strokeText("VS", w * 0.5, h * 0.52);
    ctx.fillText("VS", w * 0.5, h * 0.52);
    ctx.font = `700 ${Math.round(o.fontSize * 0.26)}px ${o.font}`;
    ctx.fillText("TEAM A", w * 0.24, h * 0.52);
    ctx.fillText((o.opponent || "RIVALS").toUpperCase(), w * 0.76, h * 0.52);
    ctx.font = `600 ${Math.round(o.fontSize * 0.14)}px ${o.font}`;
    ctx.fillText("MATCH DAY", w * 0.5, h * 0.14);
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
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-100 focus:border-violet-500 focus:outline-none";

/** 1. Cricket Jersey & Match-Day Poster designer. */
export function StudioPanel() {
  const addImageOverlay = useEditorStore((s) => s.addImageOverlay);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<"jersey" | "poster">("jersey");
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
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            ["jersey", "Cricket Jersey"],
            ["poster", "Match Day Poster"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTemplate(id)}
            aria-pressed={template === id}
            className={cn(
              "rounded-lg border px-2 py-2 text-[11px] transition-colors",
              template === id
                ? "border-violet-500 bg-violet-600/15 text-violet-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
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
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-full rounded border border-zinc-800 bg-zinc-950" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-400">Stroke color</span>
          <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="h-8 w-full rounded border border-zinc-800 bg-zinc-950" />
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

/** Chroma-key style background removal on a PNG data URL. */
async function removeBackground(
  src: string,
  onProgress: (percent: number) => void
): Promise<string | null> {
  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  if (!image) return null;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;

  // Average the four corners to estimate the background colour.
  const corners = [
    0,
    (canvas.width - 1) * 4,
    (canvas.height - 1) * canvas.width * 4,
    ((canvas.height - 1) * canvas.width + canvas.width - 1) * 4,
  ];
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const i of corners) {
    br += px[i];
    bg += px[i + 1];
    bb += px[i + 2];
  }
  br /= corners.length;
  bg /= corners.length;
  bb /= corners.length;

  const threshold = 60 * 60 * 3;
  const rows = canvas.height;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const dr = px[i] - br;
      const dg = px[i + 1] - bg;
      const db = px[i + 2] - bb;
      if (dr * dr + dg * dg + db * db < threshold) px[i + 3] = 0;
    }
    if (y % 40 === 0) {
      onProgress(Math.round((y / rows) * 100));
      // Yield so the progress bar can paint.
      await new Promise((r) => setTimeout(r, 0));
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
  const [error, setError] = useState<string | null>(null);

  const runRemoval = async (src: string, target: "overlay" | "frame") => {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const result = await removeBackground(src, setProgress);
      if (!result) throw new Error("Could not read the image.");
      if (target === "overlay" && selected) updateOverlay(selected.id, { imageSrc: result });
      else addImageOverlay(result, 0);
      if (target === "frame") setError("Background removed — added as a new overlay.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const captureFrame = (): string | null => {
    const video = useEditorStore.getState().videoEl;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/png");
  };

  const canProcessImage = Boolean(selected?.imageSrc);

  return (
    <div className="space-y-2 border-t border-zinc-800 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        AI Studio
      </p>

      <button
        type="button"
        disabled={busy || !canProcessImage}
        onClick={() => selected?.imageSrc && void runRemoval(selected.imageSrc, "overlay")}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600 disabled:opacity-40"
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
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600 disabled:opacity-40"
      >
        <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" aria-hidden /> Remove background (current frame)
      </button>

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
      {error && <p className="text-[10px] leading-4 text-zinc-500">{error}</p>}

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
            className="rounded-md border border-zinc-800 bg-zinc-950/60 px-1.5 py-1 text-[10px] text-zinc-300 hover:border-zinc-600"
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
            className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 px-1.5 py-1 text-[10px] text-zinc-300 hover:border-zinc-600"
          >
            <Crop className="h-3 w-3" aria-hidden /> {ratio}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setQueueOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600"
      >
        <Download className="h-3.5 w-3.5 text-violet-400" aria-hidden /> Batch export queue
      </button>

      <Modal open={queueOpen} title="Batch Export Queue" onClose={() => setQueueOpen(false)}>
        <ul className="space-y-1.5">
          {selectedIds.map((id) => (
            <li
              key={id}
              className="truncate rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-[11px] text-zinc-300"
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
