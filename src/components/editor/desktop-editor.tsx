"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  AudioLines,
  Camera,
  Captions,
  Diamond,
  Eye,
  EyeOff,
  Film,
  LoaderCircle,
  Lock,
  Mic,
  MonitorPlay,
  Music,
  Pause,
  Pipette,
  Play,
  Plus,
  Redo2,
  Repeat,
  Scissors,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  ASPECT_RESOLUTIONS,
  drawScene,
  measureOverlayBounds,
  resolveOverlayTransform,
  speedAt,
} from "@/lib/render";
import {
  CAPTION_PRESETS,
  EFFECT_GROUPS,
  FONT_FAMILIES,
  TRANSITION_PRESETS,
  computeClipStarts,
  effectiveAudioTracks,
  effectLabel,
  trackLane,
  useEditorStore,
  type AspectRatio,
  type CaptionAnimation,
  type OverlayAlign,
  type SpeedPreset,
  type TextOverlay,
} from "@/store/editor";
import { useOverlayCanvasDrag } from "@/components/editor/use-overlay-drag";
import { VelocityCurveEditor } from "@/components/editor/velocity-editor";
import { clampTimelineStart, usePointerDrag } from "@/lib/timeline-drag";
import { audioPreview } from "@/lib/audio-preview";
import { installMediaRecovery, onMediaRestore } from "@/lib/media-recovery";
import { SOUND_EFFECT_CATEGORIES, SOUND_EFFECTS } from "@/lib/sfx";
import { createDictation, isDictationSupported } from "@/lib/dictation";
import { STICKER_CATEGORIES, STICKERS, stickerImageSrc, type StickerCategory } from "@/lib/stickers";
import { TimelineWaveform, Waveform } from "@/components/editor/waveform";
import {
  AUDIO_TRACK_KEYS,
  TRACK_KEYS,
  isLaneDimmed,
  visibleLayerFlags,
  type TrackField,
  type TrackKey,
} from "@/lib/tracks";
import {
  createLevelMeter,
  isCaptureSupported,
  startCapture,
  type ActiveCapture,
  type CaptureKind,
} from "@/lib/recorder";
import { CAPTION_LANGUAGES, type CaptionLanguageId } from "@/lib/transcribe";
import {
  AiStudioSection,
  BatchTools,
  StudioPanel,
} from "@/components/editor/studio-modules";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import type { TransitionType } from "@/lib/video-storage";

type CinematicPreset = {
  id: string;
  label: string;
  group: "quick" | "more";
  swatch: string;
  patch: Record<string, number>;
};

/** 5 quick picks + 15 more = 20 cinematic presets. */
const CINEMATIC_PRESETS: CinematicPreset[] = [
  { id: "none", label: "Neutral", group: "quick", swatch: "linear-gradient(135deg,#52525b,#18181b)", patch: {} },
  { id: "tealorange", label: "Teal & Orange", group: "quick", swatch: "linear-gradient(135deg,#0ea5e9,#f97316)", patch: { saturation: 22, contrast: 16, hue: 6, tint: 10, highlights: 8, shadows: -10 } },
  { id: "noir", label: "Moody Noir", group: "quick", swatch: "linear-gradient(135deg,#111827,#6b7280)", patch: { saturation: -70, contrast: 30, brightness: -6, blacks: -18, whites: 10 } },
  { id: "cyberpunk", label: "Cyberpunk", group: "quick", swatch: "linear-gradient(135deg,#d946ef,#22d3ee)", patch: { saturation: 48, contrast: 26, hue: -55, tint: 36, vibrance: 20 } },
  { id: "golden", label: "Golden Hour", group: "quick", swatch: "linear-gradient(135deg,#f59e0b,#fde68a)", patch: { saturation: 18, contrast: 8, brightness: 6, hue: 14, tint: 8, highlights: 12 } },
  { id: "vintage", label: "Vintage Film", group: "more", swatch: "linear-gradient(135deg,#a16207,#78350f)", patch: { saturation: -18, contrast: 12, hue: 12, tint: 14, shadows: 12, highlights: -8, clarity: 12 } },
  { id: "matrix", label: "Matrix Green", group: "more", swatch: "linear-gradient(135deg,#166534,#052e16)", patch: { saturation: 22, contrast: 24, hue: -40, tint: -45, shadows: -10 } },
  { id: "bleach", label: "Bleach Bypass", group: "more", swatch: "linear-gradient(135deg,#e5e7eb,#78716c)", patch: { saturation: -42, contrast: 36, clarity: 22, whites: 10, blacks: -14 } },
  { id: "sunset", label: "Sunset Glow", group: "more", swatch: "linear-gradient(135deg,#fb7185,#f59e0b)", patch: { saturation: 24, brightness: 6, hue: 18, tint: 16, highlights: 14, vibrance: 18 } },
  { id: "crisp", label: "Crisp High-Contrast", group: "more", swatch: "linear-gradient(135deg,#f8fafc,#0f172a)", patch: { contrast: 38, clarity: 28, sharpness: 34, blacks: -10, whites: 12 } },
  { id: "anamorphic", label: "Anamorphic Blue", group: "more", swatch: "linear-gradient(135deg,#1d4ed8,#0ea5e9)", patch: { saturation: 16, hue: -40, tint: -18, contrast: 18, shadows: -8, highlights: 8 } },
  { id: "pastel", label: "Pastel Dream", group: "more", swatch: "linear-gradient(135deg,#fbcfe8,#bfdbfe)", patch: { saturation: -8, brightness: 10, contrast: -8, highlights: 14, shadows: 16, blur: 1 } },
  { id: "monosoft", label: "Monochrome Soft", group: "more", swatch: "linear-gradient(135deg,#d4d4d8,#3f3f46)", patch: { saturation: -100, contrast: 10, clarity: 16, brightness: 4 } },
  { id: "desat", label: "Desaturated Action", group: "more", swatch: "linear-gradient(135deg,#94a3b8,#334155)", patch: { saturation: -34, contrast: 22, clarity: 24, sharpness: 20 } },
  { id: "kodak", label: "Warm Kodak", group: "more", swatch: "linear-gradient(135deg,#fbbf24,#b45309)", patch: { saturation: 14, hue: 12, tint: 10, highlights: 8, shadows: 6, contrast: 10 } },
  { id: "fuji", label: "Fuji Chrome", group: "more", swatch: "linear-gradient(135deg,#34d399,#0f766e)", patch: { saturation: 10, contrast: 16, hue: -6, tint: -10, clarity: 14 } },
  { id: "nordic", label: "Nordic Cold", group: "more", swatch: "linear-gradient(135deg,#7dd3fc,#1e3a8a)", patch: { saturation: -14, hue: -28, tint: -16, contrast: 14, whites: 8, blacks: -10 } },
  { id: "hollywood", label: "Hollywood Pop", group: "more", swatch: "linear-gradient(135deg,#fb923c,#7c3aed)", patch: { saturation: 26, contrast: 20, vibrance: 24, highlights: 10, clarity: 12 } },
  { id: "retro80", label: "Retro 80s", group: "more", swatch: "linear-gradient(135deg,#f472b6,#22d3ee)", patch: { saturation: 34, hue: -30, tint: 34, contrast: 20, exposure: 4, blur: 1 } },
  { id: "cineteal", label: "Cinematic Teal", group: "more", swatch: "linear-gradient(135deg,#2dd4bf,#155e75)", patch: { saturation: 18, hue: -22, tint: 18, contrast: 18, shadows: -10, highlights: 8 } },
];

/** Platform framing presets — aspect ratio + automatic canvas fill. */
const FRAMING_PRESETS: { id: AspectRatio; label: string; note: string }[] = [
  { id: "9:16", label: "TikTok / Reels", note: "9:16 vertical" },
  { id: "16:9", label: "YouTube", note: "16:9 landscape" },
  { id: "1:1", label: "Square", note: "1:1 feed" },
  { id: "21:9", label: "Cinematic", note: "21:9 anamorphic" },
];

const SPEED_PRESET_CARDS: { id: SpeedPreset; label: string; note: string }[] = [
  { id: "none", label: "Normal", note: "1× constant" },
  { id: "montage", label: "Montage", note: "punchy in/out" },
  { id: "bullet", label: "Bullet", note: "slow-mo beat" },
  { id: "hero", label: "Hero Ramp", note: "slow build" },
  { id: "jumpCut", label: "Jump Cut", note: "fast spikes" },
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

type WheelValue = { x: number; y: number };

/** Shared handle to the Program Monitor canvas so scopes can sample it live. */
const programCanvasRef: { current: HTMLCanvasElement | null } = { current: null };

/** Corner resize handles for the on-canvas overlay selection box. */
const CORNER_CLASSES = [
  { id: "nw", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { id: "ne", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { id: "sw", className: "-left-1.5 -bottom-1.5 cursor-nesw-resize" },
  { id: "se", className: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
] as const;

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
/* Screen & webcam recorder (desktop only)                             */
/* ------------------------------------------------------------------ */
function ScreenCamRecorder() {
  const addVideoAssets = useEditorStore((s) => s.addVideoAssets);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<ActiveCapture | null>(null);
  const [recording, setRecording] = useState<CaptureKind | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  const stop = async () => {
    const active = captureRef.current;
    captureRef.current = null;
    setRecording(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (!active) return;
    try {
      const blob = await active.stop();
      if (blob && blob.size > 0) {
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `recording-${Date.now()}.${extension}`, {
          type: blob.type || "video/webm",
        });
        await addVideoAssets([file]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording failed.");
    }
  };

  const start = async (kind: CaptureKind) => {
    setError(null);
    setSeconds(0);
    try {
      const active = await startCapture(kind);
      captureRef.current = active;
      setRecording(kind);
      if (videoRef.current && kind !== "voice") {
        videoRef.current.srcObject = active.stream;
        void videoRef.current.play().catch(() => {});
      }
      void active.ended.then(() => {
        if (captureRef.current === active) void stop();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start capture.");
    }
  };

  useEffect(() => () => captureRef.current?.cancel(), []);

  const supported = isCaptureSupported("screen") || isCaptureSupported("webcam");

  return (
    <div className="space-y-3">
      <p className="text-[10px] leading-4 text-zinc-500">
        Record your screen or webcam and drop the result straight into the media
        bin — ready for the timeline.
      </p>
      {!supported && (
        <p className="text-[10px] text-amber-300">
          Screen / camera capture isn&apos;t supported in this browser.
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
        <video ref={videoRef} muted playsInline className="aspect-video w-full object-contain" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!!recording || !isCaptureSupported("screen")}
          onClick={() => void start("screen")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600 disabled:opacity-40"
        >
          <MonitorPlay className="h-3.5 w-3.5 text-violet-400" aria-hidden /> Record screen
        </button>
        <button
          type="button"
          disabled={!!recording || !isCaptureSupported("webcam")}
          onClick={() => void start("webcam")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600 disabled:opacity-40"
        >
          <Camera className="h-3.5 w-3.5 text-fuchsia-400" aria-hidden /> Record cam
        </button>
      </div>
      {recording && (
        <button
          type="button"
          onClick={() => void stop()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-semibold text-white"
        >
          <Square className="h-3.5 w-3.5" aria-hidden /> Stop recording · {seconds}s
        </button>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top-left: Project bin + Inspector                                    */
/* ------------------------------------------------------------------ */
function ProjectBinPanel({
  onBatchExport,
}: {
  onBatchExport?: (clipIds: string[]) => void;
}) {
  const [tab, setTab] = useState<
    | "media"
    | "effects"
    | "properties"
    | "clip"
    | "speed"
    | "captions"
    | "audio"
    | "stickers"
    | "record"
    | "studio"
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
  const updateEffectPanel = useEditorStore((s) => s.updateEffect);

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
  const applyCaptionPreset = useEditorStore((s) => s.applyCaptionPreset);
  const generateCaptionsFromScript = useEditorStore((s) => s.generateCaptionsFromScript);
  const chromaKey = useEditorStore((s) => s.chromaKey);
  const setChromaKey = useEditorStore((s) => s.setChromaKey);
  const resetChromaKey = useEditorStore((s) => s.resetChromaKey);
  const setEyedropper = useEditorStore((s) => s.setEyedropper);
  const eyedropper = useEditorStore((s) => s.eyedropper);
  const overlayKeyframes = selected?.keyframes ?? [];
  const addOverlayKeyframe = useEditorStore((s) => s.addOverlayKeyframe);
  const removeOverlayKeyframe = useEditorStore((s) => s.removeOverlayKeyframe);
  const clearOverlayKeyframes = useEditorStore((s) => s.clearOverlayKeyframes);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);
  const removeAudioTrack = useEditorStore((s) => s.removeAudioTrack);
  const addSoundEffect = useEditorStore((s) => s.addSoundEffect);
  const addAudioFiles = useEditorStore((s) => s.addAudioFiles);
  const speedPreset = useEditorStore((s) => s.speedPreset);
  const setSpeedPreset = useEditorStore((s) => s.setSpeedPreset);
  const addTextSticker = useEditorStore((s) => s.addTextSticker);
  const addStickerImage = useEditorStore((s) => s.addStickerImage);
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const canvasFill = useEditorStore((s) => s.canvasFill);
  const setCanvasFill = useEditorStore((s) => s.setCanvasFill);
  const [stickerCategory, setStickerCategory] = useState<StickerCategory>("emoji");
  const [script, setScript] = useState("");
  const [dictating, setDictating] = useState(false);
  const dictationRef = useRef<ReturnType<typeof createDictation> | null>(null);
  const dictationSupported = useMemo(() => isDictationSupported(), []);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);

  const handleAutoCaptions = async () => {
    if (transcribing) return;
    void generateAutoCaptions();
  };

  const nameFor = (assetId: string) =>
    assets.find((a) => a.id === assetId)?.name ?? "Clip";

  const patchSelected = (patch: Partial<Omit<TextOverlay, "id">>) => {
    if (selected) updateOverlay(selected.id, patch);
  };

  return (
    <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="custom-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-zinc-800 px-1 py-1">
        {(
          [
            ["media", "Media"],
            ["effects", "Effects"],
            ["properties", "Props"],
            ["clip", "Clip"],
            ["speed", "Speed"],
            ["captions", "Captions"],
            ["audio", "Audio"],
            ["stickers", "Stickers"],
            ["record", "Record"],
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
          <div className="space-y-3">
            {EFFECT_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.types.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addEffect(type, currentTime)}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-violet-500/50 hover:text-violet-200"
                    >
                      {effectLabel(type)}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {activeEffects.length > 0 && (
              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Applied ({activeEffects.length})
                </p>
                <ul className="space-y-2">
                  {activeEffects.map((fx) => (
                    <li
                      key={fx.id}
                      className="space-y-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-1.5 text-[11px] text-fuchsia-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">
                          {effectLabel(fx.type)} · {fx.startTime.toFixed(1)}s
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEffect(fx.id)}
                          aria-label="Remove effect"
                          className="rounded p-1 text-fuchsia-200/70 hover:text-white"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                      <label className="block">
                        <span className="flex items-center justify-between text-[10px] text-fuchsia-200/80">
                          <span>Intensity</span>
                          <span className="tabular-nums">
                            {Math.round(fx.intensity * 100)}%
                          </span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={fx.intensity}
                          onChange={(e) =>
                            updateEffectPanel(fx.id, { intensity: Number(e.target.value) })
                          }
                          className="w-full accent-fuchsia-400"
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
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
                    ...(selected.imageSrc
                      ? []
                      : ([["Scale", "fontSize", 16, 180, "px"]] as const)),
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

                {selected.imageSrc && (
                  <label className="block">
                    <span className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>Scale</span>
                      <span className="tabular-nums">
                        {(selected.scale ?? 1).toFixed(2)}×
                      </span>
                    </span>
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.05}
                      value={selected.scale ?? 1}
                      onChange={(e) =>
                        patchSelected({ scale: Number(e.target.value) })
                      }
                      className="mt-0.5 w-full accent-violet-500"
                    />
                  </label>
                )}

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

            {selected && (
              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <Diamond className="h-3 w-3" aria-hidden /> Keyframes
                  </p>
                  <button
                    type="button"
                    onClick={() => addOverlayKeyframe(selected.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-200 hover:border-zinc-600"
                  >
                    <Plus className="h-3 w-3" aria-hidden /> Add @ playhead
                  </button>
                </div>
                {overlayKeyframes.length === 0 ? (
                  <p className="text-[10px] leading-4 text-zinc-500">
                    Add keyframes at the playhead to animate scale, position,
                    opacity and rotation — the renderer LERPs between them.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-1">
                      {overlayKeyframes.map((frame) => (
                        <li
                          key={frame.id}
                          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-300"
                        >
                          <Diamond className="h-3 w-3 text-amber-300" aria-hidden />
                          <span className="flex-1 tabular-nums">
                            {frame.time.toFixed(2)}s
                          </span>
                          <span className="text-zinc-500">×{frame.scale.toFixed(2)}</span>
                          <button
                            type="button"
                            aria-label="Delete keyframe"
                            onClick={() => removeOverlayKeyframe(selected.id, frame.id)}
                            className="rounded p-0.5 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => clearOverlayKeyframes(selected.id)}
                      className="text-[10px] text-zinc-500 hover:text-red-400"
                    >
                      Clear all keyframes
                    </button>
                  </>
                )}
              </div>
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
            {/* Chroma key / green screen cutout */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Chroma Key / Cutout
                </p>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={chromaKey.enabled}
                    onChange={(e) => setChromaKey({ enabled: e.target.checked })}
                    className="accent-violet-500"
                  />
                  On
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={chromaKey.color}
                  onChange={(e) => setChromaKey({ color: e.target.value, enabled: true })}
                  aria-label="Key color"
                  className="h-8 w-12 shrink-0 rounded border border-zinc-800 bg-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => setEyedropper(!eyedropper)}
                  aria-pressed={eyedropper}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                    eyedropper
                      ? "border-violet-500 bg-violet-600/15 text-violet-200"
                      : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                  )}
                >
                  <Pipette className="h-3.5 w-3.5" aria-hidden />
                  {eyedropper ? "Click the monitor…" : "Eyedropper"}
                </button>
              </div>
              <label className="block">
                <span className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Tolerance</span>
                  <span className="tabular-nums">{Math.round(chromaKey.tolerance)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={chromaKey.tolerance}
                  onChange={(e) =>
                    setChromaKey({ tolerance: Number(e.target.value), enabled: true })
                  }
                  className="mt-0.5 w-full accent-violet-500"
                />
              </label>
              <label className="block">
                <span className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Edge feather</span>
                  <span className="tabular-nums">{Math.round(chromaKey.feather)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={chromaKey.feather}
                  onChange={(e) =>
                    setChromaKey({ feather: Number(e.target.value), enabled: true })
                  }
                  className="mt-0.5 w-full accent-violet-500"
                />
              </label>
              <button
                type="button"
                onClick={resetChromaKey}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300 hover:border-zinc-600"
              >
                Reset chroma key
              </button>
            </div>

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

            {/* Platform framing presets + canvas fill */}
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Platform framing
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {FRAMING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAspect(preset.id);
                      setFit("contain");
                    }}
                    aria-pressed={aspect === preset.id}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-left text-[11px] transition-colors",
                      aspect === preset.id
                        ? "border-violet-500 bg-violet-600/15 text-violet-200"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                    )}
                  >
                    <span className="block font-medium">{preset.label}</span>
                    <span className="block text-[10px] text-zinc-500">{preset.note}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCanvasFill(canvasFill === "blur" ? "black" : "blur")}
                aria-pressed={canvasFill === "blur"}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] transition-colors",
                  canvasFill === "blur"
                    ? "border-violet-500 bg-violet-600/15 text-violet-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {canvasFill === "blur" ? "Blurred background fill" : "Black letterbox fill"}
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

            {transcriptionError && (
              <p role="alert" className="text-[10px] leading-4 text-red-400">
                {transcriptionError}
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

            {/* Social caption styles + on-device script generator */}
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Caption styles ({CAPTION_PRESETS.length})
              </p>
              <div className="custom-scrollbar grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                {CAPTION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyCaptionPreset(preset.id)}
                    aria-pressed={captionStyle.preset === preset.id}
                    className={cn(
                      "flex items-center gap-1.5 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left text-[10px] transition-colors",
                      captionStyle.preset === preset.id
                        ? "border-violet-500 bg-violet-600/15 text-violet-200"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                    )}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-white/20"
                      style={{ background: preset.swatch }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{preset.label}</span>
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-zinc-400">
                  Script → captions (on-device)
                </span>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={3}
                  placeholder="Type or paste your script…"
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-100 focus:border-violet-500 focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void generateCaptionsFromScript(script)}
                  disabled={!script.trim()}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600 disabled:opacity-40"
                >
                  Generate captions
                </button>
                <button
                  type="button"
                  disabled={!dictationSupported}
                  title={
                    dictationSupported
                      ? "Dictate your script (browser speech recognition)"
                      : "Speech recognition isn't available in this browser"
                  }
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
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] disabled:opacity-40",
                    dictating
                      ? "border-red-500/40 bg-red-500/10 text-red-300"
                      : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-zinc-600"
                  )}
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden />
                  {dictating ? "Stop" : "Dictate"}
                </button>
              </div>
            </div>

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

        {tab === "audio" && (
          <div className="space-y-3">
            <p className="text-[10px] leading-4 text-zinc-500">
              {SOUND_EFFECTS.length} royalty-free sound effects, synthesized
              on-device — tap to drop one at the playhead.
            </p>
            {SOUND_EFFECT_CATEGORIES.map((category) => (
              <div key={category.id}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {category.label}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SOUND_EFFECTS.filter((effect) => effect.category === category.id).map(
                    (effect) => (
                      <button
                        key={effect.id}
                        type="button"
                        onClick={() => void addSoundEffect(effect.id)}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-left text-[11px] text-zinc-200 transition-colors hover:border-violet-500/50"
                      >
                        {effect.label}
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}

            <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-200 hover:border-zinc-600">
              <Music className="h-3.5 w-3.5 text-violet-400" aria-hidden /> Import audio
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

            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Mixer
              </p>
              {audioTracks.length === 0 ? (
                <p className="text-[10px] text-zinc-500">No audio tracks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {audioTracks.map((track) => (
                    <li
                      key={track.id}
                      className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <AudioLines className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">
                          {track.name}
                        </span>
                        <button
                          type="button"
                          aria-pressed={track.muted}
                          aria-label="Mute track"
                          onClick={() => updateAudioTrack(track.id, { muted: !track.muted })}
                          className={cn(
                            "rounded p-1",
                            track.muted ? "text-amber-300" : "text-zinc-500 hover:text-zinc-200"
                          )}
                        >
                          {track.muted ? (
                            <VolumeX className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-pressed={track.solo}
                          aria-label="Solo track"
                          onClick={() => updateAudioTrack(track.id, { solo: !track.solo })}
                          className={cn(
                            "rounded px-1 text-[10px] font-bold",
                            track.solo ? "text-sky-300" : "text-zinc-500 hover:text-zinc-200"
                          )}
                        >
                          S
                        </button>
                        <button
                          type="button"
                          aria-label="Remove audio"
                          onClick={() => removeAudioTrack(track.id)}
                          className="rounded p-1 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <Waveform buffer={track.buffer} className="h-8 w-full rounded bg-zinc-900/60" />
                      <label className="block">
                        <span className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span>Volume</span>
                          <span className="tabular-nums">{Math.round(track.volume * 100)}%</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={track.volume}
                          onChange={(e) =>
                            updateAudioTrack(track.id, { volume: Number(e.target.value) })
                          }
                          className="w-full accent-violet-500"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-[10px] text-zinc-500">
                            Fade in · {track.fadeIn.toFixed(1)}s
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(track.duration, 0.1)}
                            step={0.1}
                            value={track.fadeIn}
                            onChange={(e) =>
                              updateAudioTrack(track.id, { fadeIn: Number(e.target.value) })
                            }
                            className="w-full accent-violet-500"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] text-zinc-500">
                            Fade out · {track.fadeOut.toFixed(1)}s
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(track.duration, 0.1)}
                            step={0.1}
                            value={track.fadeOut}
                            onChange={(e) =>
                              updateAudioTrack(track.id, { fadeOut: Number(e.target.value) })
                            }
                            className="w-full accent-violet-500"
                          />
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "speed" && (
          <div className="space-y-3">
            <p className="text-[10px] leading-4 text-zinc-500">
              Velocity curves ramp both playback and the export time-mapping.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {SPEED_PRESET_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSpeedPreset(card.id)}
                  aria-pressed={speedPreset === card.id}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-left text-[11px] transition-colors",
                    speedPreset === card.id
                      ? "border-violet-500 bg-violet-600/15 text-violet-200"
                      : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                  )}
                >
                  <span className="flex items-center gap-1 font-medium">
                    <Zap className="h-3 w-3 text-violet-400" aria-hidden />
                    {card.label}
                  </span>
                  <span className="block text-[10px] text-zinc-500">{card.note}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <VelocityCurveEditor />
              <p className="mt-1 text-[10px] text-zinc-500">
                Active:{" "}
                <span className="capitalize text-zinc-300">
                  {speedPreset === "none" ? "normal" : speedPreset}
                </span>
              </p>
            </div>
          </div>
        )}

        {tab === "stickers" && (
          <div className="space-y-3">
            <p className="text-[10px] leading-4 text-zinc-500">
              Tap a sticker to drop it on the V2 overlay track at the playhead.
            </p>
            <div className="flex flex-wrap gap-1">
              {STICKER_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setStickerCategory(category.id)}
                  aria-pressed={stickerCategory === category.id}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] transition-colors",
                    stickerCategory === category.id
                      ? "bg-violet-600/20 text-violet-200"
                      : "text-zinc-400 hover:text-zinc-100"
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {STICKERS.filter((sticker) => sticker.category === stickerCategory).map(
                (sticker) => (
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
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60 p-1 hover:border-zinc-600"
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
                )
              )}
            </div>
          </div>
        )}

        {tab === "record" && <ScreenCamRecorder />}

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
/* Transition junction: preview tiles + configuration modal            */
/* ------------------------------------------------------------------ */
function TransitionPreview({ type }: { type: TransitionType }) {
  const top: Record<TransitionType, string> = {
    crossDissolve: "opacity-100 group-hover:opacity-0",
    dipToBlack: "",
    whipPan: "translate-x-0 group-hover:-translate-x-full",
    glitchCut: "opacity-100 group-hover:translate-x-2 group-hover:opacity-0",
    zoomIn: "scale-100 group-hover:scale-125 group-hover:opacity-0",
    zoomBlur: "scale-100 group-hover:scale-125 group-hover:opacity-0 group-hover:blur-sm",
  };
  return (
    <span className="relative block h-9 w-full overflow-hidden rounded-md bg-zinc-950 ring-1 ring-inset ring-zinc-800">
      <span className="absolute inset-0 bg-gradient-to-br from-sky-500 to-blue-700" />
      <span
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-600 transition-all duration-500 ease-in-out",
          top[type]
        )}
      />
      {type === "dipToBlack" && (
        <span className="absolute inset-0 bg-black opacity-0 transition-opacity duration-500 ease-in-out group-hover:opacity-100" />
      )}
    </span>
  );
}

function TransitionModal({
  clipId,
  onClose,
}: {
  clipId: string | null;
  onClose: () => void;
}) {
  const sequence = useEditorStore((s) => s.sequence);
  const setClipTransition = useEditorStore((s) => s.setClipTransition);
  const clip = clipId ? sequence.find((c) => c.id === clipId) ?? null : null;
  // Remounted per clip (keyed by the parent), so local state initialises fresh.
  const [type, setType] = useState<TransitionType | null>(
    clip?.transitionIn?.type ?? null
  );
  const [duration, setDuration] = useState(clip?.transitionIn?.duration ?? 0.5);

  if (!clip) return null;

  return (
    <Modal
      open={!!clipId}
      title="Transition"
      onClose={onClose}
      className="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              setClipTransition(clip.id, null);
              onClose();
            }}
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-zinc-600"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => {
              setClipTransition(clip.id, type, duration);
              onClose();
            }}
            disabled={!type}
            className="brand-gradient brand-gradient-hover rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Apply transition
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {TRANSITION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setType(preset.id)}
            aria-pressed={type === preset.id}
            className={cn(
              "group space-y-1.5 rounded-lg border p-2 text-left text-[11px] transition-colors",
              type === preset.id
                ? "border-violet-500 bg-violet-600/15 text-violet-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
            )}
          >
            <TransitionPreview type={preset.id} />
            <span className="block truncate">{preset.label}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Duration</span>
          <span className="tabular-nums">{duration.toFixed(2)}s</span>
        </span>
        <input
          type="range"
          min={0.1}
          max={1.6}
          step={0.05}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="mt-0.5 w-full accent-violet-500"
        />
      </label>
      <p className="mt-2 text-[10px] leading-4 text-zinc-600">
        Hover a tile to preview. Transitions blend the outgoing clip into this
        one across the shared boundary (rendered in exports).
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Top-center: Program monitor + transport                              */
/* ------------------------------------------------------------------ */
function ProgramPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayDrag = useOverlayCanvasDrag(canvasRef);
  // Expose the graded canvas so the Lumetri scopes can sample it live.
  useEffect(() => {
    programCanvasRef.current = canvasRef.current;
    return () => {
      programCanvasRef.current = null;
    };
  }, []);
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
  const canvasFill = useEditorStore((s) => s.canvasFill);
  const setCanvasFill = useEditorStore((s) => s.setCanvasFill);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const seek = useEditorStore((s) => s.seek);
  const markIn = useEditorStore((s) => s.markIn);
  const markOut = useEditorStore((s) => s.markOut);
  const setMarkIn = useEditorStore((s) => s.setMarkIn);
  const setMarkOut = useEditorStore((s) => s.setMarkOut);
  const clearMarks = useEditorStore((s) => s.clearMarks);
  const eyedropper = useEditorStore((s) => s.eyedropper);
  const selectedOverlayId = useEditorStore((s) => s.selectedId);
  const updateOverlayBox = useEditorStore((s) => s.updateOverlay);

  const [selBox, setSelBox] = useState<
    { x: number; y: number; w: number; h: number } | null
  >(null);
  const selBoxKey = useRef("");
  const resizeRef = useRef<{
    pointerId: number;
    cx: number;
    cy: number;
    half: number;
    scale0: number;
    fontSize0: number;
    id: string;
  } | null>(null);

  // Live selection box over the selected overlay so it can be resized on-canvas.
  useEffect(() => {
    const id = window.setInterval(() => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      const ctx = canvas?.getContext("2d");
      const state = useEditorStore.getState();
      const overlay = state.selectedId
        ? state.overlays.find((o) => o.id === state.selectedId)
        : null;
      const clear = () => {
        if (selBoxKey.current !== "") {
          selBoxKey.current = "";
          setSelBox(null);
        }
      };
      if (!canvas || !wrap || !ctx || !overlay) {
        clear();
        return;
      }
      const sceneTime = state.videoEl
        ? state.videoEl.currentTime
        : state.currentTime;
      if (sceneTime < overlay.startTime || sceneTime > overlay.endTime) {
        clear();
        return;
      }
      const bounds = measureOverlayBounds(
        ctx,
        overlay,
        canvas.width,
        canvas.height,
        resolveOverlayTransform(overlay, sceneTime)
      );
      if (!bounds || !canvas.width) {
        clear();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      if (rect.width <= 0) return;
      const sx = rect.width / canvas.width;
      const sy = rect.height / canvas.height;
      const box = {
        x: rect.left - wrapRect.left + bounds.x * sx,
        y: rect.top - wrapRect.top + bounds.y * sy,
        w: bounds.w * sx,
        h: bounds.h * sy,
      };
      const key = `${box.x.toFixed(1)},${box.y.toFixed(1)},${box.w.toFixed(1)},${box.h.toFixed(1)}`;
      if (key !== selBoxKey.current) {
        selBoxKey.current = key;
        setSelBox(box);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const onResizeDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    id: string
  ) => {
    const wrap = wrapRef.current;
    if (!wrap || !selBox || !id) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const wrapRect = wrap.getBoundingClientRect();
    const overlay = useEditorStore.getState().overlays.find((o) => o.id === id);
    resizeRef.current = {
      pointerId: event.pointerId,
      cx: wrapRect.left + selBox.x + selBox.w / 2,
      cy: wrapRect.top + selBox.y + selBox.h / 2,
      half: Math.max(12, Math.min(selBox.w, selBox.h) / 2),
      scale0: overlay?.scale ?? 1,
      fontSize0: overlay?.fontSize ?? 64,
      id,
    };
  };
  const onResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = resizeRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dist = Math.max(
      Math.abs(event.clientX - drag.cx),
      Math.abs(event.clientY - drag.cy)
    );
    const factor = Math.max(0.1, dist / drag.half);
    const overlay = useEditorStore.getState().overlays.find((o) => o.id === drag.id);
    if (!overlay) return;
    if (overlay.imageSrc) {
      updateOverlayBox(drag.id, {
        scale: Math.min(4, Math.max(0.08, drag.scale0 * factor)),
      });
    } else {
      updateOverlayBox(drag.id, {
        fontSize: Math.min(260, Math.max(10, drag.fontSize0 * factor)),
      });
    }
  };
  const onResizeUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
  };

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
    const handleFrame = () => {
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
          if (now - lastSync >= 100) {
            lastSync = now;
            if (Math.abs(video.currentTime - useEditorStore.getState().currentTime) > 0.01) {
              useEditorStore.setState({ currentTime: video.currentTime });
            }
          }
        }

        // Clip boundary — roll into the next clip, loop the marked region, or stop.
        const regionStart = state.markIn ?? state.trimStart;
        const regionEnd = state.markOut ?? state.trimEnd;
        // Respect an In mark: if playback starts before it, jump forward.
        if (
          state.playing &&
          state.markIn !== null &&
          !video.paused &&
          video.currentTime < regionStart - 0.1
        ) {
          video.currentTime = regionStart;
        }
        const reachedEnd =
          state.duration > 0 &&
          (video.ended || video.currentTime >= regionEnd - 0.02);
        if (reachedEnd && state.playing) {
          const advanced = state.advanceClip(loopRef.current);
          if (!advanced) {
            if (loopRef.current) {
              video.currentTime = regionStart;
              if (video.ended) void video.play().catch(() => {});
            } else {
              state.setPlaying(false);
            }
          }
        }
      }

      // V1 lane mute gates the source video's own audio.
      const v1Muted = state.trackStates.V1.muted;
      if (video && video.muted !== v1Muted) video.muted = v1Muted;

      audioPreview.sync(
        effectiveAudioTracks(state),
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
          colorWheels: state.colorWheels,
          // V1/V2/V3 eye + solo decide which layers reach the canvas.
          ...visibleLayerFlags(state.trackStates),
        },
        { placeholder: true }
      );
    };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      handleFrame();
    };

    /**
     * Background-tab recovery: re-sync the media element with the store, then
     * force one frame so the program monitor never stays black on return.
     */
    const resync = () => {
      const state = useEditorStore.getState();
      const video = state.videoEl;
      if (video) {
        const drift = Math.abs(video.currentTime - state.currentTime);
        if (state.playing) {
          // The element clock is authoritative while playing; only seek when it
          // was clearly reset (no data / back at the start).
          if (
            (video.readyState < 2 || video.currentTime === 0) &&
            state.currentTime > 0.5
          ) {
            try {
              video.currentTime = state.currentTime;
            } catch {
              // Not seekable yet.
            }
          } else if (drift > 0.25) {
            useEditorStore.setState({ currentTime: video.currentTime });
          }
          if (video.paused) void video.play().catch(() => {});
        } else {
          if (!video.paused) video.pause();
          if (drift > 0.05) {
            try {
              video.currentTime = state.currentTime;
            } catch {
              // Not seekable yet.
            }
          }
        }
        if (video.muted !== state.trackStates.V1.muted) {
          video.muted = state.trackStates.V1.muted;
        }
      }
      handleFrame();
    };

    installMediaRecovery();
    const unsubscribe = onMediaRestore(resync);

    rafId = requestAnimationFrame(tick);
    return () => {
      unsubscribe();
      cancelAnimationFrame(rafId);
    };
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
          {(["9:16", "16:9", "1:1", "21:9"] as const).map((option) => (
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
        <button
          type="button"
          onClick={() => setCanvasFill(canvasFill === "blur" ? "black" : "blur")}
          aria-pressed={canvasFill === "blur"}
          title="Blurred background fill for mismatched media"
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
            canvasFill === "blur"
              ? "bg-violet-600/20 text-violet-200 ring-1 ring-inset ring-violet-500/40"
              : "border border-zinc-800 bg-zinc-950/60 text-zinc-500"
          )}
        >
          Blur Fill
        </button>
      </div>

      <div
        ref={wrapRef}
        className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={overlayDrag.onPointerDown}
          onPointerMove={overlayDrag.onPointerMove}
          onPointerUp={overlayDrag.onPointerUp}
          onPointerCancel={overlayDrag.onPointerCancel}
          className={cn(
            "max-h-full max-w-full touch-none rounded-lg ring-1 ring-zinc-800",
            eyedropper ? "cursor-crosshair" : "cursor-move"
          )}
          aria-label="Program preview"
        />

        {/* On-canvas transform handles for the selected overlay */}
        {selBox && (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: selBox.x,
              top: selBox.y,
              width: Math.max(8, selBox.w),
              height: Math.max(8, selBox.h),
            }}
          >
            <span className="absolute inset-0 rounded border border-violet-400/80" />
            {CORNER_CLASSES.map((corner) => (
              <button
                key={corner.id}
                type="button"
                aria-label={`Resize overlay ${corner.id}`}
                onPointerDown={(e) => onResizeDown(e, selectedOverlayId ?? "")}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeUp}
                onPointerCancel={onResizeUp}
                className={cn(
                  "pointer-events-auto absolute h-3 w-3 touch-none rounded-sm border border-violet-200 bg-white shadow",
                  corner.className
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="space-y-2 border-t border-zinc-800 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded bg-zinc-950 px-2 py-1 font-mono text-[11px] tabular-nums text-emerald-300 ring-1 ring-inset ring-zinc-800">
            {formatTimecode(currentTime, fps)} / {formatTimecode(duration, fps)}
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
            onClick={() => setMarkIn(currentTime)}
            disabled={!hasVideo}
            title="Mark In (I)"
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] disabled:opacity-40",
              markIn !== null
                ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
            )}
          >
            <Scissors className="h-3.5 w-3.5" aria-hidden /> Mark In
            {markIn !== null && (
              <span className="tabular-nums">{markIn.toFixed(1)}s</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMarkOut(currentTime)}
            disabled={!hasVideo}
            title="Mark Out (O)"
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] disabled:opacity-40",
              markOut !== null
                ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
            )}
          >
            <Scissors className="h-3.5 w-3.5 -scale-x-100" aria-hidden /> Mark Out
            {markOut !== null && (
              <span className="tabular-nums">{markOut.toFixed(1)}s</span>
            )}
          </button>
          {(markIn !== null || markOut !== null) && (
            <button
              type="button"
              onClick={clearMarks}
              title="Clear In/Out marks"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              Clear marks
            </button>
          )}
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
  const colorWheels = useEditorStore((s) => s.colorWheels);
  const setColorWheel = useEditorStore((s) => s.setColorWheel);
  const resetColorAdjustments = useEditorStore((s) => s.resetColorAdjustments);
  const scopeRef = useRef<HTMLCanvasElement>(null);

  const [presetId, setPresetId] = useState("none");
  const [presetIntensity, setPresetIntensity] = useState(100);
  const [showMore, setShowMore] = useState(false);

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

  // Real-time 256-bin luminance histogram sampled from the Program Monitor
  // canvas (falling back to the source video), so it reflects colour wheels,
  // sliders and presets live.
  useEffect(() => {
    const canvas = scopeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const sample = document.createElement("canvas");
    sample.width = 160;
    sample.height = 90;
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
    if (!ctx || !sampleCtx) return;
    const bins = new Uint32Array(256);

    const id = window.setInterval(() => {
      if (canvas.offsetParent === null) return;

      const state = useEditorStore.getState();
      const program = programCanvasRef.current;
      let source: CanvasImageSource | null = null;
      if (program && program.width > 0) {
        source = program;
      } else if (state.videoEl && state.videoEl.readyState >= 2) {
        source = state.videoEl;
      }

      const paintBackground = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      if (!source) {
        paintBackground();
        return;
      }

      try {
        sampleCtx.clearRect(0, 0, sample.width, sample.height);
        sampleCtx.drawImage(source, 0, 0, sample.width, sample.height);
      } catch {
        paintBackground();
        return;
      }

      let data: Uint8ClampedArray;
      try {
        data = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
      } catch {
        paintBackground();
        return;
      }

      bins.fill(0);
      for (let i = 0; i < data.length; i += 4) {
        const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        bins[Math.min(255, y | 0)] += 1;
      }
      let max = 1;
      for (let b = 0; b < 256; b += 1) if (bins[b] > max) max = bins[b];

      paintBackground();
      const barW = canvas.width / 256;
      for (let b = 0; b < 256; b += 1) {
        const h = (bins[b] / max) * canvas.height;
        ctx.fillStyle = `hsl(${258 - (b / 255) * 40} 88% ${54 + (b / 255) * 18}%)`;
        ctx.fillRect(b * barW, canvas.height - h, Math.max(0.9, barW), h);
      }
      // Baseline so the scope reads as "live" even on a dark frame.
      ctx.fillStyle = "rgba(167,139,250,0.35)";
      ctx.fillRect(0, canvas.height - 1, canvas.width, 1);
    }, 110);

    return () => window.clearInterval(id);
  }, []);

  const sliders = [
    ["Exposure", "exposure", -100, 100],
    ["Brightness", "brightness", -100, 100],
    ["Contrast", "contrast", -100, 100],
    ["Highlights", "highlights", -100, 100],
    ["Shadows", "shadows", -100, 100],
    ["Whites", "whites", -100, 100],
    ["Blacks", "blacks", -100, 100],
    ["Vibrance", "vibrance", -100, 100],
    ["Saturation", "saturation", -100, 100],
    ["Temperature", "hue", -100, 100],
    ["Tint", "tint", -100, 100],
    ["Sharpness", "sharpness", 0, 100],
    ["Clarity", "clarity", 0, 100],
  ] as const;

  const quickPresets = CINEMATIC_PRESETS.filter((p) => p.group === "quick");
  const morePresets = CINEMATIC_PRESETS.filter((p) => p.group === "more");

  const presetButton = (preset: CinematicPreset) => (
    <button
      key={preset.id}
      type="button"
      onClick={() => {
        setPresetId(preset.id);
        applyPreset(preset.id, presetIntensity);
      }}
      aria-pressed={presetId === preset.id}
      className={cn(
        "flex items-center gap-1.5 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left text-[10px] transition-colors",
        presetId === preset.id
          ? "border-violet-500 bg-violet-600/15 text-violet-200"
          : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
      )}
    >
      <span
        className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-white/20"
        style={{ background: preset.swatch }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{preset.label}</span>
    </button>
  );

  return (
    <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className={panelTitle}>Lumetri Color &amp; Scopes</div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Color Wheels
            </p>
            <button
              type="button"
              onClick={resetColorAdjustments}
              className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-3 justify-items-center gap-1">
            <ColorWheel label="Lift" value={colorWheels.lift} onChange={(v) => setColorWheel("lift", v)} />
            <ColorWheel label="Gamma" value={colorWheels.gamma} onChange={(v) => setColorWheel("gamma", v)} />
            <ColorWheel label="Gain" value={colorWheels.gain} onChange={(v) => setColorWheel("gain", v)} />
          </div>
          <p className="mt-1 text-center text-[9px] text-zinc-600">
            Lift = shadows · Gamma = midtones · Gain = highlights
          </p>
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

        <button
          type="button"
          onClick={resetColorAdjustments}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300 transition-colors hover:border-zinc-600"
        >
          Reset Color Adjustments
        </button>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Cinematic Presets
            </p>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[10px] text-violet-300 transition-colors hover:border-zinc-600"
            >
              {showMore ? "Less" : "More (+15)"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">{quickPresets.map(presetButton)}</div>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              showMore ? "max-h-56 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="custom-scrollbar grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pt-1.5 pr-1">
              {morePresets.map(presetButton)}
            </div>
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
            Luma waveform
          </p>
          <canvas
            ref={scopeRef}
            width={512}
            height={110}
            className="h-24 w-full rounded-lg bg-zinc-950 ring-1 ring-inset ring-zinc-800"
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom: multi-track Premiere timeline                                */
/* ------------------------------------------------------------------ */

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
  const trackStates = useEditorStore((s) => s.trackStates);
  const setTrackFlag = useEditorStore((s) => s.setTrackFlag);
  const selectClip = useEditorStore((s) => s.selectClip);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);
  const scrubTo = useEditorStore((s) => s.scrubTo);
  const markIn = useEditorStore((s) => s.markIn);
  const markOut = useEditorStore((s) => s.markOut);
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
  const addAudioTrackFromBlob = useEditorStore((s) => s.addAudioTrackFromBlob);
  const moveClipTo = useEditorStore((s) => s.moveClipTo);
  const moveOverlayTo = useEditorStore((s) => s.moveOverlayTo);
  const moveAudioTrackTo = useEditorStore((s) => s.moveAudioTrackTo);
  const moveEffectTo = useEditorStore((s) => s.moveEffectTo);
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);
  const splitClip = useEditorStore((s) => s.splitClip);
  const rippleDeleteClip = useEditorStore((s) => s.rippleDeleteClip);

  const [pps, setPps] = useState(48);
  const [transitionClipId, setTransitionClipId] = useState<string | null>(null);
  // Right-click context menu (clip / overlay / effect / audio).
  const [menu, setMenu] = useState<
    | { kind: "clip" | "overlay" | "effect" | "audio"; id: string; x: number; y: number }
    | null
  >(null);

  const nameFor = (assetId: string) =>
    assets.find((a) => a.id === assetId)?.name ?? "Clip";

  // Absolute timeline positions for V1 clips (respects dragged positions).
  const videoBlocks = computeClipStarts(sequence);

  // The preview plays ONE source element at a time, and overlays / effects /
  // audio / `currentTime` are all expressed in that active clip's source time.
  // Map that source time onto the global timeline so the playhead and every
  // other block line up with the V1 clip that is actually playing.
  const activeBlock =
    videoBlocks.find((block) => block.clip.id === activeClipId) ?? null;
  const sourceToTimeline = (time: number) =>
    activeBlock ? activeBlock.start + (time - activeBlock.clip.trimStart) : time;
  const timelineLeft = (time: number) => Math.max(0, sourceToTimeline(time));

  const timelineDuration = Math.max(
    duration || 0,
    ...videoBlocks.map((block) => block.start + block.dur),
    ...overlays.map((overlay) => timelineLeft(overlay.endTime)),
    ...activeEffects.map((effect) => timelineLeft(effect.startTime) + effect.duration),
    ...audioTracks.map((track) => timelineLeft(track.startTime) + track.duration),
    5
  );

  const laneRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  /* ------------------------------------------------------------------ */
  /* Free horizontal position dragging (overlays, audio, effects)         */
  /* ------------------------------------------------------------------ */
  type BodyDragKind = "overlay" | "audio" | "effect";
  const bodyDragState = useRef<{
    kind: BodyDragKind;
    id: string;
    start: number;
  } | null>(null);

  const SNAP_PX = 8;

  /** Snaps a time to the nearest target within a few pixels (magnetic feel). */
  const snapValue = (value: number, targets: number[]) => {
    const threshold = SNAP_PX / pps;
    let best = value;
    let bestDist = threshold;
    for (const target of targets) {
      const dist = Math.abs(target - value);
      if (dist <= bestDist) {
        best = target;
        bestDist = dist;
      }
    }
    return best;
  };

  /** Applies a body-drag pixel delta to the store. */
  const applyBodyDrag = (dx: number) => {
    const active = bodyDragState.current;
    if (!active) return;
    const delta = dx / pps;
    if (active.kind === "overlay") {
      const targets = [0, currentTime];
      for (const overlay of overlays) {
        if (overlay.id === active.id) continue;
        targets.push(overlay.startTime, overlay.endTime);
      }
      moveOverlayTo(active.id, snapValue(Math.max(0, active.start + delta), targets));
    } else if (active.kind === "audio") {
      moveAudioTrackTo(
        active.id,
        snapValue(Math.max(0, active.start + delta), [0, currentTime])
      );
    } else {
      moveEffectTo(
        active.id,
        snapValue(Math.max(0, active.start + delta), [0, currentTime])
      );
    }
  };

  // Pointer-locked, rAF-coalesced drag for overlays / audio / effects. Clips may
  // overlap freely — this never blocks a position.
  const bodyDragHandlers = usePointerDrag({
    threshold: 4,
    onDrag: (info) => applyBodyDrag(info.dx),
    onEnd: (info) => {
      if (info.moved) applyBodyDrag(info.dx);
      bodyDragState.current = null;
    },
  });

  const beginBodyDrag = (
    event: React.PointerEvent<HTMLElement>,
    kind: BodyDragKind,
    id: string,
    start: number
  ) => {
    event.stopPropagation();
    bodyDragState.current = { kind, id, start };
    bodyDragHandlers.onPointerDown(event);
  };

  /* ------------------------------------------------------------------ */
  /* Free V1 clip positioning — pointer-locked, rAF preview, overlaps OK  */
  /* ------------------------------------------------------------------ */
  const [clipPreview, setClipPreview] = useState<{ id: string; start: number } | null>(
    null
  );
  const clipDragState = useRef<{ id: string; baseStart: number; dur: number } | null>(
    null
  );
  const clipDragMovedRef = useRef(false);

  /**
   * Magnetically snaps a dragged clip's leading *or* trailing edge to the
   * playhead, the marks, and every other clip's edges, within `SNAP_PX`.
   */
  const snapClipStart = (rawStart: number, dur: number): number => {
    const targets: number[] = [0, timelineLeft(currentTime)];
    if (markIn !== null) targets.push(timelineLeft(markIn));
    if (markOut !== null) targets.push(timelineLeft(markOut));
    for (const block of videoBlocks) {
      if (block.clip.id === clipDragState.current?.id) continue;
      targets.push(block.start, block.start + block.dur);
    }
    const threshold = SNAP_PX / pps;
    let best = rawStart;
    let bestDist = threshold;
    for (const target of targets) {
      const dStart = Math.abs(target - rawStart);
      if (dStart < bestDist) {
        bestDist = dStart;
        best = target;
      }
      const dEnd = Math.abs(target - (rawStart + dur));
      if (dEnd < bestDist) {
        bestDist = dEnd;
        best = target - dur;
      }
    }
    return clampTimelineStart(best);
  };

  const clipDragHandlers = usePointerDrag({
    threshold: 6,
    onDrag: (info) => {
      const state = clipDragState.current;
      if (!state) return;
      setClipPreview({
        id: state.id,
        start: snapClipStart(state.baseStart + info.dx / pps, state.dur),
      });
    },
    onEnd: (info) => {
      const state = clipDragState.current;
      clipDragState.current = null;
      setClipPreview(null);
      if (!state || !info.moved) {
        clipDragMovedRef.current = false;
        return;
      }
      clipDragMovedRef.current = true;
      // Commit the exact previewed position (scroll/zoom aware → no snap-back).
      moveClipTo(state.id, snapClipStart(state.baseStart + info.dx / pps, state.dur));
    },
  });

  const beginClipDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    clipId: string,
    baseStart: number,
    dur: number
  ) => {
    event.stopPropagation();
    if (trackStates.V1.locked) return;
    clipDragMovedRef.current = false;
    clipDragState.current = { id: clipId, baseStart, dur };
    clipDragHandlers.onPointerDown(event);
  };

  // Audio in/out trims (Update trimStart + duration).
  const audioTrimRef = useRef<{
    id: string;
    side: "in" | "out";
    startX: number;
    trimStart: number;
    duration: number;
  } | null>(null);
  const onAudioTrimDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    track: { id: string; trimStart: number; duration: number },
    side: "in" | "out"
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    audioTrimRef.current = {
      id: track.id,
      side,
      startX: event.clientX,
      trimStart: track.trimStart,
      duration: track.duration,
    };
  };
  const onAudioTrimMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = audioTrimRef.current;
    if (!drag) return;
    const delta = (event.clientX - drag.startX) / pps;
    if (drag.side === "in") {
      const nextTrim = Math.max(0, drag.trimStart + delta);
      updateAudioTrack(drag.id, {
        trimStart: nextTrim,
        duration: Math.max(0.1, drag.duration - (nextTrim - drag.trimStart)),
      });
    } else {
      updateAudioTrack(drag.id, { duration: Math.max(0.1, drag.duration + delta) });
    }
  };
  const onAudioTrimUp = () => {
    audioTrimRef.current = null;
  };

  const seekFromClientX = (clientX: number) => {
    const lane = laneRef.current;
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const time = (clientX - rect.left) / pps;
    const clamped = Math.min(Math.max(time, 0), timelineDuration);
    // Map the global timeline position to the clip + source time underneath it,
    // so scrubbing across clip boundaries loads the right frame (not just the
    // active clip's clamped end).
    const target =
      videoBlocks.find((block) => clamped < block.start + block.dur) ??
      videoBlocks[videoBlocks.length - 1];
    if (!target) return;
    const local = Math.min(Math.max(clamped - target.start, 0), target.dur);
    scrubTo(target.clip.id, target.clip.trimStart + local);
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

  // Zooming keeps the time under the viewport centre pinned (no viewport jump).
  const pendingZoomCentre = useRef<number | null>(null);
  useEffect(() => {
    const centreTime = pendingZoomCentre.current;
    pendingZoomCentre.current = null;
    const scroller = scrollRef.current;
    if (centreTime === null || !scroller) return;
    const centre = scroller.clientWidth / 2;
    scroller.scrollLeft = Math.max(0, centreTime * pps - centre);
  }, [pps]);

  const zoomTo = (next: number) => {
    const clamped = Math.min(200, Math.max(12, Math.round(next)));
    if (clamped === pps) return;
    const scroller = scrollRef.current;
    if (scroller && scroller.clientWidth > 0) {
      pendingZoomCentre.current = (scroller.scrollLeft + scroller.clientWidth / 2) / pps;
    }
    setPps(clamped);
  };

  const audioByLane = (lane: number) =>
    audioTracks.filter((track, index) => trackLane(track, index) === lane);

  /* ------------------------------------------------------------------ */
  /* Live voiceover recording (A2)                                       */
  /* ------------------------------------------------------------------ */
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

  useEffect(() => () => voiceRef.current?.capture.cancel(), []);

  const videoChip = "rounded-md bg-gradient-to-b from-violet-500/80 to-blue-600/70 text-[10px] text-white ring-1 ring-inset ring-white/20";
  const adjustChip = "rounded-md bg-gradient-to-b from-pink-500/80 to-fuchsia-600/70 text-[10px] text-white ring-1 ring-inset ring-white/20";
  const audioChip = "rounded-md bg-gradient-to-b from-teal-500/80 to-emerald-600/70 text-[10px] text-white ring-1 ring-inset ring-white/20";

  /** Opens the timeline context menu at the pointer. */
  const openMenu = (
    event: React.MouseEvent,
    kind: "clip" | "overlay" | "effect" | "audio",
    id: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ kind, id, x: event.clientX, y: event.clientY });
  };

  // Dismiss the context menu on any outside click / Escape / scroll.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  const TrackHeader = ({ keyName }: { keyName: TrackKey }) => {
    const t = trackStates[keyName];
    const dimmed = isLaneDimmed(keyName, trackStates);
    const btn =
      "flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold transition-colors";
    const toggle = (field: TrackField) => setTrackFlag(keyName, field);
    return (
      <div
        className={cn(
          "relative flex h-12 w-24 shrink-0 items-center gap-1 border-b border-r border-zinc-800 bg-zinc-900/60 px-1.5",
          dimmed && "opacity-55",
          t.locked && "bg-amber-500/5 ring-1 ring-inset ring-amber-500/30"
        )}
      >
        <span className="mr-0.5 w-6 shrink-0 text-[10px] font-semibold text-zinc-300">{keyName}</span>
        <button type="button" aria-label={`Mute ${keyName}`} aria-pressed={t.muted} onClick={() => toggle("muted")} className={cn(btn, t.muted ? "bg-amber-500/30 text-amber-300" : "text-zinc-500 hover:text-zinc-200")}>M</button>
        <button type="button" aria-label={`Solo ${keyName}`} aria-pressed={t.solo} onClick={() => toggle("solo")} className={cn(btn, t.solo ? "bg-sky-500/30 text-sky-300" : "text-zinc-500 hover:text-zinc-200")}>S</button>
        <button
          type="button"
          aria-label={`${t.locked ? "Unlock" : "Lock"} ${keyName}`}
          aria-pressed={t.locked}
          title={t.locked ? "Track locked — edits blocked" : "Lock track"}
          onClick={() => toggle("locked")}
          className={cn(btn, t.locked ? "bg-amber-500/30 text-amber-300" : "text-zinc-500 hover:text-zinc-200")}
        >
          {t.locked ? <Lock className="h-3 w-3" aria-hidden /> : <Unlock className="h-3 w-3" aria-hidden />}
        </button>
        {keyName === "A2" ? (
          <button
            type="button"
            aria-label={voiceRecording ? "Stop voiceover" : "Record voiceover"}
            title="Record voiceover (microphone)"
            onClick={() => void toggleVoiceover()}
            className={cn(btn, voiceRecording ? "bg-red-500/30 text-red-300" : "text-zinc-500 hover:text-zinc-200")}
          >
            {voiceRecording ? <Square className="h-3 w-3" aria-hidden /> : <Mic className="h-3 w-3" aria-hidden />}
          </button>
        ) : (
          <button
            type="button"
            aria-label={`${t.isVisible ? "Hide" : "Show"} ${keyName}`}
            aria-pressed={!t.isVisible}
            title={t.isVisible ? "Hide this lane (skip in preview + export)" : "Show this lane"}
            onClick={() => toggle("isVisible")}
            className={cn(btn, t.isVisible ? "text-zinc-500 hover:text-zinc-200" : "bg-zinc-500/20 text-amber-300")}
          >
            {t.isVisible ? <Eye className="h-3 w-3" aria-hidden /> : <EyeOff className="h-3 w-3" aria-hidden />}
          </button>
        )}
        {keyName === "A2" && voiceRecording && (
          <span className="absolute inset-x-1.5 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-zinc-700">
            <span className="block h-full bg-red-400" style={{ width: `${Math.round(voiceLevel * 100)}%` }} />
          </span>
        )}
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

        {/* Razor + ripple delete */}
        <div className="ml-2 flex items-center gap-1.5">
          <button
            type="button"
            title="Split at playhead (S)"
            aria-label="Split clip at playhead"
            disabled={trackStates.V1.locked}
            onClick={() => {
              if (activeClipId) splitClip(activeClipId, currentTime);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Scissors className="h-3.5 w-3.5" aria-hidden /> Split
          </button>
          <button
            type="button"
            title="Ripple delete the selected clip (Shift+Delete)"
            aria-label="Ripple delete clip"
            disabled={trackStates.V1.locked || !activeClipId}
            onClick={() => {
              if (activeClipId) rippleDeleteClip(activeClipId);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Ripple Del
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" aria-label="Zoom out" onClick={() => zoomTo(pps - 12)} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 text-zinc-300 hover:border-zinc-600">
            <ZoomOut className="h-3.5 w-3.5" aria-hidden />
          </button>
          <input type="range" min={12} max={200} step={4} value={pps} onChange={(e) => zoomTo(Number(e.target.value))} aria-label="Timeline zoom" className="w-28 accent-violet-500" />
          <button type="button" aria-label="Zoom in" onClick={() => zoomTo(pps + 12)} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 text-zinc-300 hover:border-zinc-600">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Track headers column */}
        <div className="flex shrink-0 flex-col">
          <div className="h-6 w-24 border-b border-r border-zinc-800 bg-zinc-900/60" />
          {TRACK_KEYS.map((keyName) => (
            <TrackHeader key={keyName} keyName={keyName} />
          ))}
        </div>

        {/* Ruler + lanes */}
        <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
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

              {/* Mark In / Mark Out brackets */}
              {markIn !== null && markOut !== null && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 bg-sky-400/10"
                  style={{
                    left: `${timelineLeft(markIn) * pps}px`,
                    width: `${Math.max(0, (timelineLeft(markOut) - timelineLeft(markIn)) * pps)}px`,
                  }}
                />
              )}
              {markIn !== null && (
                <span
                  title={`Mark In · ${markIn.toFixed(2)}s`}
                  className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-sky-400"
                  style={{ left: `${timelineLeft(markIn) * pps}px` }}
                >
                  <span className="absolute left-0 top-0 h-2 w-2 rounded-br-sm bg-sky-400" />
                </span>
              )}
              {markOut !== null && (
                <span
                  title={`Mark Out · ${markOut.toFixed(2)}s`}
                  className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-sky-400"
                  style={{ left: `${timelineLeft(markOut) * pps}px` }}
                >
                  <span className="absolute right-0 top-0 h-2 w-2 rounded-bl-sm bg-sky-400" />
                </span>
              )}
            </div>

            {/* V3 — adjustment / effect layers (pink) */}
            <div className={cn("relative h-12 border-b border-zinc-800 bg-zinc-950/40", isLaneDimmed("V3", trackStates) && "opacity-40")}>
              {activeEffects.map((fx) => (
                <div
                  key={fx.id}
                  className={cn("group absolute inset-y-1.5 cursor-grab overflow-hidden px-1.5 active:cursor-grabbing", adjustChip, trackStates.V3.locked && "cursor-not-allowed")}
                  style={{ left: `${timelineLeft(fx.startTime) * pps}px`, width: `${Math.max(20, fx.duration * pps)}px` }}
                  title={`Effect: ${fx.type}`}
                  onContextMenu={(e) => openMenu(e, "effect", fx.id)}
                  onPointerDown={(e) => {
                    if (trackStates.V3.locked) {
                      e.stopPropagation();
                      return;
                    }
                    beginBodyDrag(e, "effect", fx.id, fx.startTime);
                  }}
                  onPointerMove={bodyDragHandlers.onPointerMove}
                  onPointerUp={bodyDragHandlers.onPointerUp}
                  onPointerCancel={bodyDragHandlers.onPointerCancel}
                >
                  <span className="block truncate capitalize">{fx.type}</span>
                  {!trackStates.V3.locked && (
                    <>
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
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => removeEffect(fx.id)}
                        className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-black/75 text-zinc-100 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* V2 — text / overlay layers (pink) */}
            <div className={cn("relative h-12 border-b border-zinc-800 bg-zinc-950/40", isLaneDimmed("V2", trackStates) && "opacity-40")}>
              {overlays.map((o) => (
                <div
                  key={o.id}
                  className="group absolute inset-y-1.5"
                  style={{ left: `${timelineLeft(o.startTime) * pps}px`, width: `${Math.max(24, (o.endTime - o.startTime) * pps)}px` }}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      if (trackStates.V2.locked) {
                        e.stopPropagation();
                        return;
                      }
                      beginBodyDrag(e, "overlay", o.id, o.startTime);
                    }}
                    onPointerMove={bodyDragHandlers.onPointerMove}
                    onPointerUp={bodyDragHandlers.onPointerUp}
                    onPointerCancel={bodyDragHandlers.onPointerCancel}
                    onContextMenu={(e) => openMenu(e, "overlay", o.id)}
                    onClick={() => selectOverlay(o.id)}
                    className={cn("h-full w-full cursor-grab overflow-hidden px-1.5 text-left active:cursor-grabbing", adjustChip, o.id === selectedId && "ring-2 ring-white/70", trackStates.V2.locked && "cursor-not-allowed")}
                  >
                    <span className="block truncate">
                      {o.text || (o.imageSrc ? "Image" : "Text")}
                    </span>
                  </button>
                  {!trackStates.V2.locked && (
                    <>
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
                    </>
                  )}
                  {(o.keyframes ?? []).map((frame) => (
                    <span
                      key={frame.id}
                      title={`Keyframe @ ${frame.time.toFixed(2)}s`}
                      className="pointer-events-none absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-amber-300 ring-1 ring-black/50"
                      style={{ left: `${Math.max(0, (frame.time - o.startTime) * pps)}px` }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* V1 — video clips (purple/blue) with trim handles */}
            <div className={cn("relative h-12 border-b border-zinc-800 bg-zinc-950/40", isLaneDimmed("V1", trackStates) && "opacity-40")}>
              {videoBlocks.map(({ clip, start, dur }) => {
                const dragging = clipPreview?.id === clip.id;
                const displayStart = dragging && clipPreview ? clipPreview.start : start;
                return (
                <div
                  key={clip.id}
                  className={cn("group absolute inset-y-1.5", dragging && "z-30")}
                  style={{
                    left: `${displayStart * pps}px`,
                    width: `${Math.max(28, dur * pps)}px`,
                  }}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => beginClipDrag(e, clip.id, start, dur)}
                    onPointerMove={clipDragHandlers.onPointerMove}
                    onPointerUp={clipDragHandlers.onPointerUp}
                    onPointerCancel={clipDragHandlers.onPointerCancel}
                    onContextMenu={(e) => openMenu(e, "clip", clip.id)}
                    onClick={() => {
                      // A real drag shouldn't also "select" (which reloads the clip).
                      if (clipDragMovedRef.current) {
                        clipDragMovedRef.current = false;
                        return;
                      }
                      selectClip(clip.id);
                    }}
                    className={cn(
                      "h-full w-full cursor-grab overflow-hidden px-2 text-left active:cursor-grabbing",
                      videoChip,
                      clip.id === activeClipId && "ring-2 ring-white/70",
                      dragging && "shadow-xl ring-2 ring-white",
                      trackStates.V1.locked && "cursor-not-allowed"
                    )}
                  >
                    <span className="block truncate">{nameFor(clip.assetId)}</span>
                  </button>
                  {!trackStates.V1.locked && (
                    <>
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
                    </>
                  )}
                  {clip.transitionIn && (
                    <span
                      title={`Transition: ${clip.transitionIn.type}`}
                      className="pointer-events-none absolute -left-2 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm bg-amber-400 text-black shadow"
                    >
                      <ArrowLeftRight className="h-2.5 w-2.5" aria-hidden />
                    </span>
                  )}
                </div>
                );
              })}

              {/* Transition junctions between touching / overlapping clips */}
              {videoBlocks.slice(0, -1).map((block, index) => {
                const next = videoBlocks[index + 1];
                const boundary = block.start + block.dur;
                if (next.start > boundary + 0.08) return null;
                const applied = next.clip.transitionIn;
                return (
                  <button
                    key={`junction-${next.clip.id}`}
                    type="button"
                    title={applied ? `Transition: ${applied.type}` : "Add transition"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransitionClipId(next.clip.id);
                    }}
                    style={{ left: `${boundary * pps}px` }}
                    className={cn(
                      "absolute top-1/2 z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-110",
                      applied
                        ? "border-amber-300 bg-amber-400 text-black"
                        : "border-white/50 bg-white/85 text-zinc-900"
                    )}
                  >
                    <ArrowLeftRight className="h-3 w-3" aria-hidden />
                  </button>
                );
              })}
            </div>

            {/* A1 / A2 / A3 — audio tracks (teal/green) with real waveforms */}
            {AUDIO_TRACK_KEYS.map((keyName, lane) => {
              const laneState = trackStates[keyName];
              const soloActive = audioTracks.some(
                (track, index) => trackLane(track, index) === lane && track.solo
              );
              return (
                <div
                  key={keyName}
                  className={cn(
                    "relative h-12 border-b border-zinc-800 bg-zinc-950/40",
                    isLaneDimmed(keyName, trackStates) && "opacity-40",
                    laneState.locked && "ring-1 ring-inset ring-amber-500/20"
                  )}
                >
                  {audioByLane(lane).map((track) => {
                    const sourceDuration =
                      track.buffer?.duration ?? track.duration ?? 0;
                    const startFraction =
                      sourceDuration > 0 ? track.trimStart / sourceDuration : 0;
                    const endFraction =
                      sourceDuration > 0
                        ? Math.min(1, (track.trimStart + track.duration) / sourceDuration)
                        : 1;
                    const silenced = track.muted || laneState.muted;
                    const locked = laneState.locked;
                    return (
                      <div
                        key={track.id}
                        className={cn(
                          "group absolute inset-y-1.5 flex cursor-grab items-center gap-1 overflow-hidden px-1.5 active:cursor-grabbing",
                          audioChip,
                          silenced && "opacity-50 saturate-50",
                          locked && "cursor-not-allowed"
                        )}
                        style={{ left: `${timelineLeft(track.startTime) * pps}px`, width: `${Math.max(28, track.duration * pps)}px` }}
                        title={`${track.name}${silenced ? " (muted)" : ""}`}
                        onContextMenu={(e) => openMenu(e, "audio", track.id)}
                        onPointerDown={(e) => {
                          if (locked) {
                            e.stopPropagation();
                            return;
                          }
                          beginBodyDrag(e, "audio", track.id, track.startTime);
                        }}
                        onPointerMove={bodyDragHandlers.onPointerMove}
                        onPointerUp={bodyDragHandlers.onPointerUp}
                        onPointerCancel={bodyDragHandlers.onPointerCancel}
                      >
                        <TimelineWaveform
                          peaks={track.peaks}
                          sliceStart={startFraction}
                          sliceEnd={endFraction}
                          className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
                        />
                        <span className="relative z-10 flex min-w-0 items-center gap-1">
                          <Music className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">{track.name}</span>
                        </span>
                        {!locked && (
                          <>
                            <button
                              type="button"
                              aria-label="Trim audio start"
                              onPointerDown={(e) => onAudioTrimDown(e, track, "in")}
                              onPointerMove={onAudioTrimMove}
                              onPointerUp={onAudioTrimUp}
                              onPointerCancel={onAudioTrimUp}
                              className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize rounded-l-md bg-white/25 transition-colors hover:bg-white/60"
                            />
                            <button
                              type="button"
                              aria-label="Trim audio end"
                              onPointerDown={(e) => onAudioTrimDown(e, track, "out")}
                              onPointerMove={onAudioTrimMove}
                              onPointerUp={onAudioTrimUp}
                              onPointerCancel={onAudioTrimUp}
                              className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-ew-resize rounded-r-md bg-white/25 transition-colors hover:bg-white/60"
                            />
                            <button
                              type="button"
                              aria-label="Remove audio"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => removeAudioTrack(track.id)}
                              className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-black/75 text-zinc-100 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {soloActive && (
                    <span className="pointer-events-none absolute inset-0 bg-sky-400/5" />
                  )}
                </div>
              );
            })}

            {/* Playhead */}
            <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-fuchsia-400" style={{ left: `${timelineLeft(currentTime) * pps}px` }}>
              <span className="absolute -top-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-sm bg-fuchsia-400" />
            </div>
          </div>
        </div>
      </div>

      {menu &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed z-50 min-w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/95 py-1 text-[11px] text-zinc-200 shadow-2xl backdrop-blur"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menu.kind === "clip" &&
            (() => {
              const block = videoBlocks.find((item) => item.clip.id === menu.id);
              const playhead = timelineLeft(currentTime);
              const canSplit =
                Boolean(block) &&
                block !== undefined &&
                playhead > block.start + 0.05 &&
                playhead < block.start + block.dur - 0.05;
              return (
                <>
                  <button
                    type="button"
                    disabled={!canSplit || trackStates.V1.locked}
                    onClick={() => {
                      if (!block) return;
                      splitClip(
                        menu.id,
                        block.clip.trimStart + (playhead - block.start)
                      );
                      setMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-violet-600/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Scissors className="h-3.5 w-3.5" aria-hidden /> Split at playhead
                  </button>
                  <button
                    type="button"
                    disabled={trackStates.V1.locked}
                    onClick={() => {
                      rippleDeleteClip(menu.id);
                      setMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-violet-600/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Ripple delete
                  </button>
                  <button
                    type="button"
                    disabled={trackStates.V1.locked}
                    onClick={() => {
                      removeClip(menu.id);
                      setMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete clip
                  </button>
                </>
              );
            })()}
          {menu.kind === "overlay" && (
            <button
              type="button"
              disabled={trackStates.V2.locked}
              onClick={() => {
                removeOverlay(menu.id);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete overlay
            </button>
          )}
          {menu.kind === "effect" && (
            <button
              type="button"
              disabled={trackStates.V3.locked}
              onClick={() => {
                removeEffect(menu.id);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete effect
            </button>
          )}
          {menu.kind === "audio" && (
            <button
              type="button"
              onClick={() => {
                removeAudioTrack(menu.id);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-red-600/20"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete audio
            </button>
          )}
        </div>,
        document.body
      )}

      <TransitionModal
        key={transitionClipId ?? "none"}
        clipId={transitionClipId}
        onClose={() => setTransitionClipId(null)}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function DesktopEditor({
  onBatchExport,
}: {
  onBatchExport?: (clipIds: string[]) => void;
}) {
  // Desktop-only keyboard shortcuts: undo/redo, play/pause, frame step, marks.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
      const state = useEditorStore.getState();
      const key = event.key;
      const lower = key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (lower === "z" && !event.shiftKey) {
          event.preventDefault();
          state.undo();
        } else if (lower === "y" || (lower === "z" && event.shiftKey)) {
          event.preventDefault();
          state.redo();
        }
        return;
      }

      if (key === " ") {
        event.preventDefault();
        if (state.videoEl) state.setPlaying(!state.playing);
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        state.stepFrame(-1);
      } else if (key === "ArrowRight") {
        event.preventDefault();
        state.stepFrame(1);
      } else if (lower === "i") {
        event.preventDefault();
        state.setMarkIn(state.currentTime);
      } else if (lower === "o") {
        event.preventDefault();
        state.setMarkOut(state.currentTime);
      } else if (lower === "s" && !event.shiftKey) {
        // Razor: split the active clip at the playhead.
        event.preventDefault();
        state.splitActiveClip();
      } else if (event.key === "Delete" && event.shiftKey) {
        // Shift+Delete: ripple delete the active clip.
        event.preventDefault();
        if (state.activeClipId) state.rippleDeleteClip(state.activeClipId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid min-h-0 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[320px_minmax(0,1fr)_340px]" style={{ height: "min(58vh, 600px)", minHeight: 380 }}>
        <ProjectBinPanel onBatchExport={onBatchExport} />
        <ProgramPreview />
        <LumetriPanel />
      </div>
      <PremiereTimeline />
    </div>
  );
}
