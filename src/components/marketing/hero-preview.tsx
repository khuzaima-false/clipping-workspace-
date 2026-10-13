"use client";

import { useState } from "react";
import { Clapperboard, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const ASPECTS = [
  { id: "9:16", label: "9:16", hint: "Shorts", frame: "aspect-[9/16] h-full" },
  { id: "16:9", label: "16:9", hint: "Landscape", frame: "aspect-video w-full" },
  { id: "1:1", label: "1:1", hint: "Square", frame: "aspect-square h-full" },
  { id: "21:9", label: "21:9", hint: "Cinematic", frame: "aspect-[21/9] w-full" },
] as const;

type AspectId = (typeof ASPECTS)[number]["id"];

/**
 * Decorative/interactive mock of the clipping workspace used in the hero.
 * Purely client-side — lets visitors preview aspect-ratio switching.
 */
export function HeroPreview() {
  const [aspect, setAspect] = useState<AspectId>("9:16");
  const current = ASPECTS.find((item) => item.id === aspect) ?? ASPECTS[0];

  return (
    <div className="animate-fade-up anim-delay-200 glow-brand glass-card relative rounded-2xl p-2">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          <Clapperboard className="h-3.5 w-3.5 text-violet-400" aria-hidden />
          Forgevyn Studio
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300 ring-1 ring-inset ring-violet-500/30">
          <Sparkles className="h-3 w-3" aria-hidden />
          100% Local
        </span>
      </div>

      {/* Preview stage */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950">
        <div className="ambient-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative flex h-64 items-center justify-center p-4 sm:h-72">
          <div
            className={cn(
              "relative overflow-hidden rounded-lg bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ring-1 ring-zinc-700/70 transition-all duration-500",
              current.frame
            )}
          >
            {/* fake video content */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.3),transparent_55%)]" />
            <div className="absolute inset-x-0 top-1/3 flex justify-center">
              <span className="rounded-md bg-black/40 px-2 py-1 text-[10px] text-zinc-300 backdrop-blur-sm">
                🎬 studio_project.mp4
              </span>
            </div>

            {/* caption overlay */}
            <div className="absolute inset-x-3 bottom-6 text-center">
              <p className="text-sm font-extrabold uppercase leading-tight tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:text-base">
                Full studio,{" "}
                <span className="text-amber-300">running locally</span>
              </p>
            </div>

            {/* play button */}
            <button
              type="button"
              aria-label="Preview"
              className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-xl transition-transform hover:scale-110"
            >
              <Play className="h-4 w-4 translate-x-px" aria-hidden />
            </button>
          </div>
        </div>

        {/* Aspect toggles */}
        <div className="relative flex items-center justify-center gap-2 pb-4">
          {ASPECTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAspect(item.id)}
              aria-pressed={aspect === item.id}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-all",
                aspect === item.id
                  ? "brand-gradient border-transparent text-white shadow-lg shadow-violet-900/40"
                  : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              )}
            >
              {item.label}
              <span className="ml-1 text-[10px] opacity-70">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fake timeline */}
      <div className="px-2 pb-1 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums text-zinc-500">00:12</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
            <div className="brand-gradient absolute inset-y-0 left-0 w-[38%] rounded-full" />
            <div className="absolute inset-y-0 left-[38%] w-0.5 bg-white/80" />
          </div>
          <span className="text-[10px] tabular-nums text-zinc-500">00:47</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[26, 44, 33, 52, 30].map((width, index) => (
            <div
              key={index}
              style={{ width: `${width}px` }}
              className={cn(
                "h-8 rounded-md ring-1 ring-inset",
                index === 1
                  ? "bg-violet-600/30 ring-violet-500/50"
                  : "bg-zinc-800/70 ring-zinc-700/60"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
