"use client";

import { useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { useEditorStore } from "@/store/editor";
import { cn } from "@/lib/utils";

function formatSeconds(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Multi-clip media library + timeline sequence. Upload several videos and
 * arrange, reorder, trim and merge them into one export.
 */
export function MediaLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);

  const assets = useEditorStore((state) => state.assets);
  const sequence = useEditorStore((state) => state.sequence);
  const activeClipId = useEditorStore((state) => state.activeClipId);
  const addVideoAssets = useEditorStore((state) => state.addVideoAssets);
  const selectClip = useEditorStore((state) => state.selectClip);
  const removeClip = useEditorStore((state) => state.removeClip);
  const moveClip = useEditorStore((state) => state.moveClip);

  const nameFor = (assetId: string) =>
    assets.find((asset) => asset.id === assetId)?.name ?? "Clip";

  return (
    <section className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Clips ({sequence.length})
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-500"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add clips
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) {
              void addVideoAssets(event.target.files);
            }
            event.target.value = "";
          }}
        />
      </div>

      {sequence.length === 0 ? (
        <p className="mt-3 text-[11px] leading-4 text-zinc-500">
          Add two or more clips to merge them into a single exported video.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sequence.map((clip, index) => {
            const active = clip.id === activeClipId;
            const length = Math.max(0, clip.trimEnd - clip.trimStart);
            return (
              <li
                key={clip.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2 py-2 transition-colors",
                  active
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-zinc-800 bg-zinc-950/50"
                )}
              >
                <button
                  type="button"
                  onClick={() => selectClip(clip.id)}
                  aria-current={active ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/30 to-blue-600/25 text-violet-200 ring-1 ring-inset ring-violet-500/25">
                    <Film className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-zinc-200">
                      {index + 1}. {nameFor(clip.assetId)}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-zinc-500">
                      <Clock className="h-3 w-3" aria-hidden />
                      {length > 0 ? formatSeconds(length) : "—"}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveClip(clip.id, -1)}
                    disabled={index === 0}
                    aria-label="Move clip up"
                    className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveClip(clip.id, 1)}
                    disabled={index === sequence.length - 1}
                    aria-label="Move clip down"
                    className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeClip(clip.id)}
                    aria-label="Remove clip"
                    className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
