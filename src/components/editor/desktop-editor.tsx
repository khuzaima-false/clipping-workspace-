"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Captions,
  Eye,
  EyeOff,
  Film,
  LoaderCircle,
  Lock,
  Music,
  Pause,
  Play,
  Plus,
  Redo2,
  Repeat,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ASPECT_RESOLUTIONS, drawScene } from "@/lib/render";
import {
  FONT_FAMILIES,
  useEditorStore,
  type CaptionAnimation,
  type OverlayAlign,
  type TextOverlay,
  type VideoEffectType,
} from "@/store/editor";
import { CAPTIONS_CREDIT_COST } from "@/lib/credits";
import { CAPTION_LANGUAGES, type CaptionLanguageId } from "@/lib/transcribe";
import { useWorkspaceStore } from "@/store/workspace";
import {
  AiStudioSection,
  BatchTools,
  StudioPanel,
} from "@/components/editor/studio-modules";
import { cn } from "@/lib/utils";

const EFFECT_CARDS: { type: VideoEffectType; label: string; Icon: typeof Wand2 }[] = [
  { type: "zoom-in", label: "Zoom In", Icon: Wand2 },
  { type: "zoom-out", label: "Zoom Out", Icon: SlidersHorizontal },
  { type: "camera-shake", label: "Camera Shake", Icon: Activity },
  { type: "flash", label: "Flash", Icon: Repeat },
  { type: "blur-vignette", label: "Blur Vignette", Icon: EyeOff },
];

const CINEMATIC_PRESETS: { id: string; label: string; patch: Record<string, number> }[] = [
  { id: "none", label: "Neutral", patch: { brightness: 0, contrast: 0, saturation: 0, hue: 0, tint: 0, blur: 0 } },
  { id: "tealorange", label: "Teal & Orange", patch: { saturation: 22, contrast: 16, hue: 6, tint: 10 } },
  { id: "noir", label: "Moody Noir", patch: { saturation: -70, contrast: 30, brightness: -6 } },
  { id: "cyberpunk", label: "Cyberpunk", patch: { saturation: 48, contrast: 26, hue: -55, tint: 36 } },
  { id: "golden", label: "Golden Hour", patch: { saturation: 18, contrast: 8, brightness: 6, hue: 14, tint: 8 } },
];

function formatTimecode(seconds: number, fps: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const frames = Math.floor((safe - total) * (fps > 0 ? fps : 30));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return [hh, mm, ss, frames].map((n) => String(n).padStart(2, "0")).join(":");
}

const panelTitle =
  "border-b border-zinc-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400";

type WheelKey = "master" | "shadows" | "midtones" | "highlights";
type WheelValue = { x: number; y: number };

/** Premiere-style round color wheel (hue around, saturation outward). */
function ColorWheel({
  label,
  value,
  onChange,
}: {
  label: string;
  value: WheelValue;
  onChange: (value: WheelValue) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const size = 72;
  const radius = size / 2 - 5;

  const handle = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (clientX - cx) / radius;
    let dy = (clientY - cy) / radius;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      dx /= dist;
      dy /= dist;
    }
    onChange({ x: dx, y: dy });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={ref}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((value.x + 1) / 2) * 100)}
        aria-valuetext={`x ${value.x.toFixed(2)}, y ${value.y.toFixed(2)}`}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handle(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handle(e.clientX, e.clientY);
        }}
        className="relative cursor-crosshair rounded-full ring-1 ring-inset ring-white/20"
        style={{
          width: size,
          height: size,
          background:
            "conic-gradient(from 90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, rgba(113,113,122,0.95) 0%, rgba(113,113,122,0.5) 45%, transparent 76%)",
          }}
        />
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full border-2 border-white bg-black/30 shadow"
          style={{
            transform: `translate(calc(-50% + ${value.x * radius}px), calc(-50% + ${value.y * radius}px))`,
          }}
        />
      </div>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top-left: Project bin + Inspector                                    */
/* ------------------------------------------------------------------ */
function ProjectBinPanel({
  onRequireCredits,
  onBatchExport,
}: {
  onRequireCredits?: () => void;
  onBatchExport?: (clipIds: string[]) => void;
}) {
  const [tab, setTab] = useState<
    "media" | "effects" | "properties" | "clip" | "captions" | "studio"
  >("media");
  const inputRef = useRef<HTMLInputElement>(null);

  const assets = useEditorStore((s) => s.assets);
  const sequence = useEditorStore((s) => s.sequence);
  const addVideoAssets = useEditorStore((s) => s.addVideoAssets);
  const selectClip = useEditorStore((s) => s.selectClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const currentTime = useEditorStore((s) => s.currentTime);

  const addEffect = useEditorStore((s) => s.addEffect);
  const activeEffects = useEditorStore((s) => s.activeEffects);
  const removeEffect = useEditorStore((s) => s.removeEffect);

  const overlays = useEditorStore((s) => s.overlays);
  const selectedId = useEditorStore((s) => s.selectedId);
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  const fit = useEditorStore((s) => s.fit);
  const setFit = useEditorStore((s) => s.setFit);
  const offsetX = useEditorStore((s) => s.offsetX);
  const offsetY = useEditorStore((s) => s.offsetY);
  const setOffset = useEditorStore((s) => s.setOffset);

  const duration = useEditorStore((s) => s.duration);
  const trimStart = useEditorStore((s) => s.trimStart);
  const trimEnd = useEditorStore((s) => s.trimEnd);
  const setTrimStart = useEditorStore((s) => s.setTrimStart);
  const setTrimEnd = useEditorStore((s) => s.setTrimEnd);
  const resetTrim = useEditorStore((s) => s.resetTrim);

  // Captions + text styling
  const hasVideo = useEditorStore((s) => s.videoEl !== null);
  const captionLanguage = useEditorStore((s) => s.captionLanguage);
  const setCaptionLanguage = useEditorStore((s) => s.setCaptionLanguage);
  const generateAutoCaptions = useEditorStore((s) => s.generateAutoCaptions);
  const clearAutoCaptions = useEditorStore((s) => s.clearAutoCaptions);
  const transcribing = useEditorStore((s) => s.transcribing);
  const transcribingProgress = useEditorStore((s) => s.transcribingProgress);
  const transcribingStatus = useEditorStore((s) => s.transcribingStatus);
  const transcriptionError = useEditorStore((s) => s.transcriptionError);
  const autoCaptionCount = useEditorStore(
    (s) => s.overlays.filter((o) => o.auto).length
  );
  const addOverlay = useEditorStore((s) => s.addOverlay);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);
  const captionStyle = useEditorStore((s) => s.captionStyle);
  const setCaptionStyle = useEditorStore((s) => s.setCaptionStyle);
  const consumeCredits = useWorkspaceStore((s) => s.consumeCredits);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);

  const handleAutoCaptions = async () => {
    if (transcribing) return;
    setCaptionError(null);
    const result = await consumeCredits(CAPTIONS_CREDIT_COST);
    if (!result.ok) {
      if (result.reason === "insufficient") onRequireCredits?.();
      else
        setCaptionError(
          result.error ?? "Could not verify your credits. Please try again."
        );
      return;
    }
    void generateAutoCaptions();
  };

  const nameFor = (assetId: string) =>
    assets.find((a) => a.id === assetId)?.name ?? "Clip";

  const patchSelected = (patch: Partial<Omit<TextOverlay, "id">>) => {
    if (selected) updateOverlay(selected.id, patch);
  };

  return (
    <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex flex-wrap border-b border-zinc-800">
        {(
          [
            ["media", "Media"],
            ["effects", "Effects"],
            ["properties", "Props"],
            ["clip", "Clip"],
            ["captions", "Captions"],
            ["studio", "Studio"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={cn(
              "shrink-0 whitespace-nowrap px-2.5 py-2 text-[11px] font-medium transition-colors",
              tab === id
                ? "bg-violet-600/15 text-violet-200"
                : "text-zinc-400 hover:text-zinc-100"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "media" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient brand-gradient-hover px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Import media
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void addVideoAssets(e.target.files);
                e.target.value = "";
              }}
            />
            <BatchTools
              selectedIds={selectedClips}
              onClear={() => setSelectedClips([])}
              onBatchExport={onBatchExport}
            />
            {sequence.length === 0 ? (
              <p className="text-[11px] leading-4 text-zinc-500">
                No media yet — import clips to build your sequence.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {sequence.map((clip, index) => (
                  <li key={clip.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedClips.includes(clip.id)}
                      onChange={(e) =>
                        setSelectedClips((prev) =>
                          e.target.checked
                            ? [...prev, clip.id]
                            : prev.filter((id) => id !== clip.id)
                        )
                      }
                      aria-label={`Select ${nameFor(clip.assetId)}`}
                      className="h-3.5 w-3.5 shrink-0 accent-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => selectClip(clip.id)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition-colors",
                        clip.id === activeClipId
                          ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
                          : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-600"
                      )}
                    >
                      <Film className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {index + 1}. {nameFor(clip.assetId)}
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {(Math.max(0, clip.trimEnd - clip.trimStart)).toFixed(1)}s
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeClip(clip.id)}
                      aria-label={`Remove ${nameFor(clip.assetId)}`}
                      className="shrink-0 rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "effects" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {EFFECT_CARDS.map((card) => (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => addEffect(card.type, currentTime)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-left text-[11px] text-zinc-200"
                >
                  <card.Icon className="h-3.5 w-3.5 text-violet-400" aria-hidden />
                  {card.label}
                </button>
              ))}
            </div>
            {activeEffects.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {activeEffects.map((fx) => (
                  <li
                    key={fx.id}
                    className="flex items-center gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-1.5 text-[11px] text-fuchsia-100"
                  >
                    <span className="min-w-0 flex-1 truncate capitalize">
                      {fx.type.replace("-", " ")} · {fx.startTime.toFixed(1)}s
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEffect(fx.id)}
                      aria-label="Remove effect"
                      className="rounded p-1 text-fuchsia-200/70 hover:text-white"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "properties" && (
          <div className="space-y-3">
            {!selected ? (
              <p className="text-[11px] leading-4 text-zinc-500">
                Select a text overlay (Captions tab or timeline) to edit its text,
                font, colors, animation and transform.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-zinc-400">
                    Text
                  </span>
                  <textarea
                    value={selected.text}
                    onChange={(e) => patchSelected({ text: e.target.value })}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-100 focus:border-violet-500 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-zinc-400">
                    Font
                  </span>
                  <select
                    value={selected.fontFamily}
                    onChange={(e) => patchSelected({ fontFamily: e.target.value })}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-100"
                  >
                    {FONT_FAMILIES.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-zinc-400">Fill</span>
                    <input
                      type="color"
                      value={selected.fillColor}
                      onChange={(e) => patchSelected({ fillColor: e.target.value })}
                      className="h-8 w-full rounded border border-zinc-800 bg-zinc-950"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-zinc-400">
                      Background
                    </span>
                    <input
                      type="color"
                      value={selected.bgColor || "#000000"}
                      onChange={(e) => patchSelected({ bgColor: e.target.value })}
                      className="h-8 w-full rounded border border-zinc-800 bg-zinc-950"
                    />
                  </label>
                </div>
                {selected.bgColor && (
                  <button
                    type="button"
                    onClick={() => patchSelected({ bgColor: "" })}
                    className="text-[10px] text-zinc-500 hover:text-zinc-200"
                  >
                    Remove background
                  </button>
                )}

                <div>
                  <span className="mb-1 block text-[10px] text-zinc-400">Alignment</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ["left", AlignLeft],
                        ["center", AlignCenter],
                        ["right", AlignRight],
                      ] as const
                    ).map(([id, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => patchSelected({ alignment: id as OverlayAlign })}
                        aria-pressed={selected.alignment === id}
                        className={cn(
                          "flex items-center justify-center rounded-lg border py-1.5",
                          selected.alignment === id
                            ? "border-violet-500 bg-violet-600/15 text-violet-200"
                            : "border-zinc-800 bg-zinc-950/60 text-zinc-400"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ))}
                  </div>
                </div>

                {(
                  [
                    ["Position X", "x", 0, 100, "%"],
                    ["Position Y", "y", 0, 100, "%"],
                    ["Scale", "fontSize", 16, 180, "px"],
                    ["Rotation", "rotation", -180, 180, "°"],
                  ] as const
                ).map(([label, key, min, max, suffix]) => (
                  <label key={key} className="block">
                    <span className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{label}</span>
                      <span className="tabular-nums">
                        {Math.round(selected[key])}
                        {suffix}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={1}
                      value={selected[key]}
                      onChange={(e) => patchSelected({ [key]: Number(e.target.value) })}
                      className="mt-0.5 w-full accent-violet-500"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Opacity</span>
                    <span className="tabular-nums">{Math.round(selected.opacity)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={selected.opacity}
                    onChange={(e) => patchSelected({ opacity: Number(e.target.value) })}
                    className="mt-0.5 w-full accent-violet-500"
                  />
                </label>
                <label className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={selected.mask}
                    onChange={(e) => patchSelected({ mask: e.target.checked })}
                    className="accent-violet-500"
                  />
                  Mask (clip to text box)
                </label>
              </>
            )}

            <AiStudioSection selected={selected} />

            {/* Global caption animation + style (applies to AI captions) */}
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Caption Style
              </p>
              <label className="block">
                <span className="mb-1 block text-[10px] text-zinc-400">Animation</span>
                <select
                  value={captionStyle.animation}
                  onChange={(e) =>
                    setCaptionStyle({ animation: e.target.value as CaptionAnimation })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-100"
                >
                  <option value="none">None</option>
                  <option value="pop">Pop-in</option>
                  <option value="bounce">Bounce</option>
                  <option value="karaoke">Karaoke</option>
                  <option value="typewriter">Typewriter</option>
                  <option value="fadeIn">Fade In</option>
                  <option value="neon">Neon Glow</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={captionStyle.activeWordHighlight}
                    onChange={(e) =>
                      setCaptionStyle({ activeWordHighlight: e.target.checked })
                    }
                    className="accent-violet-500"
                  />
                  Word highlight
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={captionStyle.textStroke}
                    onChange={(e) => setCaptionStyle({ textStroke: e.target.checked })}
                    className="accent-violet-500"
                  />
                  Outline
                </label>
              </div>
              <label className="flex items-center justify-between text-[10px] text-zinc-400">
                Highlight color
                <input
                  type="color"
                  value={captionStyle.highlightColor}
                  onChange={(e) => setCaptionStyle({ highlightColor: e.target.value })}
                  className="h-6 w-12 rounded border border-zinc-800 bg-zinc-950"
                />
              </label>
            </div>
          </div>
        )}

        {tab === "clip" && (
          <div className="space-y-4">
            {/* Trim — remove the start/end of the clip */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Trim
              </p>
              <p className="text-[10px] text-zinc-500">
                Source {duration.toFixed(1)}s · Clip{" "}
                {Math.max(0, trimEnd - trimStart).toFixed(1)}s
              </p>
              <label className="block">
                <span className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Start (In)</span>
                  <span className="tabular-nums">{trimStart.toFixed(1)}s</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(trimEnd - 0.1, 0.1)}
                  step={0.1}
                  value={trimStart}
                  disabled={duration <= 0}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  className="mt-0.5 w-full accent-violet-500 disabled:opacity-40"
                />
              </label>
              <label className="block">
                <span className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>End (Out)</span>
                  <span className="tabular-nums">{trimEnd.toFixed(1)}s</span>
                </span>
                <input
                  type="range"
                  min={trimStart + 0.1}
                  max={Math.max(duration, 0.1)}
                  step={0.1}
                  value={trimEnd}
                  disabled={duration <= 0}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                  className="mt-0.5 w-full accent-violet-500 disabled:opacity-40"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTrimStart(currentTime)}
                  disabled={duration <= 0}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300 hover:border-zinc-600 disabled:opacity-40"
                >
                  Set In @ playhead
                </button>
                <button
                  type="button"
                  onClick={() => setTrimEnd(currentTime)}
                  disabled={duration <= 0}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300 hover:border-zinc-600 disabled:opacity-40"
                >
                  Set Out @ playhead
                </button>
              </div>
              <button
                type="button"
                onClick={resetTrim}
                disabled={duration <= 0}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300 hover:border-zinc-600 disabled:opacity-40"
              >
                Reset trim (full clip)
              </button>
            </div>

            {/* Framing / crop */}
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Framing
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["contain", "cover"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFit(mode)}
                    aria-pressed={fit === mode}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[11px] transition-colors",
                      fit === mode
                        ? "border-violet-500 bg-violet-600/15 text-violet-200"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                    )}
                  >
                    {mode === "contain" ? "Fit" : "Fill & Crop"}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Position X</span>
                  <span className="tabular-nums">{Math.round(offsetX)}%</span>
                </span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={offsetX}
                  disabled={fit !== "cover"}
                  onChange={(e) => setOffset(Number(e.target.value), offsetY)}
                  className="mt-0.5 w-full accent-violet-500 disabled:opacity-40"
                />
              </label>
              <label className="block">
                <span className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Position Y</span>
                  <span className="tabular-nums">{Math.round(offsetY)}%</span>
                </span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={offsetY}
                  disabled={fit !== "cover"}
                  onChange={(e) => setOffset(offsetX, Number(e.target.value))}
                  className="mt-0.5 w-full accent-violet-500 disabled:opacity-40"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setFit("contain");
                  setOffset(0, 0);
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300 hover:border-zinc-600"
              >
                Reset framing
              </button>
            </div>
          </div>
        )}

        {tab === "captions" && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-zinc-400">
                Spoken language
              </span>
              <select
                value={captionLanguage}
                onChange={(e) =>
                  setCaptionLanguage(e.target.value as CaptionLanguageId)
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {CAPTION_LANGUAGES.map((language) => (
                  <option key={language.id} value={language.id}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleAutoCaptions()}
              disabled={transcribing || !hasVideo}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient brand-gradient-hover px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              {transcribing ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              {transcribing ? "Transcribing…" : "Auto-generate AI captions"}
              {!transcribing && (
                <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px]">
                  {CAPTIONS_CREDIT_COST}
                </span>
              )}
            </button>

            {transcribing && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="truncate">{transcribingStatus || "Working…"}</span>
                  <span className="tabular-nums">{transcribingProgress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="brand-gradient h-full"
                    style={{ width: `${Math.max(2, transcribingProgress)}%` }}
                  />
                </div>
              </div>
            )}

            {(transcriptionError || captionError) && (
              <p role="alert" className="text-[10px] leading-4 text-red-400">
                {captionError ?? transcriptionError}
              </p>
            )}

            {autoCaptionCount > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
                <span className="text-[10px] text-zinc-400">
                  {autoCaptionCount} AI caption{autoCaptionCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={clearAutoCaptions}
                  className="text-[10px] text-zinc-500 hover:text-red-400"
                >
                  Clear
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={addOverlay}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-200 hover:border-zinc-600"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add text overlay
            </button>

            {overlays.length > 0 && (
              <ul className="space-y-1.5">
                {overlays.map((overlay) => (
                  <li
                    key={overlay.id}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px]",
                      overlay.id === selectedId
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-zinc-800 bg-zinc-950/60"
                    )}
                  >
                    <Captions className="h-3 w-3 shrink-0 text-violet-400" aria-hidden />
                    <button
                      type="button"
                      onClick={() => selectOverlay(overlay.id)}
                      className="min-w-0 flex-1 truncate text-left text-zinc-300"
                    >
                      {overlay.text || "Untitled"}
                    </button>
                    {overlay.auto && (
                      <span className="shrink-0 rounded bg-violet-500/15 px-1 text-[9px] uppercase text-violet-300">
                        AI
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeOverlay(overlay.id)}
                      aria-label="Delete caption"
                      className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "studio" && (
          <div className="space-y-3">
            <p className="text-[10px] leading-4 text-zinc-500">
              Design a cricket jersey or match-day poster, then send it to the
              timeline as a V2 overlay.
            </p>
            <StudioPanel />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Top-center: Program monitor + transport                              */
/* ------------------------------------------------------------------ */
function ProgramPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef(true);
  const [loop, setLoop] = useState(true);

  const playing = useEditorStore((s) => s.playing);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const fps = useEditorStore((s) => s.fps);
  const hasVideo = useEditorStore((s) => s.videoEl !== null);
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const hdRendering = useEditorStore((s) => s.hdRendering);
  const setHdRendering = useEditorStore((s) => s.setHdRendering);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const seek = useEditorStore((s) => s.seek);
  const setTrimStart = useEditorStore((s) => s.setTrimStart);
  const setTrimEnd = useEditorStore((s) => s.setTrimEnd);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let lastSync = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!canvas.isConnected || canvas.offsetParent === null) return;

      const state = useEditorStore.getState();
      const { width, height } = ASPECT_RESOLUTIONS[state.aspect];
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const video = state.videoEl;
      if (video && !video.paused && !video.ended) {
        const now = performance.now();
        if (now - lastSync >= 100) {
          lastSync = now;
          if (Math.abs(video.currentTime - useEditorStore.getState().currentTime) > 0.01) {
            useEditorStore.setState({ currentTime: video.currentTime });
          }
        }
        if (state.duration > 0 && video.currentTime >= state.trimEnd - 0.02) {
          if (loopRef.current) video.currentTime = state.trimStart;
          else state.setPlaying(false);
        }
      }

      drawScene(
        ctx,
        video,
        {
          width,
          height,
          fit: state.fit,
          offsetX: state.offsetX,
          offsetY: state.offsetY,
          overlays: state.overlays,
          captionStyle: state.captionStyle,
          colorAdjustments: state.colorAdjustments,
          activeEffects: state.activeEffects,
          crisp: state.hdRendering,
          sceneTime: video ? video.currentTime : state.currentTime,
        },
        { placeholder: true }
      );
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const res = ASPECT_RESOLUTIONS[aspect];

  return (
    <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Program Monitor
        </span>
        {/* Aspect-ratio switcher: 16:9 ↔ 9:16 ↔ 1:1 */}
        <div className="flex items-center gap-1" role="group" aria-label="Aspect ratio">
          {(["9:16", "16:9", "1:1"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAspect(option)}
              aria-pressed={aspect === option}
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
                aspect === option
                  ? "brand-gradient text-white"
                  : "border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-100"
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {res.width}×{res.height} · {fps}fps
        </span>
        <button
          type="button"
          onClick={() => setHdRendering(!hdRendering)}
          aria-pressed={hdRendering}
          title="High-quality (crisp) scaling"
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
            hdRendering
              ? "bg-violet-600/20 text-violet-200 ring-1 ring-inset ring-violet-500/40"
              : "border border-zinc-800 bg-zinc-950/60 text-zinc-500"
          )}
        >
          HD
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3">
        <canvas ref={canvasRef} className="max-h-full max-w-full rounded-lg ring-1 ring-zinc-800" aria-label="Program preview" />
      </div>

      {/* Transport */}
      <div className="space-y-2 border-t border-zinc-800 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded bg-zinc-950 px-2 py-1 font-mono text-[11px] tabular-nums text-emerald-300 ring-1 ring-inset ring-zinc-800">
            {formatTimecode(currentTime, fps)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.01}
            value={Math.min(currentTime, duration)}
            disabled={!hasVideo}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Scrub"
            className="min-w-[120px] flex-1 accent-violet-500"
          />
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
            {formatTimecode(duration, fps)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-300 transition-colors hover:border-zinc-600"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={redo}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-300 transition-colors hover:border-zinc-600"
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            disabled={!hasVideo}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
          >
            {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5 translate-x-px" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            aria-pressed={loop}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px]",
              loop ? "border-violet-500/50 bg-violet-500/10 text-violet-200" : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
            )}
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden /> Loop
          </button>
          <button
            type="button"
            onClick={() => setTrimStart(currentTime)}
            disabled={!hasVideo}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-300 disabled:opacity-40"
          >
            <Scissors className="h-3.5 w-3.5" aria-hidden /> Mark In
          </button>
          <button
            type="button"
            onClick={() => setTrimEnd(currentTime)}
            disabled={!hasVideo}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-300 disabled:opacity-40"
          >
            <Scissors className="h-3.5 w-3.5 -scale-x-100" aria-hidden /> Mark Out
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Top-right: Lumetri colour + scopes                                   */
/* ------------------------------------------------------------------ */
function LumetriPanel() {
  const adjustments = useEditorStore((s) => s.colorAdjustments);
  const setColorAdjustment = useEditorStore((s) => s.setColorAdjustment);
  const resetColorAdjustments = useEditorStore((s) => s.resetColorAdjustments);
  const scopeRef = useRef<HTMLCanvasElement>(null);

  const [wheels, setWheels] = useState<Record<WheelKey, WheelValue>>({
    master: { x: 0, y: 0 },
    shadows: { x: 0, y: 0 },
    midtones: { x: 0, y: 0 },
    highlights: { x: 0, y: 0 },
  });
  const [presetId, setPresetId] = useState("none");
  const [presetIntensity, setPresetIntensity] = useState(100);

  const applyPreset = (id: string, intensity: number) => {
    const preset = CINEMATIC_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const k = intensity / 100;
    const patch: Record<string, number> = {};
    for (const [key, value] of Object.entries(preset.patch)) {
      patch[key] = Math.round(value * k);
    }
    resetColorAdjustments();
    setColorAdjustment(patch);
  };

  // Fold the wheels into the render's hue/tint colour model.
  useEffect(() => {
    const angleOf = (v: WheelValue) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
    const radOf = (v: WheelValue) => Math.min(1, Math.hypot(v.x, v.y));
    const hue = Math.max(
      -180,
      Math.min(
        180,
        angleOf(wheels.master) * radOf(wheels.master) +
          0.25 *
            (angleOf(wheels.shadows) * radOf(wheels.shadows) +
              angleOf(wheels.midtones) * radOf(wheels.midtones) +
              angleOf(wheels.highlights) * radOf(wheels.highlights))
      )
    );
    const tint = Math.max(
      -100,
      Math.min(
        100,
        radOf(wheels.master) * 100 +
          15 *
            (radOf(wheels.shadows) +
              radOf(wheels.midtones) +
              radOf(wheels.highlights))
      )
    );
    setColorAdjustment({ hue: Math.round(hue), tint: Math.round(tint) });
  }, [wheels, setColorAdjustment]);

  // Lightweight real luminance histogram of the current frame.
  useEffect(() => {
    const canvas = scopeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sample = document.createElement("canvas");
    sample.width = 120;
    sample.height = 68;
    const sampleCtx = sample.getContext("2d");

    const id = window.setInterval(() => {
      const video = useEditorStore.getState().videoEl;
      if (!sampleCtx || !video || video.readyState < 2 || canvas.offsetParent === null) return;
      sampleCtx.drawImage(video, 0, 0, sample.width, sample.height);
      const { data } = sampleCtx.getImageData(0, 0, sample.width, sample.height);
      const bins = new Array(32).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        bins[Math.min(31, Math.floor(luma * 32))] += 1;
      }
      const max = Math.max(1, ...bins);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barW = canvas.width / bins.length;
      bins.forEach((count, index) => {
        const h = (count / max) * canvas.height;
        ctx.fillStyle = "#a78bfa";
        ctx.fillRect(index * barW, canvas.height - h, barW - 1, h);
      });
    }, 500);

    return () => window.clearInterval(id);
  }, []);

  const sliders = [
    ["Exposure", "exposure", -100, 100],
    ["Brightness", "brightness", -100, 100],
    ["Contrast", "contrast", -100, 100],
    ["Saturation", "saturation", -100, 100],
    ["Temperature", "hue", -180, 180],
    ["Tint", "tint", -100, 100],
  ] as const;

  return (
    <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className={panelTitle}>Lumetri Color &amp; Scopes</div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Color Wheels
          </p>
          <div className="grid grid-cols-2 justify-items-center gap-2">
            <ColorWheel label="Master" value={wheels.master} onChange={(v) => setWheels((p) => ({ ...p, master: v }))} />
            <ColorWheel label="Shadows" value={wheels.shadows} onChange={(v) => setWheels((p) => ({ ...p, shadows: v }))} />
            <ColorWheel label="Midtones" value={wheels.midtones} onChange={(v) => setWheels((p) => ({ ...p, midtones: v }))} />
            <ColorWheel label="Highlights" value={wheels.highlights} onChange={(v) => setWheels((p) => ({ ...p, highlights: v }))} />
          </div>
        </div>

        {sliders.map(([label, key, min, max]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-zinc-500">{label}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={adjustments[key]}
                onChange={(e) => setColorAdjustment({ [key]: Number(e.target.value) })}
                aria-label={label}
                className="w-full accent-violet-500"
              />
            </div>
            <input
              type="number"
              min={min}
              max={max}
              step={1}
              value={Math.round(adjustments[key])}
              onChange={(e) => setColorAdjustment({ [key]: Number(e.target.value) })}
              aria-label={`${label} value`}
              className="w-14 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-right text-[11px] tabular-nums text-zinc-100 focus:border-violet-500 focus:outline-none"
            />
          </div>
        ))}

        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Cinematic Presets
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {CINEMATIC_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setPresetId(preset.id);
                  applyPreset(preset.id, presetIntensity);
                }}
                aria-pressed={presetId === preset.id}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                  presetId === preset.id
                    ? "border-violet-500 bg-violet-600/15 text-violet-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Intensity</span>
              <span className="tabular-nums">{presetIntensity}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={presetIntensity}
              onChange={(e) => {
                const value = Number(e.target.value);
                setPresetIntensity(value);
                if (presetId !== "none") applyPreset(presetId, value);
              }}
              className="mt-0.5 w-full accent-violet-500"
            />
          </label>
        </div>

        <div className="pt-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Luma scopes
          </p>
          <canvas ref={scopeRef} width={240} height={90} className="h-24 w-full rounded-lg bg-zinc-950 ring-1 ring-inset ring-zinc-800" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom: multi-track Premiere timeline                                */
/* ------------------------------------------------------------------ */
type TrackKey = "V3" | "V2" | "V1" | "A1" | "A2";

function PremiereTimeline() {
  const assets = useEditorStore((s) => s.assets);
  const sequence = useEditorStore((s) => s.sequence);
  const overlays = useEditorStore((s) => s.overlays);
  const activeEffects = useEditorStore((s) => s.activeEffects);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const selectedId = useEditorStore((s) => s.selectedId);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const fps = useEditorStore((s) => s.fps);
  const selectClip = useEditorStore((s) => s.selectClip);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);
  const seek = useEditorStore((s) => s.seek);
  const setClipTrim = useEditorStore((s) => s.setClipTrim);
  const setTrimStart = useEditorStore((s) => s.setTrimStart);
  const setTrimEnd = useEditorStore((s) => s.setTrimEnd);
  const removeClip = useEditorStore((s) => s.removeClip);
  const removeAudioTrack = useEditorStore((s) => s.removeAudioTrack);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);
  const removeEffect = useEditorStore((s) => s.removeEffect);
  const setOverlayStartTime = useEditorStore((s) => s.setOverlayStartTime);
  const setOverlayEndTime = useEditorStore((s) => s.setOverlayEndTime);
  const updateEffect = useEditorStore((s) => s.updateEffect);

  const [pps, setPps] = useState(48);
  const [toggles, setToggles] = useState<Record<TrackKey, { m: boolean; s: boolean; lock: boolean; eye: boolean }>>({
    V3: { m: false, s: false, lock: false, eye: true },
    V2: { m: false, s: false, lock: false, eye: true },
    V1: { m: false, s: false, lock: false, eye: true },
    A1: { m: false, s: false, lock: false, eye: true },
    A2: { m: false, s: false, lock: false, eye: true },
  });

  const nameFor = (assetId: string) =>
    assets.find((a) => a.id === assetId)?.name ?? "Clip";

  // Cumulative timeline positions for V1 clips.
  const videoBlocks = sequence.reduce<{ clip: (typeof sequence)[number]; start: number; dur: number }[]>(
    (acc, clip) => {
      const prev = acc[acc.length - 1];
      const start = prev ? prev.start + prev.dur : 0;
      const dur = Math.max(0.1, clip.trimEnd - clip.trimStart);
      acc.push({ clip, start, dur });
      return acc;
    },
    []
  );

  const timelineDuration = Math.max(
    duration || 0,
    videoBlocks.reduce((sum, b) => sum + b.dur, 0),
    ...audioTracks.map((t) => t.startTime + t.duration),
    5
  );

  const laneRef = useRef<HTMLDivElement>(null);

  const trimDragRef = useRef<{
    clipId: string;
    side: "in" | "out";
    startX: number;
    trimStart: number;
    trimEnd: number;
    sourceMax: number;
  } | null>(null);

  const onTrimDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    clip: { id: string; trimStart: number; trimEnd: number },
    side: "in" | "out"
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const sourceMax =
      clip.id === activeClipId && duration > 0 ? duration : clip.trimEnd;
    trimDragRef.current = {
      clipId: clip.id,
      side,
      startX: e.clientX,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
      sourceMax,
    };
  };
  const onTrimMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = trimDragRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    if (d.side === "in") {
      const next = Math.min(Math.max(d.trimStart + delta, 0), d.trimEnd - 0.2);
      if (d.clipId === activeClipId) setTrimStart(next);
      else setClipTrim(d.clipId, { trimStart: next });
    } else {
      const next = Math.max(
        Math.min(d.trimEnd + delta, d.sourceMax),
        d.trimStart + 0.2
      );
      if (d.clipId === activeClipId) setTrimEnd(next);
      else setClipTrim(d.clipId, { trimEnd: next });
    }
  };
  const onTrimUp = () => {
    trimDragRef.current = null;
  };

  const overlayDragRef = useRef<{
    id: string;
    side: "in" | "out";
    startX: number;
    startTime: number;
    endTime: number;
  } | null>(null);
  const onOverlayTrimDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    overlay: { id: string; startTime: number; endTime: number },
    side: "in" | "out"
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    overlayDragRef.current = {
      id: overlay.id,
      side,
      startX: e.clientX,
      startTime: overlay.startTime,
      endTime: overlay.endTime,
    };
  };
  const onOverlayTrimMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = overlayDragRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    if (d.side === "in") {
      setOverlayStartTime(d.id, Math.max(0, Math.min(d.startTime + delta, d.endTime - 0.2)));
    } else {
      setOverlayEndTime(d.id, Math.max(d.startTime + 0.2, d.endTime + delta));
    }
  };
  const onOverlayTrimUp = () => {
    overlayDragRef.current = null;
  };

  const effectDragRef = useRef<{
    id: string;
    side: "in" | "out";
    startX: number;
    startTime: number;
    duration: number;
  } | null>(null);
  const onEffectTrimDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    effect: { id: string; startTime: number; duration: number },
    side: "in" | "out"
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    effectDragRef.current = {
      id: effect.id,
      side,
      startX: e.clientX,
      startTime: effect.startTime,
      duration: effect.duration,
    };
  };
  const onEffectTrimMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = effectDragRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    if (d.side === "in") {
      updateEffect(d.id, {
        startTime: Math.max(0, d.startTime + delta),
        duration: Math.max(0.1, d.duration - delta),
      });
    } else {
      updateEffect(d.id, { duration: Math.max(0.1, d.duration + delta) });
    }
  };
  const onEffectTrimUp = () => {
    effectDragRef.current = null;
  };

  const seekFromClientX = (clientX: number) => {
    const lane = laneRef.current;
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const time = (clientX - rect.left) / pps;
    seek(Math.min(Math.max(time, 0), timelineDuration));
  };

  const onScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const onScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    seekFromClientX(e.clientX);
  };

  const ticks = Math.max(1, Math.ceil(timelineDuration / 5));
  const toggleTrack = (key: TrackKey, field: "m" | "s" | "lock" | "eye") =>
    setToggles((prev) => ({ ...prev, [key]: { ...prev[key], [field]: !prev[key][field] } }));

  const audioByLane = (lane: 0 | 1) => audioTracks.filter((_, i) => i % 2 === lane);

  const videoChip = "rounded-md bg-gradient-to-b from-violet-500/80 to-blue-600/70 text-[10px] text-white ring-1 ring-inset ring-white/20";
  const adjustChip = "rounded-md bg-gradient-to-b from-pink-500/80 to-fuchsia-600/70 text-[10px] text-white ring-1 ring-inset ring-white/20";
  const audioChip = "rounded-md bg-gradient-to-b from-teal-500/80 to-emerald-600/70 text-[10px] text-white ring-1 ring-inset ring-white/20";

  const TrackHeader = ({ keyName }: { keyName: TrackKey }) => {
    const t = toggles[keyName];
    const btn =
      "flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold transition-colors";
    return (
      <div className="flex h-12 w-24 shrink-0 items-center gap-1 border-b border-r border-zinc-800 bg-zinc-900/60 px-1.5">
        <span className="mr-0.5 w-6 shrink-0 text-[10px] font-semibold text-zinc-300">{keyName}</span>
        <button type="button" aria-label={`Mute ${keyName}`} onClick={() => toggleTrack(keyName, "m")} className={cn(btn, t.m ? "bg-amber-500/30 text-amber-300" : "text-zinc-500 hover:text-zinc-200")}>M</button>
        <button type="button" aria-label={`Solo ${keyName}`} onClick={() => toggleTrack(keyName, "s")} className={cn(btn, t.s ? "bg-sky-500/30 text-sky-300" : "text-zinc-500 hover:text-zinc-200")}>S</button>
        <button type="button" aria-label={`Lock ${keyName}`} onClick={() => toggleTrack(keyName, "lock")} className={cn(btn, "text-zinc-500 hover:text-zinc-200")}>
          {t.lock ? <Lock className="h-3 w-3" aria-hidden /> : <Unlock className="h-3 w-3" aria-hidden />}
        </button>
        <button type="button" aria-label={`${t.eye ? "Hide" : "Show"} ${keyName}`} onClick={() => toggleTrack(keyName, "eye")} className={cn(btn, "text-zinc-500 hover:text-zinc-200")}>
          {t.eye ? <Eye className="h-3 w-3" aria-hidden /> : <EyeOff className="h-3 w-3" aria-hidden />}
        </button>
      </div>
    );
  };

  return (
    <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
      {/* Timeline toolbar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Timeline
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          {formatTimecode(currentTime, fps)} / {formatTimecode(timelineDuration, fps)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" aria-label="Zoom out" onClick={() => setPps((v) => Math.max(12, v - 12))} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 text-zinc-300 hover:border-zinc-600">
            <ZoomOut className="h-3.5 w-3.5" aria-hidden />
          </button>
          <input type="range" min={12} max={200} step={4} value={pps} onChange={(e) => setPps(Number(e.target.value))} aria-label="Timeline zoom" className="w-28 accent-violet-500" />
          <button type="button" aria-label="Zoom in" onClick={() => setPps((v) => Math.min(200, v + 12))} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 text-zinc-300 hover:border-zinc-600">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Track headers column */}
        <div className="flex shrink-0 flex-col">
          <div className="h-6 w-24 border-b border-r border-zinc-800 bg-zinc-900/60" />
          {(["V3", "V2", "V1", "A1", "A2"] as TrackKey[]).map((keyName) => (
            <TrackHeader key={keyName} keyName={keyName} />
          ))}
        </div>

        {/* Ruler + lanes */}
        <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: `${Math.max(timelineDuration * pps, 400)}px` }} ref={laneRef}>
            {/* Ruler */}
            <div
              className="relative h-6 select-none border-b border-zinc-800 bg-zinc-900/40"
              onPointerDown={onScrubPointerDown}
              onPointerMove={onScrubPointerMove}
            >
              {Array.from({ length: ticks + 1 }).map((_, i) => {
                const t = i * 5;
                return (
                  <div key={i} className="absolute top-0 h-full border-l border-zinc-800 pl-1 text-[9px] tabular-nums text-zinc-500" style={{ left: `${t * pps}px` }}>
                    {formatTimecode(t, fps).slice(3, 8)}
                  </div>
                );
              })}
            </div>

            {/* V3 — adjustment / effect layers (pink) */}
            <div className="relative h-12 border-b border-zinc-800 bg-zinc-950/40">
              {activeEffects.map((fx) => (
                <div
                  key={fx.id}
                  className={cn("group absolute inset-y-1.5 overflow-hidden px-1.5", adjustChip)}
                  style={{ left: `${fx.startTime * pps}px`, width: `${Math.max(20, fx.duration * pps)}px` }}
                  title={`Effect: ${fx.type}`}
                >
                  <span className="block truncate capitalize">{fx.type}</span>
                  <button
                    type="button"
                    aria-label="Trim effect start"
                    onPointerDown={(e) => onEffectTrimDown(e, fx, "in")}
                    onPointerMove={onEffectTrimMove}
                    onPointerUp={onEffectTrimUp}
                    className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize rounded-l-md bg-white/25 transition-colors hover:bg-white/60"
                  />
                  <button
                    type="button"
                    aria-label="Trim effect end"
                    onPointerDown={(e) => onEffectTrimDown(e, fx, "out")}
                    onPointerMove={onEffectTrimMove}
                    onPointerUp={onEffectTrimUp}
                    className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-ew-resize rounded-r-md bg-white/25 transition-colors hover:bg-white/60"
                  />
                  <button
                    type="button"
                    aria-label="Delete effect"
                    onClick={() => removeEffect(fx.id)}
                    className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-black/75 text-zinc-100 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            {/* V2 — text / overlay layers (pink) */}
            <div className="relative h-12 border-b border-zinc-800 bg-zinc-950/40">
              {overlays.map((o) => (
                <div
                  key={o.id}
                  className="group absolute inset-y-1.5"
                  style={{ left: `${o.startTime * pps}px`, width: `${Math.max(24, (o.endTime - o.startTime) * pps)}px` }}
                >
                  <button
                    type="button"
                    onClick={() => selectOverlay(o.id)}
                    className={cn("h-full w-full overflow-hidden px-1.5 text-left", adjustChip, o.id === selectedId && "ring-2 ring-white/70")}
                  >
                    <span className="block truncate">
                      {o.text || (o.imageSrc ? "Image" : "Text")}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Trim overlay start"
                    onPointerDown={(e) => onOverlayTrimDown(e, o, "in")}
                    onPointerMove={onOverlayTrimMove}
                    onPointerUp={onOverlayTrimUp}
                    className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize rounded-l-md bg-white/25 transition-colors hover:bg-white/60"
                  />
                  <button
                    type="button"
                    aria-label="Trim overlay end"
                    onPointerDown={(e) => onOverlayTrimDown(e, o, "out")}
                    onPointerMove={onOverlayTrimMove}
                    onPointerUp={onOverlayTrimUp}
                    className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-ew-resize rounded-r-md bg-white/25 transition-colors hover:bg-white/60"
                  />
                  <button
                    type="button"
                    aria-label="Delete overlay"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOverlay(o.id);
                    }}
                    className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-black/75 text-zinc-100 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            {/* V1 — video clips (purple/blue) with trim handles */}
            <div className="relative h-12 border-b border-zinc-800 bg-zinc-950/40">
              {videoBlocks.map(({ clip, start, dur }) => (
                <div
                  key={clip.id}
                  className="group absolute inset-y-1.5"
                  style={{ left: `${start * pps}px`, width: `${Math.max(28, dur * pps)}px` }}
                >
                  <button
                    type="button"
                    onClick={() => selectClip(clip.id)}
                    className={cn(
                      "h-full w-full overflow-hidden px-2 text-left",
                      videoChip,
                      clip.id === activeClipId && "ring-2 ring-white/70"
                    )}
                  >
                    <span className="block truncate">{nameFor(clip.assetId)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Trim start"
                    onPointerDown={(e) => onTrimDown(e, clip, "in")}
                    onPointerMove={onTrimMove}
                    onPointerUp={onTrimUp}
                    className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md bg-white/25 transition-colors hover:bg-white/60"
                  />
                  <button
                    type="button"
                    aria-label="Trim end"
                    onPointerDown={(e) => onTrimDown(e, clip, "out")}
                    onPointerMove={onTrimMove}
                    onPointerUp={onTrimUp}
                    className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md bg-white/25 transition-colors hover:bg-white/60"
                  />
                  <button
                    type="button"
                    aria-label="Delete clip"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeClip(clip.id);
                    }}
                    className="absolute right-1 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-black/75 text-zinc-100 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            {/* A1 / A2 — audio tracks (teal/green) */}
            {([0, 1] as const).map((lane) => (
              <div key={lane} className="relative h-12 border-b border-zinc-800 bg-zinc-950/40">
                {audioByLane(lane).map((track) => (
                  <div
                    key={track.id}
                    className={cn("group absolute inset-y-1.5 flex items-center gap-1 overflow-hidden px-1.5", audioChip)}
                    style={{ left: `${track.startTime * pps}px`, width: `${Math.max(28, track.duration * pps)}px` }}
                    title={track.name}
                  >
                    <Music className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{track.name}</span>
                    <button
                      type="button"
                      aria-label="Remove audio"
                      onClick={() => removeAudioTrack(track.id)}
                      className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-black/75 text-zinc-100 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ))}

            {/* Playhead */}
            <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-fuchsia-400" style={{ left: `${currentTime * pps}px` }}>
              <span className="absolute -top-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-sm bg-fuchsia-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function DesktopEditor({
  onRequireCredits,
  onBatchExport,
}: {
  onRequireCredits?: () => void;
  onBatchExport?: (clipIds: string[]) => void;
}) {
  // Desktop-only keyboard shortcuts for undo/redo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        useEditorStore.getState().undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        useEditorStore.getState().redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid min-h-0 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[320px_minmax(0,1fr)_340px]" style={{ height: "min(58vh, 600px)", minHeight: 380 }}>
        <ProjectBinPanel onRequireCredits={onRequireCredits} onBatchExport={onBatchExport} />
        <ProgramPreview />
        <LumetriPanel />
      </div>
      <PremiereTimeline />
    </div>
  );
}
