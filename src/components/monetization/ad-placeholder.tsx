"use client";

import { cn } from "@/lib/utils";

/**
 * Reserved, intentionally-empty advertising container.
 *
 * This is only a slot: no ad network, no script and no external request is
 * loaded here. Drop the approved Google AdSense unit inside the frame when the
 * account is ready — nothing else in the app needs to change.
 */
export function AdPlaceholder({
  slot = "sidebar-300x250",
  className,
}: {
  /** Stable id so an ad unit can be attributed/mounted to this slot. */
  slot?: string;
  className?: string;
}) {
  return (
    <aside
      data-ad-slot={slot}
      aria-label="Reserved advertising space"
      className={cn(
        "flex aspect-[6/5] max-h-[210px] w-full shrink-0 items-center justify-center rounded-2xl border border-dashed border-zinc-800/90 bg-zinc-950/40",
        className
      )}
    >
      {/* Kept completely unfilled — only a faint, non-clickable placeholder. */}
      <span className="select-none text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-700">
        Advertisement
      </span>
    </aside>
  );
}
