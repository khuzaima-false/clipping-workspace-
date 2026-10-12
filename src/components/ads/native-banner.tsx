"use client";

import { useEffect, useRef, useState } from "react";
import { useIsAdFree } from "@/components/credits/use-ad-free";
import { cn } from "@/lib/utils";

/** Adsterra Native Banner loader. */
const NATIVE_BANNER_SRC =
  "https://bauval.org/21/0fd2d164c6aa73d7125a364e4c9c650a";
/** How often a fresh ad is fetched. */
const REFRESH_MS = 30_000;

/**
 * A single, disposable native-banner instance. Remounting it (via a changed
 * `key`) is what forces Adsterra to fetch a brand-new ad.
 */
function AdInstance() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = NATIVE_BANNER_SRC;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    container.appendChild(script);

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, []);

  return <div ref={containerRef} className="mt-2 min-h-24 overflow-hidden rounded-lg" />;
}

type NativeAdBannerProps = {
  className?: string;
  label?: string;
};

/**
 * Adsterra Native Banner that refreshes every 30s by remounting a fresh
 * `<AdInstance>`. The timer pauses while the tab is hidden, and the banner is
 * hidden for ad-free (premium) accounts.
 */
export function NativeAdBanner({
  className,
  label = "Sponsored",
}: NativeAdBannerProps) {
  const adFree = useIsAdFree();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (adFree) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) setRefreshKey((prev) => prev + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
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
      <AdInstance key={refreshKey} />
    </aside>
  );
}
