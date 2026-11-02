"use client";

import { Eye, EyeOff, Lock, Mic, Square, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackField, TrackKey, TrackState } from "@/lib/tracks";

/**
 * Compact track header for the multi-track timeline.
 * Presentational only: all mutations are delegated to the parent.
 */
export function TrackHeader({
  keyName,
  track,
  dimmed,
  voiceRecording,
  voiceLevel,
  onToggle,
  onToggleVoiceover,
  className,
}: {
  keyName: TrackKey;
  track: TrackState;
  dimmed: boolean;
  voiceRecording: boolean;
  voiceLevel: number;
  onToggle: (field: TrackField) => void;
  onToggleVoiceover: () => void;
  className?: string;
}) {
  const button =
    "flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold transition-colors";

  return (
    <div
      data-testid={`track-header-${keyName}`}
      className={cn(
        "relative flex h-12 w-24 shrink-0 items-center gap-1 border-b border-r border-studio-border bg-studio-panel px-1.5",
        dimmed && "opacity-55",
        track.locked && "bg-amber-500/5 ring-1 ring-inset ring-amber-500/30",
        className
      )}
    >
      <span className="mr-0.5 w-6 shrink-0 text-[10px] font-semibold text-zinc-300">
        {keyName}
      </span>
      <button
        type="button"
        aria-label={`Mute ${keyName}`}
        aria-pressed={track.muted}
        onClick={() => onToggle("muted")}
        className={cn(
          button,
          track.muted
            ? "bg-amber-500/30 text-amber-300"
            : "text-zinc-500 hover:text-zinc-200"
        )}
      >
        M
      </button>
      <button
        type="button"
        aria-label={`Solo ${keyName}`}
        aria-pressed={track.solo}
        onClick={() => onToggle("solo")}
        className={cn(
          button,
          track.solo
            ? "bg-sky-500/30 text-sky-300"
            : "text-zinc-500 hover:text-zinc-200"
        )}
      >
        S
      </button>
      <button
        type="button"
        aria-label={`${track.locked ? "Unlock" : "Lock"} ${keyName}`}
        aria-pressed={track.locked}
        title={track.locked ? "Track locked - edits blocked" : "Lock track"}
        onClick={() => onToggle("locked")}
        className={cn(
          button,
          track.locked
            ? "bg-amber-500/30 text-amber-300"
            : "text-zinc-500 hover:text-zinc-200"
        )}
      >
        {track.locked ? (
          <Lock className="h-3 w-3" aria-hidden />
        ) : (
          <Unlock className="h-3 w-3" aria-hidden />
        )}
      </button>
      {keyName === "A2" ? (
        <button
          type="button"
          aria-label={voiceRecording ? "Stop voiceover" : "Record voiceover"}
          title="Record voiceover (microphone)"
          onClick={onToggleVoiceover}
          className={cn(
            button,
            voiceRecording
              ? "bg-red-500/30 text-red-300"
              : "text-zinc-500 hover:text-zinc-200"
          )}
        >
          {voiceRecording ? (
            <Square className="h-3 w-3" aria-hidden />
          ) : (
            <Mic className="h-3 w-3" aria-hidden />
          )}
        </button>
      ) : (
        <button
          type="button"
          aria-label={`${track.isVisible ? "Hide" : "Show"} ${keyName}`}
          aria-pressed={!track.isVisible}
          title={
            track.isVisible
              ? "Hide this lane (skip in preview + export)"
              : "Show this lane"
          }
          onClick={() => onToggle("isVisible")}
          className={cn(
            button,
            track.isVisible
              ? "text-zinc-500 hover:text-zinc-200"
              : "bg-zinc-500/20 text-amber-300"
          )}
        >
          {track.isVisible ? (
            <Eye className="h-3 w-3" aria-hidden />
          ) : (
            <EyeOff className="h-3 w-3" aria-hidden />
          )}
        </button>
      )}
      {keyName === "A2" && voiceRecording && (
        <span className="absolute inset-x-1.5 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-zinc-700">
          <span
            className="block h-full bg-red-400"
            style={{ width: `${Math.round(voiceLevel * 100)}%` }}
          />
        </span>
      )}
    </div>
  );
}
