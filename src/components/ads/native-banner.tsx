"use client";

import { useEffect, useRef } from "react";
import { useIsAdFree } from "@/components/credits/use-ad-free";
import { cn } from "@/lib/utils";

/** Adsterra Native Banner loader. */
const NATIVE_BANNER_SRC =
  "https://bauval.org/21/0fd2d164c6aa73d7125a364e4c9c650a";

type NativeAdBannerProps = {
  className?: string;
  label?: string;
};

/**
 * Adsterra Native Banner. Renders nothing for ad-free (premium) accounts and
 * mounts the network script into an isolated container otherwise.
 */
export function NativeAdBanner({
  className,
  label = "Sponsored",
}: NativeAdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adFree = useIsAdFree();

  useEffect(() => {
    if (adFree) return;
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = NATIVE_BANNER_SRC;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    container.appendChild(script);

    return () => {
      script.remove();
    };
  }, [adFree]);

  if (adFree) return null;

  return (
    <aside
      aria-label="Sponsored content"
      className={cn(
        "rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <div
        ref={containerRef}
        className="mt-2 min-h-24 overflow-hidden rounded-lg"
      />
    </aside>
  );
}
