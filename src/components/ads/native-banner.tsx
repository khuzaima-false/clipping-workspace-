"use client";

import { useEffect, useRef, useState } from "react";
import { useIsAdFree } from "@/components/credits/use-ad-free";
import { cn } from "@/lib/utils";

/** Adsterra Native Banner loader. */
const NATIVE_BANNER_SRC =
  "https://bauval.org/21/0fd2d164c6aa73d7125a364e4c9c650a";
/** How often a fresh ad is fetched. */
const REFRESH_MS = 30_000;

type NativeAdBannerProps = {
  className?: string;
  label?: string;
};

/**
 * Adsterra Native Banner with a 30s auto-refresh. The refresh timer pauses
 * while the tab is hidden, and the component renders nothing for ad-free
 * (premium) accounts.
 */
export function NativeAdBanner({
  className,
  label = "Sponsored",
}: NativeAdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const adFree = useIsAdFree();

  // Auto-refresh every 30s, paused while the browser tab is hidden.
  useEffect(() => {
    if (adFree) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setRefreshKey((prev) => prev + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [adFree]);

  useEffect(() => {
    if (adFree) return;
    const container = containerRef.current;
    if (!container) return;

    // Drop the previous script/banner before loading a new ad.
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = NATIVE_BANNER_SRC;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.dataset.adsterraNative = "true";
    container.appendChild(script);

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, [adFree, refreshKey]);

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
