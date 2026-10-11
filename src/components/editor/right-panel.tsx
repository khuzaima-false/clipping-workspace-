"use client";

import { useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Gauge,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  FONT_FAMILIES,
  MAX_SPEED,
  MIN_SPEED,
  useEditorStore,
  type CaptionAnimation,
  type OverlayAlign,
  type SpeedPoint,
  type SpeedPreset,
  type TextOverlay,
} from "@/store/editor";
import { speedAt } from "@/lib/render";
import { NativeAdBanner } from "@/components/ads/native-banner";
import { cn } from "@/lib/utils";

const sectionTitle =
  "text-[11px] font-semibold uppercase tracking-wider text-zinc-500";
const fieldLabel = "block text-[11px] font-medium text-zinc-400";
const fieldClass =
  "mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none";

const ALIGN_OPTIONS: { id: OverlayAlign; label: string; Icon: typeof AlignLeft }[] =
  [
    { id: "left", label: "Align left", Icon: AlignLeft },
    { id: "center", label: "Align center", Icon: AlignCenter },
    { id: "right", label: "Align right", Icon: AlignRight },
  ];

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-500">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-violet-500"
      />
    </label>
  );
}

const ANIMATION_PRESETS: {
  id: CaptionAnimation;
  label: string;
  hint: string;
}[] = [
  { id: "none", label: "None", hint: "Static" },
  { id: "pop", label: "Pop-in", hint: "Quick scale" },
  { id: "bounce", label: "Bounce", hint: "Springy" },
  { id: "karaoke", label: "Karaoke", hint: "Fill as spoken" },
];

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left transition-colors hover:border-zinc-700"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-zinc-200">{label}</span>
        <span className="block text-[10px] text-zinc-500">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-violet-600" : "bg-zinc-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            checked ? "left-4" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

function CaptionStyleSection() {
  const captionStyle = useEditorStore((state) => state.captionStyle);
  const setCaptionStyle = useEditorStore((state) => state.setCaptionStyle);
  const autoCaptionCount = useEditorStore(
    (state) => state.overlays.filter((overlay) => overlay.auto).length
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={sectionTitle}>Caption Style</h3>
        {autoCaptionCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI
          </span>
        )}
      </div>

      <ToggleRow
        label="Active Word Highlight"
        hint="Hormozi / CapCut style"
        checked={captionStyle.activeWordHighlight}
        onChange={(value) => setCaptionStyle({ activeWordHighlight: value })}
      />
      <ToggleRow
        label="Text Stroke"
        hint="Thick black outline for contrast"
        checked={captionStyle.textStroke}
        onChange={(value) => setCaptionStyle({ textStroke: value })}
      />

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-zinc-400">
          Animation preset
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ANIMATION_PRESETS.map((preset) => {
            const active = captionStyle.animation === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setCaptionStyle({ animation: preset.id })}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-center transition-colors",
                  active
                    ? "border-violet-500 bg-violet-500/15 text-violet-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
                )}
              >
                <span className="block text-xs font-semibold">{preset.label}</span>
                <span className="block text-[10px] text-zinc-500">{preset.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <label className={fieldLabel}>
        Highlight color
        <input
          type="color"
          value={captionStyle.highlightColor}
          onChange={(event) => setCaptionStyle({ highlightColor: event.target.value })}
          className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-1"
        />
      </label>

      <p className="text-[11px] leading-4 text-zinc-600">
        Highlighting and word animations apply to AI-generated captions and are
        baked into the exported video.
      </p>
    </div>
  );
}

function ColorGradingSection() {
  const [open, setOpen] = useState(true);
  const colorAdjustments = useEditorStore((state) => state.colorAdjustments);
  const setColorAdjustment = useEditorStore((state) => state.setColorAdjustment);
  const resetColorAdjustments = useEditorStore(
    (state) => state.resetColorAdjustments
  );

  const neutral =
    colorAdjustments.brightness === 0 &&
    colorAdjustments.contrast === 0 &&
    colorAdjustments.saturation === 0 &&
    colorAdjustments.hue === 0 &&
    colorAdjustments.blur === 0;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between"
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Color Grading
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        )}
      </button>

      {open && (
        <div className="space-y-3">
          <SliderRow
            label="Brightness"
            value={colorAdjustments.brightness}
            min={-100}
            max={100}
            suffix="%"
            onChange={(value) => setColorAdjustment({ brightness: value })}
          />
          <SliderRow
            label="Contrast"
            value={colorAdjustments.contrast}
            min={-100}
            max={100}
            suffix="%"
            onChange={(value) => setColorAdjustment({ contrast: value })}
          />
          <SliderRow
            label="Saturation"
            value={colorAdjustments.saturation}
            min={-100}
            max={100}
            suffix="%"
            onChange={(value) => setColorAdjustment({ saturation: value })}
          />
          <SliderRow
            label="Temperature / Hue"
            value={colorAdjustments.hue}
            min={-180}
            max={180}
            suffix="°"
            onChange={(value) => setColorAdjustment({ hue: value })}
          />
          <SliderRow
            label="Blur"
            value={colorAdjustments.blur}
            min={0}
            max={20}
            suffix=" px"
            onChange={(value) => setColorAdjustment({ blur: value })}
          />

          <button
            type="button"
            onClick={resetColorAdjustments}
            disabled={neutral}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" aria-hidden /> Reset grading
          </button>

          <p className="text-[11px] leading-4 text-zinc-600">
            Grading is applied to the video frame in the preview and baked into
            the exported MP4.
          </p>
        </div>
      )}
    </div>
  );
}

const SPEED_PRESETS: { id: SpeedPreset; label: string }[] = [
  { id: "none", label: "None" },
  { id: "montage", label: "Montage" },
  { id: "hero", label: "Hero Speed" },
  { id: "bullet", label: "Bullet Time" },
  { id: "custom", label: "Custom" },
];

const LOG_MIN_SPEED = Math.log(MIN_SPEED);
const LOG_SPEED_RANGE = Math.log(MAX_SPEED) - LOG_MIN_SPEED;

/** Maps a speed to a 0 (slow) … 1 (fast) vertical fraction on a log scale. */
function speedToFraction(speed: number): number {
  const clamped = Math.min(Math.max(speed, MIN_SPEED), MAX_SPEED);
  return (Math.log(clamped) - LOG_MIN_SPEED) / LOG_SPEED_RANGE;
}

function fractionToSpeed(fraction: number): number {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return Math.exp(LOG_MIN_SPEED + clamped * LOG_SPEED_RANGE);
}

function SpeedCurveEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const duration = useEditorStore((state) => state.duration);
  const trimStart = useEditorStore((state) => state.trimStart);
  const trimEnd = useEditorStore((state) => state.trimEnd);
  const speedPoints = useEditorStore((state) => state.speedPoints);
  const addSpeedPoint = useEditorStore((state) => state.addSpeedPoint);
  const updateSpeedPoint = useEditorStore((state) => state.updateSpeedPoint);
  const removeSpeedPoint = useEditorStore((state) => state.removeSpeedPoint);
  const setSpeedPoints = useEditorStore((state) => state.setSpeedPoints);

  const span = duration > 0 ? duration : 1;
  const toX = (time: number) => Math.min(100, Math.max(0, (time / span) * 100));
  const toY = (speed: number) => 100 - speedToFraction(speed) * 100;

  const pointFromEvent = (clientX: number, clientY: number): SpeedPoint | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { time: nx * span, speed: fractionToSpeed(1 - ny) };
  };

  const samples = 48;
  const curve: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const time = (i / samples) * span;
    curve.push(`${toX(time)},${toY(speedAt(speedPoints, time))}`);
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative h-32 w-full touch-none select-none overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
        onPointerDown={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY);
          if (point) addSpeedPoint(point);
        }}
        onPointerMove={(event) => {
          if (dragIndex === null) return;
          const point = pointFromEvent(event.clientX, event.clientY);
          if (point) updateSpeedPoint(dragIndex, point);
        }}
        onPointerUp={() => setDragIndex(null)}
        onPointerLeave={() => setDragIndex(null)}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {duration > 0 && trimEnd > trimStart && (
            <rect
              x={toX(trimStart)}
              y={0}
              width={Math.max(0, toX(trimEnd) - toX(trimStart))}
              height={100}
              fill="#8b5cf6"
              opacity={0.08}
            />
          )}
          <line
            x1={0}
            y1={toY(1)}
            x2={100}
            y2={toY(1)}
            stroke="#52525b"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={curve.join(" ")}
            fill="none"
            stroke="#a78bfa"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {speedPoints.map((point, index) => (
          <button
            key={`${index}-${point.time.toFixed(3)}`}
            type="button"
            aria-label={`Speed ${point.speed.toFixed(2)}× at ${point.time.toFixed(2)}s`}
            onPointerDown={(event) => {
              event.stopPropagation();
              setDragIndex(index);
              containerRef.current?.setPointerCapture(event.pointerId);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (speedPoints.length > 1) removeSpeedPoint(index);
            }}
            style={{ left: `${toX(point.time)}%`, top: `${toY(point.speed)}%` }}
            className={cn(
              "absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-zinc-900 transition-colors active:cursor-grabbing",
              dragIndex === index
                ? "bg-violet-300"
                : "bg-violet-500 hover:bg-violet-400"
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-600">
        <span>0s</span>
        <span>Drag · click to add · double-click to remove</span>
        <span>{span.toFixed(1)}s</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">
          {MIN_SPEED}× – {MAX_SPEED}× · dashed line = 1×
        </span>
        <button
          type="button"
          onClick={() => setSpeedPoints([{ time: 0, speed: 1 }])}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          Reset to 1×
        </button>
      </div>
    </div>
  );
}

function SpeedRampSection() {
  const speedPreset = useEditorStore((state) => state.speedPreset);
  const setSpeedPreset = useEditorStore((state) => state.setSpeedPreset);
  const duration = useEditorStore((state) => state.duration);
  const ramped = useEditorStore((state) =>
    state.speedPoints.some((point) => Math.abs(point.speed - 1) > 1e-3)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={sectionTitle}>Speed Ramping</h3>
        {ramped && (
          <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
            <Gauge className="h-3 w-3" aria-hidden />
            Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {SPEED_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setSpeedPreset(preset.id)}
            aria-pressed={speedPreset === preset.id}
            className={cn(
              "rounded-lg border px-1.5 py-1.5 text-[11px] font-medium transition-colors",
              speedPreset === preset.id
                ? "border-violet-500 bg-violet-500/15 text-violet-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {duration > 0 ? (
        <SpeedCurveEditor />
      ) : (
        <p className="text-[11px] leading-4 text-zinc-500">
          Import a video to edit the speed curve.
        </p>
      )}

      <p className="text-[11px] leading-4 text-zinc-600">
        Velocity reshapes playback and the export resamples frames and audio to
        match.
      </p>
    </div>
  );
}

export function RightPanel() {
  const overlay = useEditorStore(
    (state) => state.overlays.find((item) => item.id === state.selectedId) ?? null
  );
  const updateOverlay = useEditorStore((state) => state.updateOverlay);
  const removeOverlay = useEditorStore((state) => state.removeOverlay);
  const duration = useEditorStore((state) => state.duration);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setOverlayStartTime = useEditorStore(
    (state) => state.setOverlayStartTime
  );
  const setOverlayEndTime = useEditorStore((state) => state.setOverlayEndTime);

  if (!overlay) {
    return (
      <aside className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className={sectionTitle}>Text &amp; Caption Properties</h2>
        <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-10 text-center">
          <p className="text-xs leading-5 text-zinc-500">
            Select a text overlay from the left panel — or add a new one — to
            edit its position, font, and colors here.
          </p>
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <CaptionStyleSection />
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <ColorGradingSection />
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <SpeedRampSection />
        </div>
      </aside>
    );
  }

  const patch = (changes: Partial<Omit<TextOverlay, "id">>) => {
    updateOverlay(overlay.id, changes);
  };

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitle}>Text &amp; Caption Properties</h2>
        <button
          type="button"
          onClick={() => removeOverlay(overlay.id)}
          aria-label="Delete this caption"
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <label className={fieldLabel}>
        Caption text
        <textarea
          rows={3}
          value={overlay.text}
          onChange={(event) => patch({ text: event.target.value })}
          placeholder="Type your caption…"
          className={cn(fieldClass, "resize-none leading-5")}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={fieldLabel}>
          Font
          <select
            value={overlay.fontFamily}
            onChange={(event) => patch({ fontFamily: event.target.value })}
            className={fieldClass}
          >
            {FONT_FAMILIES.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabel}>
          Alignment
          <span className="mt-1 flex gap-1">
            {ALIGN_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => patch({ alignment: option.id })}
                aria-label={option.label}
                aria-pressed={overlay.alignment === option.id}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-lg border py-2 transition-colors",
                  overlay.alignment === option.id
                    ? "border-violet-500 bg-violet-500/15 text-violet-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
                )}
              >
                <option.Icon className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </span>
        </label>
      </div>

      <SliderRow
        label="Font size"
        value={overlay.fontSize}
        min={16}
        max={200}
        step={2}
        suffix=" px"
        onChange={(value) => patch({ fontSize: value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className={fieldLabel}>
          Text color
          <input
            type="color"
            value={overlay.fillColor}
            onChange={(event) => patch({ fillColor: event.target.value })}
            className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-1"
          />
        </label>
        <label className={fieldLabel}>
          <span className="flex items-center justify-between">
            <span>Background</span>
            <input
              type="checkbox"
              checked={overlay.bgColor !== ""}
              onChange={(event) =>
                patch(
                  event.target.checked
                    ? { bgColor: overlay.bgColor || "#000000" }
                    : { bgColor: "" }
                )
              }
              className="h-4 w-4 accent-violet-500"
            />
          </span>
          <input
            type="color"
            value={overlay.bgColor || "#000000"}
            disabled={overlay.bgColor === ""}
            onChange={(event) => patch({ bgColor: event.target.value })}
            className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-1 disabled:opacity-40"
          />
        </label>
      </div>

      <SliderRow
        label="Background padding"
        value={overlay.padding}
        min={0}
        max={64}
        suffix=" px"
        onChange={(value) => patch({ padding: value })}
      />
      <SliderRow
        label="Corner radius"
        value={overlay.radius}
        min={0}
        max={64}
        suffix=" px"
        onChange={(value) => patch({ radius: value })}
      />

      <div className="space-y-3 border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Visibility
          </h3>
          <span className="text-[11px] tabular-nums text-zinc-500">
            {overlay.startTime.toFixed(1)}s – {overlay.endTime.toFixed(1)}s
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <label htmlFor="overlay-start-time" className="font-medium">
              Start Time (s)
            </label>
            <span className="tabular-nums text-zinc-500">
              {overlay.startTime.toFixed(1)}s
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="overlay-start-time"
              type="range"
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.1}
              value={Math.min(overlay.startTime, Math.max(duration, 0))}
              onChange={(event) =>
                setOverlayStartTime(overlay.id, Number(event.target.value))
              }
              className="w-full accent-violet-500"
            />
            <input
              type="number"
              aria-label="Start Time in seconds"
              min={0}
              max={Math.max(duration, 0)}
              step={0.1}
              value={overlay.startTime}
              onChange={(event) =>
                setOverlayStartTime(overlay.id, Number(event.target.value))
              }
              className="w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs tabular-nums text-zinc-100 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setOverlayStartTime(overlay.id, currentTime)}
            className="mt-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            Use Current Time ({currentTime.toFixed(1)}s)
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <label htmlFor="overlay-end-time" className="font-medium">
              End Time (s)
            </label>
            <span className="tabular-nums text-zinc-500">
              {overlay.endTime.toFixed(1)}s
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="overlay-end-time"
              type="range"
              min={overlay.startTime}
              max={Math.max(duration, overlay.startTime + 0.1)}
              step={0.1}
              value={Math.min(
                Math.max(overlay.endTime, overlay.startTime),
                Math.max(duration, overlay.startTime)
              )}
              onChange={(event) =>
                setOverlayEndTime(overlay.id, Number(event.target.value))
              }
              className="w-full accent-violet-500"
            />
            <input
              type="number"
              aria-label="End Time in seconds"
              min={overlay.startTime}
              max={Math.max(duration, 0)}
              step={0.1}
              value={overlay.endTime}
              onChange={(event) =>
                setOverlayEndTime(overlay.id, Number(event.target.value))
              }
              className="w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs tabular-nums text-zinc-100 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setOverlayEndTime(overlay.id, currentTime)}
            className="mt-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            Use Current Time ({currentTime.toFixed(1)}s)
          </button>
        </div>

        <p className="text-[11px] leading-4 text-zinc-600">
          The caption is only visible between these times — on the preview
          canvas and in the exported video.
        </p>
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Position
        </h3>
        <SliderRow
          label="Horizontal (X)"
          value={overlay.x}
          min={0}
          max={100}
          suffix="%"
          onChange={(value) => patch({ x: value })}
        />
        <SliderRow
          label="Vertical (Y)"
          value={overlay.y}
          min={0}
          max={100}
          suffix="%"
          onChange={(value) => patch({ y: value })}
        />
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <CaptionStyleSection />
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <ColorGradingSection />
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <SpeedRampSection />
      </div>

      {/* Right/bottom ad placement (hidden for ad-free accounts). */}
      <NativeAdBanner />
    </aside>
  );
}
