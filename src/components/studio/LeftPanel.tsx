"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Film, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoAsset } from "@/lib/video-storage";
import { useEditorStore } from "@/store/editor";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Capture the opening frame of a clip off-DOM so the media bin does not mount
 * a live video element for every asset.
 */
function MediaThumbnail({ asset }: { asset: VideoAsset }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!asset.type.startsWith("video/") || asset.blob.size === 0) {
      return;
    }

    let cancelled = false;
    let finished = false;
    const objectUrl = URL.createObjectURL(asset.blob);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    let timeoutId = 0;
    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const capture = () => {
      if (cancelled || finished) return;
      finished = true;

      if (!video.videoWidth || !video.videoHeight) {
        setFailed(true);
        cleanup();
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 80;
      const context = canvas.getContext("2d");
      if (!context) {
        setFailed(true);
        cleanup();
        return;
      }

      const targetAspect = canvas.width / canvas.height;
      const sourceAspect = video.videoWidth / video.videoHeight;
      let sx = 0;
      let sy = 0;
      let sw = video.videoWidth;
      let sh = video.videoHeight;
      if (sourceAspect > targetAspect) {
        sw = sh * targetAspect;
        sx = (video.videoWidth - sw) / 2;
      } else {
        sh = sw / targetAspect;
        sy = (video.videoHeight - sh) / 2;
      }

      try {
        context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        setThumbnail(canvas.toDataURL("image/jpeg", 0.74));
      } catch {
        setFailed(true);
      } finally {
        cleanup();
      }
    };

    const onLoadedData = () => {
      if (cancelled) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const seekTime = duration > 0 ? Math.min(0.1, duration / 2) : 0.01;
      try {
        video.currentTime = seekTime;
      } catch {
        capture();
      }
    };
    const onError = () => {
      if (cancelled) return;
      finished = true;
      setFailed(true);
      cleanup();
    };

    video.addEventListener("loadeddata", onLoadedData, { once: true });
    video.addEventListener("seeked", capture, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.src = objectUrl;
    video.load();

    timeoutId = window.setTimeout(() => {
      if (cancelled || finished) return;
      finished = true;
      setFailed(true);
      cleanup();
    }, 5000);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [asset]);

  if (thumbnail) {
    return (
      <Image
        src={thumbnail}
        alt=""
        aria-hidden
        width={128}
        height={80}
        unoptimized
        className="h-9 w-14 shrink-0 rounded border border-white/10 object-cover"
      />
    );
  }

  const unavailable =
    failed || !asset.type.startsWith("video/") || asset.blob.size === 0;
  return (
    <span
      title={unavailable ? "Thumbnail unavailable" : "Loading thumbnail"}
      className="flex h-9 w-14 shrink-0 items-center justify-center rounded border border-white/10 bg-black/40"
      aria-hidden
    >
      <Film className="h-4 w-4 text-zinc-600" />
    </span>
  );
}

/**
 * Dedicated full-width media bin with first-frame thumbnails. The former
 * Media Pool / DeepSeek AI tab split has been removed so the upper-left panel
 * belongs entirely to media.
 */
export function LeftPanel({ className }: { className?: string }) {
  const assets = useEditorStore((state) => state.assets);
  const sequence = useEditorStore((state) => state.sequence);
  const activeClipId = useEditorStore((state) => state.activeClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const addVideoAssets = useEditorStore((state) => state.addVideoAssets);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside
      data-tour="studio-left-panel"
      className={cn(
        "studio-panel flex min-h-0 flex-col overflow-hidden",
        className
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-studio-border px-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Media Pool
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="ml-auto inline-flex items-center gap-1 rounded border border-studio-border bg-[#202127] px-2 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:border-violet-500/60 hover:text-white"
        >
          <Upload className="h-3 w-3" aria-hidden />
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = event.target.files;
            if (files?.length) void addVideoAssets(files);
            event.target.value = "";
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-studio-border px-3 py-8 text-center">
            <Film className="h-6 w-6 text-zinc-600" aria-hidden />
            <p className="text-[11px] text-zinc-500">
              No media yet. Import a clip to populate the pool.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {assets.map((asset) => {
              const clip = sequence.find((item) => item.assetId === asset.id);
              const selected = clip?.id === activeClipId;
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    disabled={!clip}
                    onClick={() => clip && selectClip(clip.id)}
                    title={asset.name}
                    className={cn(
                      "flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors",
                      selected
                        ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
                        : "border-studio-border bg-[#15161a] text-zinc-300 hover:border-zinc-500",
                      !clip && "cursor-default opacity-60"
                    )}
                  >
                    <MediaThumbnail asset={asset} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px]">
                        {asset.name}
                      </span>
                      <span className="block text-[9px] text-zinc-600">
                        {formatSize(asset.size)} ·{" "}
                        {clip ? "On timeline" : "Not on timeline"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
