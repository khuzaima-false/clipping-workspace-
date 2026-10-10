"use client";

import { Megaphone } from "lucide-react";
import { useIsAdFree } from "./use-ad-free";
import { cn } from "@/lib/utils";

type AdSlotProps = {
  variant?: "sidebar" | "interstitial";
  className?: string;
  label?: string;
};

/**
 * Responsive ad placement container.
 *
 * Real ad-network markup can drop into the inner frame later; for now it is a
 * clearly-labelled placeholder. Every slot hides itself when the signed-in
 * profile has an active `is_ad_free` reward.
 */
export function AdSlot({
  variant = "sidebar",
  className,
  label = "Advertisement",
}: AdSlotProps) {
  const adFree = useIsAdFree();
  if (adFree) return null;

  if (variant === "interstitial") {
    return (
      <aside
        aria-label="Sponsored content"
        className={cn(
          "rounded-xl border border-dashed border-zinc-700 bg-zinc-950/70 p-3",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Megaphone className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </span>
          <span className="ml-auto text-[10px] text-zinc-600">
            Upgrade to remove ads
          </span>
        </div>
        <div className="mt-2 flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800/70 to-zinc-900 text-xs text-zinc-500">
          Sponsored · 728 × 90
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Sponsored content"
      className={cn(
        "rounded-lg border border-dashed border-zinc-700 bg-zinc-950/60 p-2",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <div className="mt-2 flex h-32 items-center justify-center rounded-md bg-gradient-to-br from-zinc-800/60 to-zinc-900 text-[11px] text-zinc-500">
        Sponsored · 300 × 250
      </div>
    </aside>
  );
}
