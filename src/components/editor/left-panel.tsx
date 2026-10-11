"use client";

import { useRef, useState } from "react";
import {
  Aperture,
  Coins,
  Film,
  LoaderCircle,
  Music,
  Plus,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  Vibrate,
  Volume2,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useEditorStore,
  type AspectRatio,
  type VideoEffectType,
} from "@/store/editor";
import { useWorkspaceStore } from "@/store/workspace";
import { CAPTIONS_CREDIT_COST } from "@/lib/credits";
import { CAPTION_LANGUAGES, type CaptionLanguageId } from "@/lib/transcribe";
import { ASPECT_RESOLUTIONS } from "@/lib/render";
import { cn } from "@/lib/utils";

const sectionTitle =
  "text-[11px] font-semibold uppercase tracking-wider text-zinc-500";
const miniField =
  "mt-0.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[11px] tabular-nums text-zinc-100 focus:border-violet-500 focus:outline-none";

const EFFECT_CARDS: {
  type: VideoEffectType;
  label: string;
  hint: string;
  Icon: typeof ZoomIn;
}[] = [
  { type: "zoom-in", label: "Zoom In", hint: "Punch in", Icon: ZoomIn },
  { type: "zoom-out", label: "Zoom Out", hint: "Pull back", Icon: ZoomOut },
  { type: "camera-shake", label: "Camera Shake", hint: "X/Y jitter", Icon: Vibrate },
  { type: "flash", label: "Flash", hint: "White blip", Icon: Zap },
  { type: "blur-vignette", label: "Blur Vignette", hint: "Soft edges", Icon: Aperture },
];

const EFFECT_LABELS: Record<VideoEffectType, string> = {
  "zoom-in": "Zoom In",
  "zoom-out": "Zoom Out",
  "camera-shake": "Camera Shake",
  flash: "Flash",
  "blur-vignette": "Blur Vignette",
};

const ASPECT_OPTIONS: { id: AspectRatio; label: string; hint: string }[] = [
  { id: "9:16", label: "9:16", hint: "Vertical Shorts" },
  { id: "16:9", label: "16:9", hint: "Horizontal" },
  { id: "1:1", label: "1:1", hint: "Square" },
];

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
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
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-violet-500"
      />
    </label>
  );
}

type LeftPanelProps = {
  /** Called when a credit-gated action is blocked (opens the referral modal). */
  onRequireCredits?: () => void;
};

export function LeftPanel({ onRequireCredits }: LeftPanelProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [audioDragActive, setAudioDragActive] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);

  const videoName = useEditorStore((state) => state.videoName);
  const videoError = useEditorStore((state) => state.videoError);
  const addVideoAssets = useEditorStore((state) => state.addVideoAssets);
  const captionLanguage = useEditorStore((state) => state.captionLanguage);
  const setCaptionLanguage = useEditorStore(
    (state) => state.setCaptionLanguage
  );

  const aspect = useEditorStore((state) => state.aspect);
  const setAspect = useEditorStore((state) => state.setAspect);
  const fit = useEditorStore((state) => state.fit);
  const setFit = useEditorStore((state) => state.setFit);
  const offsetX = useEditorStore((state) => state.offsetX);
  const offsetY = useEditorStore((state) => state.offsetY);
  const setOffset = useEditorStore((state) => state.setOffset);

  const overlays = useEditorStore((state) => state.overlays);
  const selectedId = useEditorStore((state) => state.selectedId);
  const addOverlay = useEditorStore((state) => state.addOverlay);
  const selectOverlay = useEditorStore((state) => state.selectOverlay);
  const removeOverlay = useEditorStore((state) => state.removeOverlay);

  const hasVideo = useEditorStore((state) => state.videoEl !== null);
  const generateAutoCaptions = useEditorStore((state) => state.generateAutoCaptions);
  const clearAutoCaptions = useEditorStore((state) => state.clearAutoCaptions);
  const transcribing = useEditorStore((state) => state.transcribing);
  const transcribingProgress = useEditorStore((state) => state.transcribingProgress);
  const transcribingStatus = useEditorStore((state) => state.transcribingStatus);
  const transcriptionError = useEditorStore((state) => state.transcriptionError);
  const autoCaptionCount = useEditorStore(
    (state) => state.overlays.filter((overlay) => overlay.auto).length
  );

  const audioTracks = useEditorStore((state) => state.audioTracks);
  const audioTrackError = useEditorStore((state) => state.audioTrackError);
  const addAudioFiles = useEditorStore((state) => state.addAudioFiles);
  const updateAudioTrack = useEditorStore((state) => state.updateAudioTrack);
  const removeAudioTrack = useEditorStore((state) => state.removeAudioTrack);

  const consumeCredits = useWorkspaceStore((state) => state.consumeCredits);

  const [tab, setTab] = useState<"edit" | "effects">("edit");
  const currentTime = useEditorStore((state) => state.currentTime);
  const activeEffects = useEditorStore((state) => state.activeEffects);
  const addEffect = useEditorStore((state) => state.addEffect);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const removeEffect = useEditorStore((state) => state.removeEffect);
  const clearEffects = useEditorStore((state) => state.clearEffects);

  function handleFileList(files: FileList | null) {
    if (files && files.length > 0) void addVideoAssets(files);
  }

  function handleAudioList(files: FileList | null) {
    if (files && files.length > 0) void addAudioFiles(files);
  }

  /** Charges the AI-caption cost, then starts on-device transcription. */
  async function handleAutoCaptions() {
    if (transcribing) return;
    setCaptionError(null);
    const result = await consumeCredits(CAPTIONS_CREDIT_COST);
    if (!result.ok) {
      if (result.reason === "insufficient") {
        onRequireCredits?.();
      } else {
        setCaptionError(
          result.error ?? "Could not verify your credits. Please try again."
        );
      }
      return;
    }
    void generateAutoCaptions();
  }

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      {/* Left-panel tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950/60 p-1 ring-1 ring-inset ring-zinc-800">
        <button
          type="button"
          onClick={() => setTab("edit")}
          aria-pressed={tab === "edit"}
          className={cn(
            "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
            tab === "edit"
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setTab("effects")}
          aria-pressed={tab === "effects"}
          className={cn(
            "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
            tab === "effects"
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Effects
        </button>
      </div>

      {tab === "edit" && (
        <>
      {/* Video import */}
      <section className="space-y-2">
        <h2 className={sectionTitle}>Video Source</h2>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            handleFileList(event.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500",
            dragActive
              ? "border-violet-500 bg-violet-500/10"
              : "border-zinc-700 hover:border-zinc-500"
          )}
        >
          <UploadCloud className="h-6 w-6 text-violet-400" aria-hidden />
          <span className="text-xs font-medium text-zinc-300">
            Drag &amp; drop your video
          </span>
          <span className="text-[11px] text-zinc-500">
            MP4 or WebM · multiple clips allowed
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFileList(event.target.files);
            event.target.value = "";
          }}
        />
        {videoName && (
          <p className="flex items-center gap-1.5 truncate text-xs text-zinc-400">
            <Film className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
            <span className="truncate">{videoName}</span>
          </p>
        )}
        {videoError && (
          <p role="alert" className="text-xs text-red-400">
            {videoError}
          </p>
        )}
      </section>

      {/* Aspect ratio */}
      <section className="space-y-2">
        <h2 className={sectionTitle}>Aspect Ratio</h2>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_OPTIONS.map((option) => {
            const resolution = ASPECT_RESOLUTIONS[option.id];
            const active = aspect === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAspect(option.id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-colors",
                  active
                    ? "border-violet-500 bg-violet-500/15 text-violet-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
                )}
              >
                <span className="text-xs font-semibold">{option.label}</span>
                <span className="text-[10px] text-zinc-500">{option.hint}</span>
                <span className="text-[10px] tabular-nums text-zinc-600">
                  {resolution.width}×{resolution.height}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Framing: fit / crop / pan */}
      <section className="space-y-2">
        <h2 className={sectionTitle}>Framing</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFit("contain")}
            aria-pressed={fit === "contain"}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              fit === "contain"
                ? "border-violet-500 bg-violet-500/15 text-violet-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
            )}
          >
            Fit to Canvas
          </button>
          <button
            type="button"
            onClick={() => setFit("cover")}
            aria-pressed={fit === "cover"}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              fit === "cover"
                ? "border-violet-500 bg-violet-500/15 text-violet-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600"
            )}
          >
            Fill &amp; Crop
          </button>
        </div>

        <SliderRow
          label="Position X"
          value={offsetX}
          min={-100}
          max={100}
          disabled={fit !== "cover"}
          onChange={(value) => setOffset(value, offsetY)}
        />
        <SliderRow
          label="Position Y"
          value={offsetY}
          min={-100}
          max={100}
          disabled={fit !== "cover"}
          onChange={(value) => setOffset(offsetX, value)}
        />
        {fit !== "cover" && (
          <p className="text-[11px] leading-4 text-zinc-500">
            Choose Fill &amp; Crop to unlock the X/Y position sliders.
          </p>
        )}
      </section>

      {/* Text overlays */}
      <section className="space-y-2">
        <h2 className={sectionTitle}>Text &amp; Captions</h2>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-400">
            Spoken language
          </span>
          <select
            value={captionLanguage}
            onChange={(event) =>
              setCaptionLanguage(event.target.value as CaptionLanguageId)
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
          >
            {CAPTION_LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] leading-4 text-zinc-500">
            Auto-detect works for most languages; pick one for the best accuracy.
          </span>
        </label>

        {/* AI auto captions */}
        <button
          type="button"
          onClick={() => void handleAutoCaptions()}
          disabled={!hasVideo || transcribing}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {transcribing ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          )}
          {transcribing ? "Transcribing…" : "Auto-Generate AI Captions"}
          {!transcribing && (
            <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-medium">
              <Coins className="h-3 w-3" aria-hidden />
              {CAPTIONS_CREDIT_COST}
            </span>
          )}
        </button>

        {transcribing && (
          <div aria-live="polite" className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="truncate">{transcribingStatus || "Working…"}</span>
              <span className="tabular-nums text-zinc-500">
                {transcribingProgress}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-200"
                style={{ width: `${Math.max(2, transcribingProgress)}%` }}
              />
            </div>
            <p className="text-[11px] leading-4 text-zinc-500">
              Runs fully in your browser — the model downloads once, then speaking
              is transcribed on-device.
            </p>
          </div>
        )}

        {transcriptionError && (
          <p role="alert" className="text-xs leading-4 text-red-400">
            {transcriptionError}
          </p>
        )}

        {captionError && (
          <p role="alert" className="text-xs leading-4 text-red-400">
            {captionError}
          </p>
        )}

        {autoCaptionCount > 0 && !transcribing && (
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
            <span className="text-[11px] text-zinc-400">
              {autoCaptionCount} AI caption{autoCaptionCount === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={clearAutoCaptions}
              className="text-[11px] text-zinc-500 transition-colors hover:text-red-400"
            >
              Clear
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={addOverlay}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add Text Overlay
        </button>

        <div className="space-y-1.5">
          {overlays.length === 0 && (
            <p className="text-[11px] leading-4 text-zinc-500">
              No captions yet — add one, then style it in the right panel.
            </p>
          )}
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2 py-1.5",
                selectedId === overlay.id
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-zinc-800 bg-zinc-950/60"
              )}
            >
              <button
                type="button"
                onClick={() => selectOverlay(overlay.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <Type className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                <span className="truncate text-xs text-zinc-300">
                  {overlay.text || "Untitled caption"}
                </span>
                {overlay.auto && (
                  <span className="ml-auto shrink-0 rounded bg-violet-500/15 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-300">
                    AI
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => removeOverlay(overlay.id)}
                aria-label={`Delete caption: ${overlay.text || "untitled"}`}
                className="rounded p-1 text-zinc-500 transition-colors hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* External audio & SFX (multi-track) */}
      <section className="space-y-2">
        <h2 className={sectionTitle}>Audio Tracks &amp; SFX</h2>

        <div
          role="button"
          tabIndex={0}
          onClick={() => audioInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              audioInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setAudioDragActive(true);
          }}
          onDragLeave={() => setAudioDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setAudioDragActive(false);
            handleAudioList(event.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-4 text-center transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500",
            audioDragActive
              ? "border-violet-500 bg-violet-500/10"
              : "border-zinc-700 hover:border-zinc-500"
          )}
        >
          <Music className="h-5 w-5 text-violet-400" aria-hidden />
          <span className="text-xs font-medium text-zinc-300">
            Add audio track
          </span>
          <span className="text-[11px] text-zinc-500">
            MP3 or WAV · multiple allowed
          </span>
        </div>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp3,audio/*,.mp3,.wav"
          multiple
          className="hidden"
          onChange={(event) => {
            handleAudioList(event.target.files);
            event.target.value = "";
          }}
        />

        {audioTrackError && (
          <p role="alert" className="text-xs text-red-400">
            {audioTrackError}
          </p>
        )}

        {audioTracks.length === 0 ? (
          <p className="text-[11px] leading-4 text-zinc-500">
            Layer music or sound effects over the video. Everything is mixed
            into the exported MP4.
          </p>
        ) : (
          audioTracks.map((track) => (
            <div
              key={track.id}
              className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
            >
              <div className="flex items-center gap-1.5">
                <Volume2
                  className="h-3.5 w-3.5 shrink-0 text-violet-400"
                  aria-hidden
                />
                <span
                  className="min-w-0 flex-1 truncate text-xs text-zinc-300"
                  title={track.name}
                >
                  {track.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeAudioTrack(track.id)}
                  aria-label={`Remove audio: ${track.name}`}
                  className="rounded p-1 text-zinc-500 transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <label className="block">
                <span className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Volume</span>
                  <span className="tabular-nums">
                    {Math.round(track.volume * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onChange={(event) =>
                    updateAudioTrack(track.id, {
                      volume: Number(event.target.value),
                    })
                  }
                  className="mt-0.5 w-full accent-violet-500"
                />
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                <label className="block">
                  <span className="text-[10px] text-zinc-500">Start (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={Number(track.startTime.toFixed(1))}
                    onChange={(event) =>
                      updateAudioTrack(track.id, {
                        startTime: Number(event.target.value),
                      })
                    }
                    className={miniField}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-zinc-500">Trim (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={Number(track.trimStart.toFixed(1))}
                    onChange={(event) =>
                      updateAudioTrack(track.id, {
                        trimStart: Number(event.target.value),
                      })
                    }
                    className={miniField}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-zinc-500">Dur (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={Number(track.duration.toFixed(1))}
                    onChange={(event) =>
                      updateAudioTrack(track.id, {
                        duration: Number(event.target.value),
                      })
                    }
                    className={miniField}
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </section>
        </>
      )}

      {tab === "effects" && (
        <>
          <section className="space-y-2">
            <h2 className={sectionTitle}>Effects Gallery</h2>
            <p className="text-[11px] leading-4 text-zinc-500">
              Applies at the playhead · {currentTime.toFixed(1)}s
            </p>
            <div className="grid grid-cols-2 gap-2">
              {EFFECT_CARDS.map((card) => (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => addEffect(card.type, currentTime)}
                  disabled={!hasVideo}
                  className="flex flex-col items-start gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-left transition-colors hover:border-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <card.Icon className="h-4 w-4 text-violet-400" aria-hidden />
                  <span className="text-xs font-medium text-zinc-200">
                    {card.label}
                  </span>
                  <span className="text-[10px] text-zinc-500">{card.hint}</span>
                </button>
              ))}
            </div>
            {!hasVideo && (
              <p className="text-[11px] text-zinc-500">
                Import a video to add effects.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className={sectionTitle}>Active Effects</h2>
              {activeEffects.length > 0 && (
                <button
                  type="button"
                  onClick={clearEffects}
                  className="text-[11px] text-zinc-500 transition-colors hover:text-red-400"
                >
                  Clear all
                </button>
              )}
            </div>

            {activeEffects.length === 0 ? (
              <p className="text-[11px] leading-4 text-zinc-500">
                No effects yet — apply one from the gallery above.
              </p>
            ) : (
              activeEffects.map((effect) => (
                <div
                  key={effect.id}
                  className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Zap
                      className="h-3.5 w-3.5 shrink-0 text-violet-400"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                      {EFFECT_LABELS[effect.type]}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEffect(effect.id)}
                      aria-label={`Remove ${EFFECT_LABELS[effect.type]}`}
                      className="rounded p-1 text-zinc-500 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  <label className="block">
                    <span className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>Intensity</span>
                      <span className="tabular-nums">
                        {Math.round(effect.intensity * 100)}%
                      </span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={effect.intensity}
                      onChange={(event) =>
                        updateEffect(effect.id, {
                          intensity: Number(event.target.value),
                        })
                      }
                      className="mt-0.5 w-full accent-violet-500"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="block">
                      <span className="text-[10px] text-zinc-500">Start (s)</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={Number(effect.startTime.toFixed(1))}
                        onChange={(event) =>
                          updateEffect(effect.id, {
                            startTime: Math.max(0, Number(event.target.value)),
                          })
                        }
                        className={miniField}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-zinc-500">
                        Duration (s)
                      </span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={Number(effect.duration.toFixed(1))}
                        onChange={(event) =>
                          updateEffect(effect.id, {
                            duration: Math.max(0.1, Number(event.target.value)),
                          })
                        }
                        className={miniField}
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </aside>
  );
}
