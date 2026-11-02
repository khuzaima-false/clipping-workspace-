"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Film } from "lucide-react";
import { useEditorStore } from "@/store/editor";

/**
 * High-density dual-monitor workspace: Source/Media monitor on the left and
 * the existing Program Monitor on the right. The program monitor is supplied
 * by the parent so all existing playback/transport logic stays intact.
 */
export function DualViewport({
  program,
  className,
}: {
  program: ReactNode;
  className?: string;
}) {
  const assets = useEditorStore((state) => state.assets);
  const sequence = useEditorStore((state) => state.sequence);
  const activeClipId = useEditorStore((state) => state.activeClipId);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeClip = sequence.find((clip) => clip.id === activeClipId);
  const activeAsset =
    assets.find((asset) => asset.id === activeClip?.assetId) ?? assets[0];

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !activeAsset) return;

    const url = URL.createObjectURL(activeAsset.blob);
    element.src = url;
    return () => {
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    };
  }, [activeAsset]);

  return (
    <div
      data-tour="dual-viewport"
      className={
        className ??
        "grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden"
      }
    >
      <section
        data-tour="source-monitor"
        className="studio-panel flex min-h-0 flex-col overflow-hidden"
      >
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-studio-border px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Source
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-600">
            {activeAsset?.name ?? "No media loaded"}
          </span>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0d0e11]">
          {activeAsset ? (
            <video
              ref={videoRef}
              muted
              playsInline
              preload="metadata"
              aria-label={`Source monitor: ${activeAsset.name}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <Film className="h-8 w-8 text-zinc-700" aria-hidden />
              <p className="text-[11px] text-zinc-500">
                Select a clip in the Media Pool to load the source monitor.
              </p>
            </div>
          )}
        </div>

        <div className="flex h-6 shrink-0 items-center gap-2 border-t border-studio-border px-2 text-[9px] text-zinc-600">
          <span className="truncate">
            {activeAsset
              ? `${activeAsset.type || "video"} · ${(activeAsset.size / (1024 * 1024)).toFixed(1)} MB`
              : "Source monitor"}
          </span>
          <span className="ml-auto tabular-nums">
            {activeAsset && activeClip
              ? `${Math.max(0, activeClip.trimEnd - activeClip.trimStart).toFixed(1)}s`
              : "—"}
          </span>
        </div>
      </section>

      <div className="flex min-h-0 flex-col overflow-hidden">{program}</div>
    </div>
  );
}
