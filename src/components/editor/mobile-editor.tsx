"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Captions,
  Clapperboard,
  Crop,
  Film,
  Gauge,
  Layers,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import { ASPECT_RESOLUTIONS, drawScene } from "@/lib/render";
import {
  useEditorStore,
  type AspectRatio,
  type TextOverlay,
  type VideoEffectType,
} from "@/store/editor";
import type { TimelineClip } from "@/lib/video-storage";
import { CAPTIONS_CREDIT_COST } from "@/lib/credits";
import { CAPTION_LANGUAGES } from "@/lib/transcribe";
import { cn } from "@/lib/utils";

type EditSnapshot = {
  sequence: TimelineClip[];
  overlays: TextOverlay[];
  trimStart: number;
  trimEnd: number;
};

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

const FILTERS: { id: string; label: string; patch: Record<string, number> }[] = [
  { id: "none", label: "None", patch: { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0 } },
  { id: "vivid", label: "Vivid", patch: { contrast: 12, saturation: 30 } },
  { id: "warm", label: "Warm", patch: { saturation: 12, hue: 10 } },
  { id: "cool", label: "Cool", patch: { saturation: 8, hue: -14 } },
  { id: "mono", label: "Mono", patch: { contrast: 10, saturation: -100 } },
];

const SPEED_PRESETS = ["none", "montage", "hero", "bullet"] as const;

const ASPECTS: AspectRatio[] = ["9:16", "16:9", "1:1"];

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

const subscribeNoop = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientMounted, getServerMounted);
}

/** Compact, always-on preview with tap-to-play and fullscreen. */
function MobilePreview({ wrapRef }: { wrapRef: React.RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasVideo = useEditorStore((state) => state.videoEl !== null);

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
      if (video && !video.paused && !video.ended) {
        const now = performance.now();
        if (now - lastClockSync >= 100) {
          lastClockSync = now;
          if (Math.abs(video.currentTime - useEditorStore.getState().currentTime) > 0.01) {
            useEditorStore.setState({ currentTime: video.currentTime });
          }
        }
        if (
          state.duration > 0 &&
          state.trimEnd < state.duration - 0.05 &&
          video.currentTime >= state.trimEnd
        ) {
          video.currentTime = state.trimStart;
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
          sceneTime: video ? video.currentTime : state.currentTime,
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
        onClick={togglePlay}
        className="max-h-full max-w-full"
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

  return (
    <div className="relative mt-3 select-none">
      {/* Fixed playhead needle */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-fuchsia-400">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-fuchsia-400" />
      </div>

      <div className="flex items-stretch gap-1.5 overflow-x-auto px-[45%] py-2">
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
            <button
              key={clip.id}
              type="button"
              onClick={() => onSelectClip(clip.id)}
              style={{ width: `${Math.min(220, Math.max(84, length * 26))}px` }}
              className={cn(
                "relative h-16 shrink-0 overflow-hidden rounded-lg border text-left",
                active ? "border-fuchsia-400" : "border-zinc-700"
              )}
            >
              <span className="absolute inset-0 bg-gradient-to-br from-violet-600/35 via-zinc-800 to-blue-600/25" />
              <span className="relative block truncate px-2 pt-1.5 text-[10px] font-medium text-zinc-100">
                {nameFor(clip.assetId)}
              </span>
              {/* Duration handle */}
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] tabular-nums text-zinc-200">
                {length.toFixed(1)}s
              </span>
            </button>
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
  | "speed"
  | "volume"
  | "trim"
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
  const restoreEdit = useEditorStore((s) => s.restoreEdit);

  const selectClip = useEditorStore((s) => s.selectClip);
  const splitActiveClip = useEditorStore((s) => s.splitActiveClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const setTrimStart = useEditorStore((s) => s.setTrimStart);
  const setTrimEnd = useEditorStore((s) => s.setTrimEnd);
  const resetTrim = useEditorStore((s) => s.resetTrim);
  const addOverlay = useEditorStore((s) => s.addOverlay);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);
  const addEffect = useEditorStore((s) => s.addEffect);
  const clearEffects = useEditorStore((s) => s.clearEffects);
  const activeEffects = useEditorStore((s) => s.activeEffects);
  const resetColorAdjustments = useEditorStore((s) => s.resetColorAdjustments);
  const setColorAdjustment = useEditorStore((s) => s.setColorAdjustment);
  const setSpeedPreset = useEditorStore((s) => s.setSpeedPreset);
  const speedPreset = useEditorStore((s) => s.speedPreset);
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const addAudioFiles = useEditorStore((s) => s.addAudioFiles);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const captionLanguage = useEditorStore((s) => s.captionLanguage);
  const setCaptionLanguage = useEditorStore((s) => s.setCaptionLanguage);
  const generateAutoCaptions = useEditorStore((s) => s.generateAutoCaptions);
  const transcribing = useEditorStore((s) => s.transcribing);
  const autoCaptionCount = useEditorStore(
    (s) => s.overlays.filter((overlay) => overlay.auto).length
  );

  // ---- undo / redo history (timeline + overlays) ----
  const historyRef = useRef<EditSnapshot[]>([]);
  const futureRef = useRef<EditSnapshot[]>([]);
  const lastRef = useRef<EditSnapshot | null>(null);
  const skipRef = useRef(false);

  useEffect(() => {
    const current: EditSnapshot = { sequence, overlays, trimStart, trimEnd };
    if (skipRef.current) {
      skipRef.current = false;
      lastRef.current = current;
      return;
    }
    if (lastRef.current === null) {
      lastRef.current = current;
      return;
    }
    const prev = lastRef.current;
    if (
      prev.sequence === sequence &&
      prev.overlays === overlays &&
      prev.trimStart === trimStart &&
      prev.trimEnd === trimEnd
    ) {
      return;
    }
    historyRef.current.push(prev);
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
    lastRef.current = current;
  }, [sequence, overlays, trimStart, trimEnd]);

  const applySnapshot = (snapshot: EditSnapshot) => {
    skipRef.current = true;
    lastRef.current = snapshot;
    restoreEdit(snapshot);
  };
  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    if (lastRef.current) futureRef.current.push(lastRef.current);
    applySnapshot(prev);
  };
  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    if (lastRef.current) historyRef.current.push(lastRef.current);
    applySnapshot(next);
  };

  const clipSelected = Boolean(
    selectedClipId && sequence.some((clip) => clip.id === selectedClipId)
  );

  const handleSelectClip = (clipId: string) => {
    setSelectedClipId(clipId);
    selectClip(clipId);
  };

  const openSheet = (id: SheetId) => setSheet(id);

  const toolbarBtn =
    "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";
  const chipBtn =
    "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300";
  const primaryBtn =
    "brand-gradient brand-gradient-hover inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white";

  return (
    <div className="md:hidden">
      {/* Compact sticky preview + controls */}
      <div
        ref={previewWrapRef}
        className="-mx-4 -mt-4 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl sm:-mx-6 sticky top-0 z-20"
      >
        <div className="h-[34vh] min-h-[200px]">
          <MobilePreview wrapRef={previewWrapRef} />
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
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

          <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] tabular-nums text-zinc-300 ring-1 ring-inset ring-zinc-800">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Filmstrip */}
      <MobileTimeline
        selectedClipId={selectedClipId}
        onSelectClip={handleSelectClip}
        onAddAudio={() => openSheet("audio")}
        onAddText={() => openSheet("text")}
      />

      {/* Contextual bottom dock */}
      <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1.5 backdrop-blur">
        {clipSelected ? (
          <div className="flex items-stretch gap-1">
            <button type="button" onClick={splitActiveClip} className={toolbarBtn}>
              <Scissors className="h-5 w-5" aria-hidden /> Split
            </button>
            <button type="button" onClick={() => openSheet("trim")} className={toolbarBtn}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden /> Trim
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
          <div className="flex items-stretch gap-1">
            <button type="button" onClick={() => openSheet("trim")} className={toolbarBtn}>
              <Scissors className="h-5 w-5" aria-hidden /> Edit
            </button>
            <button type="button" onClick={() => openSheet("audio")} className={toolbarBtn}>
              <Music className="h-5 w-5" aria-hidden /> Audio
            </button>
            <button type="button" onClick={() => openSheet("text")} className={toolbarBtn}>
              <Type className="h-5 w-5" aria-hidden /> Text
            </button>
            <button type="button" onClick={() => openSheet("effects")} className={toolbarBtn}>
              <Wand2 className="h-5 w-5" aria-hidden /> Effects
            </button>
            <button type="button" onClick={() => openSheet("text")} className={toolbarBtn}>
              <Layers className="h-5 w-5" aria-hidden /> Overlay
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
      </Sheet>

      <Sheet open={sheet === "filters"} title="Filters" onClose={() => setSheet(null)}>
        <div className="grid grid-cols-3 gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => {
                resetColorAdjustments();
                if (filter.id !== "none") setColorAdjustment(filter.patch);
              }}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-xs text-zinc-200"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "speed"} title="Speed" onClose={() => setSheet(null)}>
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
              {preset === "none" ? "1×" : preset}
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
          {transcribing ? "Transcribing…" : `Auto captions · ${CAPTIONS_CREDIT_COST} credits`}
        </button>
        {autoCaptionCount > 0 && (
          <p className="mt-2 text-[11px] text-zinc-500">{autoCaptionCount} AI caption(s) generated.</p>
        )}
      </Sheet>

      <Sheet open={sheet === "audio"} title="Audio" onClose={() => setSheet(null)}>
        <label className={cn(chipBtn, "w-full justify-center")}>
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
        {audioTracks.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {audioTracks.map((track) => (
              <li key={track.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
                <Music className="h-3.5 w-3.5 text-violet-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{track.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={sheet === "text"} title="Text & Overlays" onClose={() => setSheet(null)}>
        <button type="button" onClick={addOverlay} className={cn(primaryBtn, "w-full justify-center")}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add text overlay
        </button>
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
      </Sheet>
    </div>
  );
}
