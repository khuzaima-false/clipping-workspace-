"use client";

import { useRef } from "react";
import { Film, Sparkles, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";

export type LeftPanelTab = "media" | "ai";

const TABS: { id: LeftPanelTab; label: string; icon: typeof Film }[] = [
  { id: "media", label: "Media Pool", icon: Film },
  { id: "ai", label: "DeepSeek AI", icon: Sparkles },
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeftPanel({
  activeTab,
  onTabChange,
  aiContent,
  className,
}: {
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;
  aiContent?: ReactNode;
  className?: string;
}) {
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
      <div
        role="tablist"
        aria-label="Media and AI"
        className="flex h-8 shrink-0 items-center gap-0.5 border-b border-studio-border px-1.5"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-colors",
                selected
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              <Icon className="h-3 w-3" aria-hidden />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "media" && (
          <div className="space-y-2 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Media Pool
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded border border-studio-border bg-[#202127] px-2 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:border-violet-500/60 hover:text-white"
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
                        className={cn(
                          "flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors",
                          selected
                            ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
                            : "border-studio-border bg-[#15161a] text-zinc-300 hover:border-zinc-500",
                          !clip && "cursor-default opacity-60"
                        )}
                      >
                        <Film className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px]">
                            {asset.name}
                          </span>
                          <span className="block text-[9px] text-zinc-600">
                            {formatSize(asset.size)} · {clip ? "On timeline" : "Not on timeline"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {activeTab === "ai" && (
          <div className="h-full min-h-0">
            {aiContent ?? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
                <Sparkles className="h-6 w-6 text-violet-300" aria-hidden />
                <p className="text-xs font-semibold text-zinc-200">
                  DeepSeek AI Assistant
                </p>
                <p className="text-[10px] leading-4 text-zinc-500">
                  Prompt-driven edits, smart cuts and caption rewrites will live
                  here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
