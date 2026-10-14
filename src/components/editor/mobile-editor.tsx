"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  AudioLines,
  Captions,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Copy,
  Crop,
  Diamond,
  Film,
  Gauge,
  GripVertical,
  Layers,
  Maximize2,
  Mic,
  Minimize2,
  Music,
  Pause,
  Pipette,
  Play,
  Plus,
  Redo2,
  Scissors,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import { ASPECT_RESOLUTIONS, drawScene, speedAt } from "@/lib/render";
import {
  TRANSITION_PRESETS,
  useEditorStore,
  type AspectRatio,
  type VideoEffectType,
} from "@/store/editor";
import { CAPTION_LANGUAGES } from "@/lib/transcribe";
import { useOverlayCanvasDrag } from "@/components/editor/use-overlay-drag";
import { usePointerDrag } from "@/lib/timeline-drag";
import { audioPreview } from "@/lib/audio-preview";
import { SOUND_EFFECTS } from "@/lib/sfx";
import { createDictation, isDictationSupported } from "@/lib/dictation";
import { STICKER_CATEGORIES, STICKERS, stickerImageSrc, type StickerCategory } from "@/lib/stickers";
import { Waveform } from "@/components/editor/waveform";
import { createLevelMeter, startCapture, type ActiveCapture } from "@/lib/recorder";
import { cn } from "@/lib/utils";


function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const EFFECT_CARDS: { type: VideoEffectType; label: string; Icon: typeof Wand2 }[] = [
  { type: "zoom-in", label: "Zoom In", Icon: Wand2 },
  { type: "zoom-out", label: "Zoom Out", Icon: SlidersHorizontal },
  { type: "camera-shake", label: "Shake", Icon: Gauge },
  { type: "flash", label: "Flash", Icon: Sparkles },
  { type: "blur-vignette", label: "Vignette", Icon: Layers },
];

const FILTERS: { id: string; label: string; swatch: string; patch: Record<string, number> }[] = [
  { id: "none", label: "None", swatch: "linear-gradient(135deg,#3f3f46,#18181b)", patch: {} },
  { id: "glitch", label: "Glitch", swatch: "linear-gradient(135deg,#22d3ee,#f43f5e,#a855f7)", patch: { contrast: 40, saturation: 60, hue: 20, tint: 30 } },
  { id: "blur", label: "Blur", swatch: "linear-gradient(135deg,#64748b,#334155)", patch: { blur: 8 } },
  { id: "vhs", label: "VHS", swatch: "linear-gradient(135deg,#f59e0b,#10b981,#3b82f6)", patch: { saturation: 45, hue: -12, contrast: 18, blur: 2 } },
  { id: "cyberpunk", label: "Cyberpunk", swatch: "linear-gradient(135deg,#d946ef,#06b6d4)", patch: { saturation: 55, hue: -60, tint: 40, contrast: 30 } },
  { id: "cinematic", label: "Cinematic", swatch: "linear-gradient(135deg,#0ea5e9,#f59e0b)", patch: { contrast: 22, saturation: -8, hue: 8, blur: 1 } },
  { id: "bw", label: "B&W", swatch: "linear-gradient(135deg,#e5e7eb,#111827)", patch: { saturation: -100, contrast: 14 } },
];

const SPEED_PRESETS = ["none", "montage", "hero", "bullet", "jumpCut"] as const;

const SPEED_PRESET_LABELS: Record<(typeof SPEED_PRESETS)[number], string> = {
  none: "Normal",
  montage: "Montage",
  hero: "Hero Ramp",
  bullet: "Bullet",
  jumpCut: "Jump Cut",
};

/** One-click cinematic looks (mobile cards + desktop Lumetri presets). */
const CINEMATIC_PRESETS: {
  id: string;
  label: string;
  note: string;
  swatch: string;
  patch: Record<string, number>;
}[] = [
  { id: "tealorange", label: "Teal & Orange", note: "Blockbuster", swatch: "linear-gradient(135deg,#0ea5e9,#f97316)", patch: { saturation: 22, contrast: 16, hue: 6, tint: 10 } },
  { id: "noir", label: "Moody Noir", note: "Dramatic", swatch: "linear-gradient(135deg,#111827,#6b7280)", patch: { saturation: -70, contrast: 30, brightness: -6 } },
  { id: "cyberpunk", label: "Cyberpunk", note: "Neon", swatch: "linear-gradient(135deg,#d946ef,#22d3ee)", patch: { saturation: 48, contrast: 26, hue: -55, tint: 36 } },
  { id: "golden", label: "Golden Hour", note: "Warm", swatch: "linear-gradient(135deg,#f59e0b,#fde68a)", patch: { saturation: 18, contrast: 8, brightness: 6, hue: 14, tint: 8 } },
];

/** Touch sliders for lighting + colour grading. */
function AdjustPanel() {
  const adjustments = useEditorStore((s) => s.colorAdjustments);
  const setColorAdjustment = useEditorStore((s) => s.setColorAdjustment);
  const resetColorAdjustments = useEditorStore((s) => s.resetColorAdjustments);
  const rows = [
    ["Brightness", "brightness", -100, 100],
    ["Exposure", "exposure", -100, 100],
    ["Contrast", "contrast", -100, 100],
    ["Saturation", "saturation", -100, 100],
  ] as const;
  return (
    <div className="space-y-4">
      {rows.map(([label, key, min, max]) => (
        <label key={key} className="block">
          <span className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>{label}</span>
            <span className="tabular-nums text-zinc-500">
              {Math.round(adjustments[key])}
            </span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={adjustments[key]}
            onChange={(e) => setColorAdjustment({ [key]: Number(e.target.value) })}
            className="mt-1 w-full accent-violet-500"
          />
        </label>
      ))}
      <button
        type="button"
        onClick={resetColorAdjustments}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-zinc-600"
      >
        Reset adjustments
      </button>
    </div>
  );
}

const ASPECTS: AspectRatio[] = ["9:16", "16:9", "1:1", "21:9"];

/** Generic bottom drawer sheet (portaled above the mobile layout). */
function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  if (!open || !mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end md:hidden"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[60vh] w-full overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-black/50">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Visual filter preset cards that apply live colour grading to the preview. */
function FilterGallery() {
  const resetColorAdjustments = useEditorStore((s) => s.resetColorAdjustments);
  const setColorAdjustment = useEditorStore((s) => s.setColorAdjustment);
  return (
    <div className="grid grid-cols-3 gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => {
            resetColorAdjustments();
            if (filter.id !== "none") setColorAdjustment(filter.patch);
          }}
          className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 text-left transition-colors hover:border-zinc-600"
        >
          <span className="block h-12 w-full" style={{ background: filter.swatch }} />
          <span className="block px-2 py-1.5 text-[10px] text-zinc-200">
            {filter.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/** One-click cinematic preset cards. */
function CinePresetGallery() {
  const resetColorAdjustments = useEditorStore((s) => s.resetColorAdjustments);
  const setColorAdjustment = useEditorStore((s) => s.setColorAdjustment);
  return (
    <div className="grid grid-cols-2 gap-2">
      {CINEMATIC_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => {
            resetColorAdjustments();
            setColorAdjustment(preset.patch);
          }}
          className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 text-left transition-colors hover:border-zinc-600"
        >
          <span className="block h-16 w-full" style={{ background: preset.swatch }} />
          <span className="block px-2 py-1.5">
            <span className="block text-[11px] font-medium text-zinc-100">
              {preset.label}
            </span>
            <span className="block text-[10px] text-zinc-500">{preset.note}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

const subscribeNoop = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientMounted, getServerMounted);
}

/** Compact, always-on preview with tap-to-play and fullscreen. */
function MobilePreview({ wrapRef }: { wrapRef: React.RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayDrag = useOverlayCanvasDrag(canvasRef);
  const hasVideo = useEditorStore((state) => state.videoEl !== null);
  const eyedropper = useEditorStore((state) => state.eyedropper);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let lastClockSync = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!canvas.isConnected || canvas.offsetParent === null) return;

      const state = useEditorStore.getState();
      const { width, height } = ASPECT_RESOLUTIONS[state.aspect];
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const video = state.videoEl;
      if (video) {
        if (!video.paused && !video.ended) {
          // Follow the velocity curve so preview matches the export ramp.
          const rate = speedAt(state.speedPoints, video.currentTime);
          if (Math.abs(video.playbackRate - rate) > 0.01) video.playbackRate = rate;
          const now = performance.now();
          if (now - lastClockSync >= 100) {
            lastClockSync = now;
            if (Math.abs(video.currentTime - useEditorStore.getState().currentTime) > 0.01) {
              useEditorStore.setState({ currentTime: video.currentTime });
            }
          }
        }

        // Clip boundary — roll into the next clip, else loop the marked region.
        const regionStart = state.markIn ?? state.trimStart;
        const regionEnd = state.markOut ?? state.trimEnd;
        const reachedEnd =
          state.duration > 0 &&
          (video.ended || video.currentTime >= regionEnd - 0.02);
        if (reachedEnd && state.playing) {
          const advanced = state.advanceClip(true);
          if (!advanced) {
            video.currentTime = regionStart;
            if (video.ended) void video.play().catch(() => {});
          }
        }
      }

      audioPreview.sync(
        state.audioTracks,
        video ? video.currentTime : state.currentTime,
        state.playing
      );

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
          clipEnd: state.trimEnd > 0 ? state.trimEnd : undefined,
          chromaKey: state.chromaKey,
        },
        { placeholder: true }
      );
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const setPlaying = useEditorStore((state) => state.setPlaying);
  const togglePlay = () => {
    const s = useEditorStore.getState();
    if (s.videoEl) setPlaying(!s.playing);
  };
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!document.fullscreenElement) void el?.requestFullscreen?.();
    else void document.exitFullscreen?.();
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        aria-label="Video preview"
        onClick={() => {
          if (overlayDrag.consumeDrag()) return;
          togglePlay();
        }}
        onPointerDown={overlayDrag.onPointerDown}
        onPointerMove={overlayDrag.onPointerMove}
        onPointerUp={overlayDrag.onPointerUp}
        onPointerCancel={overlayDrag.onPointerCancel}
        className={cn("max-h-full max-w-full touch-none", eyedropper && "cursor-crosshair")}
      />
      {!hasVideo && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <Clapperboard className="h-6 w-6 text-violet-400" aria-hidden />
          <p className="text-xs text-zinc-400">No clip loaded</p>
        </div>
      )}
      {/* Fullscreen button floats over the preview */}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label="Toggle fullscreen"
        className="absolute right-3 top-3 rounded-lg bg-black/50 p-2 text-zinc-200 backdrop-blur transition-colors hover:bg-black/70"
      >
        {typeof document !== "undefined" && document.fullscreenElement ? (
          <Minimize2 className="h-4 w-4" aria-hidden />
        ) : (
          <Maximize2 className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

/** CapCut-style horizontal filmstrip + secondary lanes. */
function MobileTimeline({
  selectedClipId,
  onSelectClip,
  onAddAudio,
  onAddText,
}: {
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onAddAudio: () => void;
  onAddText: () => void;
}) {
  const assets = useEditorStore((state) => state.assets);
  const sequence = useEditorStore((state) => state.sequence);
  const inputRef = useRef<HTMLInputElement>(null);
  const addVideoAssets = useEditorStore((state) => state.addVideoAssets);

  const nameFor = (assetId: string) =>
    assets.find((asset) => asset.id === assetId)?.name ?? "Clip";
  const removeClip = useEditorStore((state) => state.removeClip);
  const reorderClip = useEditorStore((state) => state.reorderClip);
  const scrubTo = useEditorStore((state) => state.scrubTo);
  const activeClipId = useEditorStore((state) => state.activeClipId);
  const duration = useEditorStore((state) => state.duration);
  const playing = useEditorStore((state) => state.playing);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setClipTrim = useEditorStore((state) => state.setClipTrim);
  const setTrimStart = useEditorStore((state) => state.setTrimStart);
  const setTrimEnd = useEditorStore((state) => state.setTrimEnd);

  // Filmstrip scale (px per second) used to convert drag distance to time.
  const PPS = 26;
  const GAP = 6; // matches `gap-1.5`
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrubRaf = useRef(0);

  /**
   * Sliding the filmstrip scrubs the timeline: the fixed centre playhead maps to
   * a clip + source time, which drives the preview frame.
   */
  const handleStripScroll = () => {
    if (scrubRaf.current) return;
    scrubRaf.current = requestAnimationFrame(() => {
      scrubRaf.current = 0;
      const el = scrollRef.current;
      if (!el || sequence.length === 0) return;
      // Padding is 50% of the strip width, so scrollLeft 0 centres clip #1's start.
      const pad = el.clientWidth * 0.5;
      const centerX = el.scrollLeft + el.clientWidth / 2;
      let x = pad;
      for (let i = 0; i < sequence.length; i++) {
        const clip = sequence[i];
        const dur = Math.max(0.1, clip.trimEnd - clip.trimStart);
        const width = Math.min(220, Math.max(84, dur * PPS));
        const isLast = i === sequence.length - 1;
        if (centerX <= x + width || isLast) {
          const frac = Math.min(1, Math.max(0, (centerX - x) / width));
          scrubTo(clip.id, clip.trimStart + frac * dur);
          return;
        }
        x += width + GAP;
      }
    });
  };

  useEffect(
    () => () => {
      if (scrubRaf.current) cancelAnimationFrame(scrubRaf.current);
    },
    []
  );

  // While playing, keep the active frame under the fixed centre playhead so the
  // pink bar always matches what the preview shows (never blank space).
  useEffect(() => {
    if (!playing) return;
    const el = scrollRef.current;
    if (!el || sequence.length === 0) return;
    const index = sequence.findIndex((clip) => clip.id === activeClipId);
    if (index < 0) return;
    const clip = sequence[index];
    const dur = Math.max(0.1, clip.trimEnd - clip.trimStart);
    const width = Math.min(220, Math.max(84, dur * PPS));
    let x = el.clientWidth * 0.5;
    for (let i = 0; i < index; i++) {
      const d = Math.max(0.1, sequence[i].trimEnd - sequence[i].trimStart);
      x += Math.min(220, Math.max(84, d * PPS)) + GAP;
    }
    const frac = Math.min(1, Math.max(0, (currentTime - clip.trimStart) / dur));
    const target = x + frac * width - el.clientWidth / 2;
    if (Math.abs(el.scrollLeft - target) > 1) el.scrollLeft = target;
  }, [playing, currentTime, activeClipId, sequence]);

  const trimDragRef = useRef<{
    clipId: string;
    side: "in" | "out";
    startX: number;
    trimStart: number;
    trimEnd: number;
    sourceMax: number;
  } | null>(null);

  // Touch drag-to-reorder: the clip follows the finger and lands on drop.
  const [gripPreview, setGripPreview] = useState<{ id: string; dx: number } | null>(null);
  const gripState = useRef<{
    id: string;
    centers: number[];
    stripLeft: number;
    scrollLeft: number;
  } | null>(null);

  const gripHandlers = usePointerDrag({
    threshold: 6,
    onDrag: (info) => {
      const state = gripState.current;
      if (!state) return;
      setGripPreview({ id: state.id, dx: info.dx });
    },
    onEnd: (info) => {
      const state = gripState.current;
      gripState.current = null;
      setGripPreview(null);
      if (!state || !info.moved || state.centers.length === 0) return;
      const contentX = info.clientX - state.stripLeft + state.scrollLeft;
      let target = 0;
      for (const center of state.centers) {
        if (contentX > center) target += 1;
      }
      reorderClip(state.id, target);
    },
  });

  const beginReorder = (e: React.PointerEvent<HTMLButtonElement>, clipId: string) => {
    const el = scrollRef.current;
    if (!el) return;
    // Snapshot the other clips' centres so the drop target can't oscillate.
    let x = el.clientWidth * 0.5;
    const centers: number[] = [];
    for (let i = 0; i < sequence.length; i++) {
      const clip = sequence[i];
      const dur = Math.max(0.1, clip.trimEnd - clip.trimStart);
      const width = Math.min(220, Math.max(84, dur * PPS));
      if (clip.id !== clipId) centers.push(x + width / 2);
      x += width + GAP;
    }
    gripState.current = {
      id: clipId,
      centers,
      stripLeft: el.getBoundingClientRect().left,
      scrollLeft: el.scrollLeft,
    };
    gripHandlers.onPointerDown(e);
  };

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
    const delta = (e.clientX - d.startX) / PPS;
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

  return (
    <div className="relative mt-3 w-full max-w-full min-w-0 overflow-hidden select-none">
      {/* Fixed playhead needle */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-fuchsia-400">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-fuchsia-400" />
      </div>

      <div
        ref={scrollRef}
        onScroll={handleStripScroll}
        className="flex items-stretch gap-1.5 overflow-x-auto px-[50%] py-2"
      >
        {sequence.length === 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-16 min-w-[120px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add clip
          </button>
        )}
        {sequence.map((clip) => {
          const length = Math.max(0.1, clip.trimEnd - clip.trimStart);
          const active = clip.id === selectedClipId;
          return (
            <div
              key={clip.id}
              className={cn("relative h-16 shrink-0", gripPreview?.id === clip.id && "z-30")}
              style={{
                width: `${Math.min(220, Math.max(84, length * 26))}px`,
                transform:
                  gripPreview?.id === clip.id
                    ? `translateX(${gripPreview.dx}px)`
                    : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectClip(clip.id)}
                className={cn(
                  "absolute inset-0 h-full w-full overflow-hidden rounded-lg border text-left",
                  active ? "border-fuchsia-400" : "border-zinc-700"
                )}
              >
                <span className="absolute inset-0 bg-gradient-to-br from-violet-600/35 via-zinc-800 to-blue-600/25" />
                <span className="relative block truncate py-1.5 pl-11 pr-6 text-[10px] font-medium text-zinc-100">
                  {nameFor(clip.assetId)}
                </span>
                {/* Duration handle */}
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] tabular-nums text-zinc-200">
                  {length.toFixed(1)}s
                </span>
              </button>
              {/* Drag handle — only this surface captures touch so the strip can scroll */}
              <button
                type="button"
                aria-label="Drag to reorder clip"
                onPointerDown={(e) => beginReorder(e, clip.id)}
                onPointerMove={gripHandlers.onPointerMove}
                onPointerUp={gripHandlers.onPointerUp}
                onPointerCancel={gripHandlers.onPointerCancel}
                onClick={(event) => event.stopPropagation()}
                className="absolute left-2.5 top-1 z-20 flex h-6 w-6 touch-none items-center justify-center rounded bg-black/60 text-zinc-300"
              >
                <GripVertical className="h-3.5 w-3.5" aria-hidden />
              </button>
              {/* CapCut-style trim handles */}
              <button
                type="button"
                aria-label="Trim clip start"
                onPointerDown={(e) => onTrimDown(e, clip, "in")}
                onPointerMove={onTrimMove}
                onPointerUp={onTrimUp}
                className="absolute inset-y-0 left-0 z-10 w-2.5 cursor-ew-resize touch-none rounded-l-lg bg-white/35 transition-colors hover:bg-white/70 active:bg-white/80"
              />
              <button
                type="button"
                aria-label="Trim clip end"
                onPointerDown={(e) => onTrimDown(e, clip, "out")}
                onPointerMove={onTrimMove}
                onPointerUp={onTrimUp}
                className="absolute inset-y-0 right-0 z-10 w-2.5 cursor-ew-resize touch-none rounded-r-lg bg-white/35 transition-colors hover:bg-white/70 active:bg-white/80"
              />
              <button
                type="button"
                aria-label="Remove clip"
                onClick={(event) => {
                  event.stopPropagation();
                  removeClip(clip.id);
                }}
                className="absolute right-3 top-0.5 z-20 flex h-4 w-4 items-center justify-center rounded bg-black/70 text-zinc-300 transition-colors hover:text-red-400"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          );
        })}
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) void addVideoAssets(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {/* Secondary lanes */}
      <div className="flex gap-2 px-1">
        <button
          type="button"
          onClick={onAddAudio}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-300"
        >
          <Music className="h-3.5 w-3.5 text-violet-400" aria-hidden /> Add audio
        </button>
        <button
          type="button"
          onClick={onAddText}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-300"
        >
          <Type className="h-3.5 w-3.5 text-violet-400" aria-hidden /> Add text
        </button>
      </div>
    </div>
  );
}

type SheetId =
  | "effects"
  | "filters"
  | "presets"
  | "adjust"
  | "speed"
  | "volume"
  | "trim"
  | "cutout"
  | "stickers"
  | "transitions"
  | "captions"
  | "audio"
  | "text"
  | "ratio";

export function MobileEditor() {
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // ---- live values for the controls bar ----
  const playing = useEditorStore((s) => s.playing);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setVolume = useEditorStore((s) => s.setVolume);
  const volume = useEditorStore((s) => s.volume);

  const sequence = useEditorStore((s) => s.sequence);
  const overlays = useEditorStore((s) => s.overlays);
  const trimStart = useEditorStore((s) => s.trimStart);
  const trimEnd = useEditorStore((s) => s.trimEnd);

  const selectClip = useEditorStore((s) => s.selectClip);
  const splitActiveClip = useEditorStore((s) => s.splitActiveClip);
  const duplicateActiveClip = useEditorStore((s) => s.duplicateActiveClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const selectedId = useEditorStore((s) => s.selectedId);
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const moveClip = useEditorStore((s) => s.moveClip);
  const hdRendering = useEditorStore((s) => s.hdRendering);
  const setHdRendering = useEditorStore((s) => s.setHdRendering);
  const setTrimStart = useEditorStore((s) => s.setTrimStart);
  const setTrimEnd = useEditorStore((s) => s.setTrimEnd);
  const resetTrim = useEditorStore((s) => s.resetTrim);
  const addOverlay = useEditorStore((s) => s.addOverlay);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);
  const addEffect = useEditorStore((s) => s.addEffect);
  const clearEffects = useEditorStore((s) => s.clearEffects);
  const activeEffects = useEditorStore((s) => s.activeEffects);
  const setSpeedPreset = useEditorStore((s) => s.setSpeedPreset);
  const setSpeedPoints = useEditorStore((s) => s.setSpeedPoints);
  const speedPreset = useEditorStore((s) => s.speedPreset);
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const addAudioFiles = useEditorStore((s) => s.addAudioFiles);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const removeAudioTrack = useEditorStore((s) => s.removeAudioTrack);
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);
  const addSoundEffect = useEditorStore((s) => s.addSoundEffect);
  const chromaKey = useEditorStore((s) => s.chromaKey);
  const setChromaKey = useEditorStore((s) => s.setChromaKey);
  const resetChromaKey = useEditorStore((s) => s.resetChromaKey);
  const setEyedropper = useEditorStore((s) => s.setEyedropper);
  const eyedropper = useEditorStore((s) => s.eyedropper);
  const addOverlayKeyframe = useEditorStore((s) => s.addOverlayKeyframe);
  const applyCaptionPreset = useEditorStore((s) => s.applyCaptionPreset);
  const generateCaptionsFromScript = useEditorStore((s) => s.generateCaptionsFromScript);
  const captionStyle = useEditorStore((s) => s.captionStyle);
  const [script, setScript] = useState("");
  const [dictating, setDictating] = useState(false);
  const dictationRef = useRef<ReturnType<typeof createDictation> | null>(null);
  const dictationSupported = isDictationSupported();
  const addTextSticker = useEditorStore((s) => s.addTextSticker);
  const addStickerImage = useEditorStore((s) => s.addStickerImage);
  const setClipTransition = useEditorStore((s) => s.setClipTransition);
  const canvasFill = useEditorStore((s) => s.canvasFill);
  const setCanvasFill = useEditorStore((s) => s.setCanvasFill);
  const addAudioTrackFromBlob = useEditorStore((s) => s.addAudioTrackFromBlob);
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const [stickerCategory, setStickerCategory] = useState<StickerCategory>("emoji");
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const voiceRef = useRef<{
    capture: ActiveCapture;
    meter: ReturnType<typeof createLevelMeter>;
  } | null>(null);

  useEffect(() => {
    if (!voiceRecording) return;
    let raf = 0;
    const tick = () => {
      setVoiceLevel(voiceRef.current?.meter?.getLevel() ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [voiceRecording]);

  useEffect(() => () => voiceRef.current?.capture.cancel(), []);

  const toggleVoiceover = async () => {
    if (voiceRecording) {
      const current = voiceRef.current;
      voiceRef.current = null;
      setVoiceRecording(false);
      setVoiceLevel(0);
      if (!current) return;
      try {
        const blob = await current.capture.stop();
        current.meter?.close();
        if (blob && blob.size > 0) {
          await addAudioTrackFromBlob(blob, `Voiceover ${new Date().toLocaleTimeString()}`);
        }
      } catch {
        // Recording failed; nothing to add.
      }
      return;
    }
    try {
      const capture = await startCapture("voice");
      voiceRef.current = { capture, meter: createLevelMeter(capture.stream) };
      setVoiceRecording(true);
    } catch {
      // Mic permission denied / unavailable.
    }
  };
  const captionLanguage = useEditorStore((s) => s.captionLanguage);
  const setCaptionLanguage = useEditorStore((s) => s.setCaptionLanguage);
  const setCaptionStyle = useEditorStore((s) => s.setCaptionStyle);
  const generateAutoCaptions = useEditorStore((s) => s.generateAutoCaptions);
  const transcribing = useEditorStore((s) => s.transcribing);
  const autoCaptionCount = useEditorStore(
    (s) => s.overlays.filter((overlay) => overlay.auto).length
  );

  // ---- undo / redo (shared store history) ----
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const clipSelected = Boolean(
    selectedClipId && sequence.some((clip) => clip.id === selectedClipId)
  );

  const handleSelectClip = (clipId: string) => {
    setSelectedClipId(clipId);
    selectClip(clipId);
  };

  const openSheet = (id: SheetId) => setSheet(id);

  const toolbarBtn =
    "flex min-w-[3.5rem] flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";
  const chipBtn =
    "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300";
  const primaryBtn =
    "brand-gradient brand-gradient-hover inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white";
  const quickBtn =
    "inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[10px] text-zinc-200 transition-colors hover:border-zinc-600";

  return (
    <div className="md:hidden flex min-h-0 flex-1 flex-col justify-between overflow-x-hidden rounded-xl border border-zinc-800/80 bg-zinc-950">
      {/* Compact preview + controls (fixed at the top) */}
      <div
        ref={previewWrapRef}
        className="z-20 w-full max-w-full min-w-0 shrink-0 overflow-hidden rounded-t-xl border-b border-zinc-800/80 bg-black"
      >
        <div className="h-[32dvh] min-h-[180px] w-full">
          <MobilePreview wrapRef={previewWrapRef} />
        </div>
        <div className="flex w-full max-w-full min-w-0 items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={undo}
            aria-label="Undo"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Undo2 className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={redo}
            aria-label="Redo"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Redo2 className="h-5 w-5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => {
              const s = useEditorStore.getState();
              if (s.videoEl) setPlaying(!s.playing);
            }}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500"
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 translate-x-px" aria-hidden />}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!selectedId) {
                  openSheet("text");
                  return;
                }
                addOverlayKeyframe(selectedId);
              }}
              aria-label="Add keyframe at playhead"
              title="Keyframe (+) — record the selected overlay's transform"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] font-semibold text-zinc-300"
            >
              <Diamond className="h-3.5 w-3.5 text-amber-300" aria-hidden /> +
            </button>
            <button
              type="button"
              onClick={() => setHdRendering(!hdRendering)}
              aria-pressed={hdRendering}
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-semibold ring-1 ring-inset transition-colors",
                hdRendering
                  ? "bg-violet-600/20 text-violet-200 ring-violet-500/40"
                  : "text-zinc-500 ring-zinc-800"
              )}
            >
              HD
            </button>
            <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] tabular-nums text-zinc-300 ring-1 ring-inset ring-zinc-800">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable middle: filmstrip + lanes */}
      <div className="min-h-0 w-full max-w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
        <MobileTimeline
          selectedClipId={selectedClipId}
          onSelectClip={handleSelectClip}
          onAddAudio={() => openSheet("audio")}
          onAddText={() => openSheet("text")}
        />

        {/* Inline contextual menu for the tapped clip */}
        {clipSelected && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-1.5">
            <button type="button" onClick={splitActiveClip} className={quickBtn}>
              <Scissors className="h-3.5 w-3.5" aria-hidden /> Split
            </button>
            <button type="button" onClick={duplicateActiveClip} className={quickBtn}>
              <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => selectedClipId && moveClip(selectedClipId, -1)}
              className={quickBtn}
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden /> Forward
            </button>
            <button
              type="button"
              onClick={() => selectedClipId && moveClip(selectedClipId, 1)}
              className={quickBtn}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden /> Backward
            </button>
            <button type="button" onClick={() => openSheet("speed")} className={quickBtn}>
              <Gauge className="h-3.5 w-3.5" aria-hidden /> Speed
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedClipId) removeClip(selectedClipId);
                setSelectedClipId(null);
              }}
              className={cn(quickBtn, "text-red-400")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Pinned bottom action dock */}
      <div className="sticky bottom-0 left-0 right-0 z-30 w-full shrink-0 border-t border-zinc-800 bg-zinc-950/95 px-2 py-2 backdrop-blur-md">
        {clipSelected ? (
          <div className="flex items-stretch gap-1 overflow-x-auto">
            <button type="button" onClick={splitActiveClip} className={toolbarBtn}>
              <Scissors className="h-5 w-5" aria-hidden /> Split
            </button>
            <button type="button" onClick={() => openSheet("trim")} className={toolbarBtn}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden /> Trim
            </button>
            <button type="button" onClick={() => openSheet("cutout")} className={toolbarBtn}>
              <Pipette className="h-5 w-5" aria-hidden /> Cutout
            </button>
            <button type="button" onClick={() => openSheet("transitions")} className={toolbarBtn}>
              <ArrowLeftRight className="h-5 w-5" aria-hidden /> Transition
            </button>
            <button type="button" onClick={() => openSheet("filters")} className={toolbarBtn}>
              <Crop className="h-5 w-5" aria-hidden /> Filters
            </button>
            <button type="button" onClick={() => openSheet("speed")} className={toolbarBtn}>
              <Gauge className="h-5 w-5" aria-hidden /> Speed
            </button>
            <button type="button" onClick={() => openSheet("volume")} className={toolbarBtn}>
              <Volume2 className="h-5 w-5" aria-hidden /> Volume
            </button>
            <button
              type="button"
              onClick={() => {
                removeClip(selectedClipId!);
                setSelectedClipId(null);
              }}
              className={cn(toolbarBtn, "text-red-400")}
            >
              <Trash2 className="h-5 w-5" aria-hidden /> Delete
            </button>
          </div>
        ) : (
          <div className="flex items-stretch gap-1 overflow-x-auto">
            <button type="button" onClick={() => openSheet("trim")} className={toolbarBtn}>
              <Scissors className="h-5 w-5" aria-hidden /> Edit
            </button>
            <button type="button" onClick={() => openSheet("audio")} className={toolbarBtn}>
              <Music className="h-5 w-5" aria-hidden /> Audio
            </button>
            <button type="button" onClick={() => openSheet("text")} className={toolbarBtn}>
              <Type className="h-5 w-5" aria-hidden /> Text
            </button>
            <button type="button" onClick={() => openSheet("stickers")} className={toolbarBtn}>
              <Smile className="h-5 w-5" aria-hidden /> Stickers
            </button>
            <button type="button" onClick={() => openSheet("transitions")} className={toolbarBtn}>
              <ArrowLeftRight className="h-5 w-5" aria-hidden /> Transitions
            </button>
            <button type="button" onClick={() => openSheet("effects")} className={toolbarBtn}>
              <Wand2 className="h-5 w-5" aria-hidden /> Effects
            </button>
            <button type="button" onClick={() => openSheet("adjust")} className={toolbarBtn}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden /> Adjust
            </button>
            <button type="button" onClick={() => openSheet("presets")} className={toolbarBtn}>
              <Sparkles className="h-5 w-5" aria-hidden /> Presets
            </button>
            <button type="button" onClick={() => openSheet("captions")} className={toolbarBtn}>
              <Captions className="h-5 w-5" aria-hidden /> Captions
            </button>
            <button type="button" onClick={() => openSheet("ratio")} className={toolbarBtn}>
              <Film className="h-5 w-5" aria-hidden /> Ratio
            </button>
          </div>
        )}
      </div>

      {/* ---------- Drawers ---------- */}

      <Sheet open={sheet === "trim"} title="Trim" onClose={() => setSheet(null)}>
        <label className="block text-[11px] text-zinc-400">
          Start · {trimStart.toFixed(1)}s
          <input type="range" min={0} max={Math.max(trimEnd - 0.1, 0.1)} step={0.1} value={trimStart} onChange={(e) => setTrimStart(Number(e.target.value))} className="mt-1 w-full accent-violet-500" />
        </label>
        <label className="mt-4 block text-[11px] text-zinc-400">
          End · {trimEnd.toFixed(1)}s
          <input type="range" min={trimStart + 0.1} max={Math.max(duration, 0.1)} step={0.1} value={trimEnd} onChange={(e) => setTrimEnd(Number(e.target.value))} className="mt-1 w-full accent-violet-500" />
        </label>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={resetTrim} className={chipBtn}>Reset trim</button>
          <button type="button" onClick={splitActiveClip} className={primaryBtn}><Scissors className="h-3.5 w-3.5" aria-hidden /> Split at playhead</button>
        </div>
      </Sheet>

      <Sheet open={sheet === "cutout"} title="Chroma Key / Cutout" onClose={() => setSheet(null)}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={chromaKey.color}
            onChange={(e) => setChromaKey({ color: e.target.value, enabled: true })}
            aria-label="Key color"
            className="h-10 w-14 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950"
          />
          <button
            type="button"
            onClick={() => setEyedropper(!eyedropper)}
            aria-pressed={eyedropper}
            className={cn(chipBtn, "flex-1 justify-center", eyedropper && "border-violet-500 text-violet-200")}
          >
            <Pipette className="h-3.5 w-3.5" aria-hidden />
            {eyedropper ? "Tap the preview…" : "Eyedropper"}
          </button>
          <button
            type="button"
            onClick={() => setChromaKey({ enabled: !chromaKey.enabled })}
            aria-pressed={chromaKey.enabled}
            className={cn(chipBtn, chromaKey.enabled && "border-violet-500 text-violet-200")}
          >
            {chromaKey.enabled ? "On" : "Off"}
          </button>
        </div>
        <label className="mt-4 block text-[11px] text-zinc-400">
          Tolerance · {Math.round(chromaKey.tolerance)}%
          <input type="range" min={0} max={100} step={1} value={chromaKey.tolerance} onChange={(e) => setChromaKey({ tolerance: Number(e.target.value), enabled: true })} className="mt-1 w-full accent-violet-500" />
        </label>
        <label className="mt-4 block text-[11px] text-zinc-400">
          Edge feather · {Math.round(chromaKey.feather)}%
          <input type="range" min={0} max={100} step={1} value={chromaKey.feather} onChange={(e) => setChromaKey({ feather: Number(e.target.value), enabled: true })} className="mt-1 w-full accent-violet-500" />
        </label>
        <button type="button" onClick={resetChromaKey} className={cn(chipBtn, "mt-4 w-full justify-center")}>
          Reset chroma key
        </button>
      </Sheet>

      <Sheet open={sheet === "stickers"} title="Stickers & Emojis" onClose={() => setSheet(null)}>
        <div className="flex flex-wrap gap-1">
          {STICKER_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setStickerCategory(category.id)}
              aria-pressed={stickerCategory === category.id}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px]",
                stickerCategory === category.id
                  ? "bg-violet-600/20 text-violet-200"
                  : "text-zinc-400"
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {STICKERS.filter((sticker) => sticker.category === stickerCategory).map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              title={sticker.label}
              onClick={() => {
                if (sticker.emoji) {
                  addTextSticker(sticker.emoji, sticker.fontSize ?? 160);
                  return;
                }
                const src = stickerImageSrc(sticker);
                if (src) addStickerImage(src);
              }}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 p-1 active:border-violet-500"
            >
              {sticker.emoji ? (
                <span className="text-2xl">{sticker.emoji}</span>
              ) : (
                <span
                  className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: sticker.svg ?? "" }}
                />
              )}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "transitions"} title="Transitions" onClose={() => setSheet(null)}>
        {!activeClipId ? (
          <p className="text-[11px] text-zinc-500">Select a clip on the timeline first.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {TRANSITION_PRESETS.map((preset) => {
              const active =
                sequence.find((clip) => clip.id === activeClipId)?.transitionIn?.type ===
                preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setClipTransition(activeClipId, active ? null : preset.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-3 text-[11px]",
                    active
                      ? "border-violet-500 bg-violet-600/15 text-violet-200"
                      : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
                  )}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-violet-400" aria-hidden />
                  {preset.label}
                </button>
              );
            })}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === "effects"} title="Effects" onClose={() => setSheet(null)}>
        <div className="grid grid-cols-2 gap-2">
          {EFFECT_CARDS.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => addEffect(card.type, currentTime)}
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-left text-xs text-zinc-200"
            >
              <card.Icon className="h-4 w-4 text-violet-400" aria-hidden />
              {card.label}
            </button>
          ))}
        </div>
        {activeEffects.length > 0 && (
          <button type="button" onClick={clearEffects} className={cn(chipBtn, "mt-3 w-full justify-center")}>
            Clear {activeEffects.length} effect{activeEffects.length === 1 ? "" : "s"}
          </button>
        )}
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Filter presets
          </p>
          <FilterGallery />
        </div>
      </Sheet>

      <Sheet open={sheet === "filters"} title="Filters" onClose={() => setSheet(null)}>
        <FilterGallery />
      </Sheet>

      <Sheet open={sheet === "presets"} title="Cinematic Presets" onClose={() => setSheet(null)}>
        <CinePresetGallery />
      </Sheet>

      <Sheet open={sheet === "adjust"} title="Lighting & Color" onClose={() => setSheet(null)}>
        <AdjustPanel />
      </Sheet>

      <Sheet open={sheet === "speed"} title="Speed" onClose={() => setSheet(null)}>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Speed
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[0.5, 1, 2, 5].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => {
                if (rate === 1) {
                  setSpeedPreset("none");
                  return;
                }
                const span = Math.max(duration, 1);
                setSpeedPoints([
                  { time: 0, speed: rate },
                  { time: span, speed: rate },
                ]);
              }}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-2 py-3 text-xs text-zinc-200 transition-colors hover:border-zinc-600"
            >
              {rate}×
            </button>
          ))}
        </div>
        <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Ramp presets
        </p>
        <div className="grid grid-cols-4 gap-2">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSpeedPreset(preset)}
              className={cn(
                "rounded-xl border px-2 py-3 text-xs capitalize",
                speedPreset === preset
                  ? "border-violet-500 bg-violet-600/15 text-violet-200"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
              )}
            >
              {SPEED_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "volume"} title="Volume" onClose={() => setSheet(null)}>
        <label className="block text-[11px] text-zinc-400">
          Master volume · {Math.round(volume * 100)}%
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-1 w-full accent-violet-500" />
        </label>
        <button type="button" onClick={() => openSheet("audio")} className={cn(chipBtn, "mt-3 w-full justify-center")}>
          <Music className="h-3.5 w-3.5" aria-hidden /> Manage audio tracks
        </button>
      </Sheet>

      <Sheet open={sheet === "captions"} title="AI Captions" onClose={() => setSheet(null)}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-400">Spoken language</span>
          <select
            value={captionLanguage}
            onChange={(e) => setCaptionLanguage(e.target.value as typeof captionLanguage)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
          >
            {CAPTION_LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>{language.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void generateAutoCaptions()}
          disabled={transcribing}
          className={cn(primaryBtn, "mt-3 w-full justify-center disabled:opacity-60")}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {transcribing ? "Transcribing…" : "Auto captions"}
        </button>
        {autoCaptionCount > 0 && (
          <p className="mt-2 text-[11px] text-zinc-500">{autoCaptionCount} AI caption(s) generated.</p>
        )}
      </Sheet>

      <Sheet open={sheet === "audio"} title="Audio & SFX" onClose={() => setSheet(null)}>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Sound effects
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SOUND_EFFECTS.map((effect) => (
            <button
              key={effect.id}
              type="button"
              onClick={() => void addSoundEffect(effect.id)}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-1.5 py-2.5 text-[10px] text-zinc-200 transition-colors hover:border-zinc-600"
            >
              {effect.label}
            </button>
          ))}
        </div>

        <label className={cn(chipBtn, "mt-3 w-full justify-center")}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add audio file
          <input
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addAudioFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => void toggleVoiceover()}
          className={cn(
            chipBtn,
            "mt-2 w-full justify-center",
            voiceRecording && "border-red-500/50 text-red-300"
          )}
        >
          {voiceRecording ? (
            <Square className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Mic className="h-3.5 w-3.5" aria-hidden />
          )}
          {voiceRecording ? "Stop voiceover" : "Record voiceover"}
        </button>
        {voiceRecording && (
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-zinc-800">
            <span
              className="block h-full bg-red-400"
              style={{ width: `${Math.round(voiceLevel * 100)}%` }}
            />
          </span>
        )}

        {audioTracks.length > 0 && (
          <ul className="mt-3 space-y-2">
            {audioTracks.map((track) => (
              <li key={track.id} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-2">
                  <AudioLines className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">{track.name}</span>
                  <button
                    type="button"
                    onClick={() => updateAudioTrack(track.id, { muted: !track.muted })}
                    aria-label="Mute"
                    className={cn("rounded p-1", track.muted ? "text-amber-300" : "text-zinc-500")}
                  >
                    {track.muted ? <VolumeX className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAudioTrack(track.id, { solo: !track.solo })}
                    aria-label="Solo"
                    className={cn("rounded px-1 text-[10px] font-bold", track.solo ? "text-sky-300" : "text-zinc-500")}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAudioTrack(track.id)}
                    aria-label="Remove audio"
                    className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <Waveform buffer={track.buffer} className="h-8 w-full rounded bg-zinc-900/60" />
                <label className="block text-[10px] text-zinc-500">
                  Volume · {Math.round(track.volume * 100)}%
                  <input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => updateAudioTrack(track.id, { volume: Number(e.target.value) })} className="w-full accent-violet-500" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[10px] text-zinc-500">
                    Fade in · {track.fadeIn.toFixed(1)}s
                    <input type="range" min={0} max={Math.max(track.duration, 0.1)} step={0.1} value={track.fadeIn} onChange={(e) => updateAudioTrack(track.id, { fadeIn: Number(e.target.value) })} className="w-full accent-violet-500" />
                  </label>
                  <label className="block text-[10px] text-zinc-500">
                    Fade out · {track.fadeOut.toFixed(1)}s
                    <input type="range" min={0} max={Math.max(track.duration, 0.1)} step={0.1} value={track.fadeOut} onChange={(e) => updateAudioTrack(track.id, { fadeOut: Number(e.target.value) })} className="w-full accent-violet-500" />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={sheet === "text"} title="Text & Overlays" onClose={() => setSheet(null)}>
        <button type="button" onClick={addOverlay} className={cn(primaryBtn, "w-full justify-center")}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add text overlay
        </button>

        <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Text animation
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["typewriter", "Typewriter"],
              ["fadeIn", "Fade In"],
              ["bounce", "Bounce"],
              ["neon", "Neon Glow"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCaptionStyle({ animation: id });
                if (selectedId) updateOverlay(selectedId, { animation: id });
              }}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-xs text-zinc-200 transition-colors hover:border-zinc-600"
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Caption styles
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["karaoke", "Karaoke"],
              ["bounce", "Bounce"],
              ["neonBox", "Neon Box"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyCaptionPreset(id)}
              aria-pressed={captionStyle.preset === id}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-[11px]",
                captionStyle.preset === id
                  ? "border-violet-500 bg-violet-600/15 text-violet-200"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Script → captions
        </p>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={3}
          placeholder="Type or dictate your script…"
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void generateCaptionsFromScript(script)}
            disabled={!script.trim()}
            className={cn(chipBtn, "justify-center disabled:opacity-40")}
          >
            Generate captions
          </button>
          <button
            type="button"
            disabled={!dictationSupported}
            onClick={() => {
              if (dictating) {
                dictationRef.current?.stop();
                setDictating(false);
                return;
              }
              const session = createDictation(
                (chunk) => setScript((prev) => `${prev} ${chunk}`.trim()),
                () => setDictating(false)
              );
              if (!session) return;
              dictationRef.current = session;
              session.start();
              setDictating(true);
            }}
            className={cn(chipBtn, "justify-center disabled:opacity-40", dictating && "border-red-500/40 text-red-300")}
          >
            <Mic className="h-3.5 w-3.5" aria-hidden />
            {dictating ? "Stop" : "Dictate"}
          </button>
        </div>

        {overlays.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {overlays.map((overlay) => (
              <li key={overlay.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
                <Type className="h-3.5 w-3.5 text-violet-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{overlay.text || "Untitled"}</span>
                <button type="button" onClick={() => removeOverlay(overlay.id)} aria-label="Delete overlay" className="rounded p-1 text-zinc-500 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={sheet === "ratio"} title="Aspect Ratio" onClose={() => setSheet(null)}>
        <div className="grid grid-cols-3 gap-2">
          {ASPECTS.map((option) => {
            const res = ASPECT_RESOLUTIONS[option];
            return (
              <button
                key={option}
                type="button"
                onClick={() => setAspect(option)}
                className={cn(
                  "rounded-xl border px-2 py-3 text-center text-xs",
                  aspect === option
                    ? "border-violet-500 bg-violet-600/15 text-violet-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
                )}
              >
                <span className="block font-semibold">{option}</span>
                <span className="text-[10px] text-zinc-500">{res.width}×{res.height}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setCanvasFill(canvasFill === "blur" ? "black" : "blur")}
          aria-pressed={canvasFill === "blur"}
          className={cn(
            chipBtn,
            "mt-3 w-full justify-center",
            canvasFill === "blur" && "border-violet-500 text-violet-200"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {canvasFill === "blur" ? "Blurred background" : "Black letterbox"}
        </button>
      </Sheet>
    </div>
  );
}
