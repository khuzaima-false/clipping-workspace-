"use client";

import { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { useEditorStore } from "@/store/editor";
import { ASPECT_RESOLUTIONS, drawScene, speedAt } from "@/lib/render";
import { audioPreview } from "@/lib/audio-preview";

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hundredths = Math.floor((safe % 1) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

const chipClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50";

export function PreviewPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const playing = useEditorStore((state) => state.playing);
  const currentTime = useEditorStore((state) => state.currentTime);
  const duration = useEditorStore((state) => state.duration);
  const trimStart = useEditorStore((state) => state.trimStart);
  const trimEnd = useEditorStore((state) => state.trimEnd);
  const volume = useEditorStore((state) => state.volume);
  const fps = useEditorStore((state) => state.fps);
  const hasVideo = useEditorStore((state) => state.videoEl !== null);

  const seek = useEditorStore((state) => state.seek);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const setVolume = useEditorStore((state) => state.setVolume);
  const setTrimStart = useEditorStore((state) => state.setTrimStart);
  const setTrimEnd = useEditorStore((state) => state.setTrimEnd);
  const resetTrim = useEditorStore((state) => state.resetTrim);

  const frame = Math.round(currentTime * fps);
  const totalFrames = Math.max(0, Math.round(duration * fps));

  const handleStep = (delta: number) => {
    const state = useEditorStore.getState();
    if (!state.videoEl) return;
    if (state.playing) state.setPlaying(false);
    state.stepFrame(delta);
  };

  // Frame-by-frame shortcuts (← / →), ignored while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
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
      if (!state.videoEl) return;
      event.preventDefault();
      if (state.playing) state.setPlaying(false);
      state.stepFrame(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let lastClockSync = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      // Read fresh state every frame so edits (overlays, fit, aspect) show
      // immediately without re-subscribing this effect.
      const state = useEditorStore.getState();
      const { width, height } = ASPECT_RESOLUTIONS[state.aspect];
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const video = state.videoEl;

      if (video && !video.paused && !video.ended) {
        // Follow the velocity curve so playback speed ramps dynamically.
        const rate = speedAt(state.speedPoints, video.currentTime);
        const clampedRate = Math.min(Math.max(rate, 0.0625), 16);
        if (Math.abs(video.playbackRate - clampedRate) > 0.001) {
          video.playbackRate = clampedRate;
        }

        // Sync the UI clock at ~10 Hz instead of re-rendering every frame.
        const now = performance.now();
        if (now - lastClockSync >= 100) {
          lastClockSync = now;
          if (Math.abs(video.currentTime - useEditorStore.getState().currentTime) > 0.01) {
            useEditorStore.setState({ currentTime: video.currentTime });
          }
        }
        // Loop within the trimmed range while previewing a selection.
        if (
          state.duration > 0 &&
          state.trimEnd < state.duration - 0.05 &&
          video.currentTime >= state.trimEnd
        ) {
          video.currentTime = state.trimStart;
        }
      }

      const playbackTime = video ? video.currentTime : state.currentTime;

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
          // Gate overlay visibility against the real playback position so
          // the preview matches the exported frames exactly.
          sceneTime: playbackTime,
        },
        { placeholder: true }
      );

      // Keep external SFX elements in sync with the video clock.
      audioPreview.sync(
        state.audioTracks,
        playbackTime,
        Boolean(video && !video.paused && !video.ended)
      );
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      audioPreview.stop();
    };
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
        <canvas
          ref={canvasRef}
          aria-label="Video preview canvas"
          className="max-h-[54vh] max-w-full rounded-lg shadow-lg shadow-black/40 ring-1 ring-zinc-800"
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            disabled={!hasVideo}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4 translate-x-px" aria-hidden />
            )}
          </button>

          <span className="w-32 shrink-0 text-xs tabular-nums text-zinc-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.01}
            value={Math.min(currentTime, duration)}
            disabled={!hasVideo}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Seek through video"
            className="w-full accent-violet-500"
          />
        </div>

        {/* Frame-by-frame transport */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={!hasVideo}
            aria-label="Step back one frame"
            className={chipClass}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> -1 Frame
          </button>
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={!hasVideo}
            aria-label="Step forward one frame"
            className={chipClass}
          >
            +1 Frame <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="text-[11px] tabular-nums text-zinc-500">
            Frame {Math.max(0, frame)} / {totalFrames} · {fps}fps
          </span>
          <span className="ml-auto hidden text-[10px] text-zinc-600 sm:inline">
            Use ← / → to step frames
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTrimStart(currentTime)}
            disabled={!hasVideo}
            className={chipClass}
          >
            Set In · {formatTime(trimStart)}
          </button>
          <button
            type="button"
            onClick={() => setTrimEnd(currentTime)}
            disabled={!hasVideo}
            className={chipClass}
          >
            Set Out · {formatTime(trimEnd)}
          </button>
          <button
            type="button"
            onClick={resetTrim}
            disabled={!hasVideo}
            className={chipClass}
          >
            <RotateCcw className="h-3 w-3" aria-hidden /> Reset trim
          </button>

          <div className="ml-auto flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-zinc-500" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Volume"
              className="w-20 accent-violet-500"
            />
          </div>
        </div>

        {!hasVideo && (
          <p className="text-[11px] text-zinc-500">
            Import a video on the left to enable playback, trimming, and export.
          </p>
        )}
      </div>
    </div>
  );
}
