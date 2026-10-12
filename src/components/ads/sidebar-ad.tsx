"use client";

import { useEffect, useRef, useState } from "react";
import { useIsAdFree } from "@/components/credits/use-ad-free";
import { useInterval } from "@/hooks/use-interval";
import { cn } from "@/lib/utils";

/** Adsterra 300x250 iframe unit. */
const AD_KEY = "61a37ba5abbb5ed6eb1ae935df24e239";
const AD_SRC = `https://bauval.org/22/${AD_KEY}`;
/** How often a fresh ad is fetched. */
const REFRESH_MS = 30_000;

type AtOptions = {
  key: string;
  format: string;
  height: number;
  width: number;
  params: Record<string, unknown>;
};

type AtWindow = Window & { atOptions?: AtOptions };

/**
 * A single, disposable ad instance. Mounting it (re)injects a fresh script +
 * iframe; unmounting tears the whole node down. Remounting via a changed `key`
 * is what forces Adsterra to fetch a brand-new ad.
 */
function AdInstance() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Adsterra reads the config global before the loader runs.
    (window as unknown as AtWindow).atOptions = {
      key: AD_KEY,
      format: "iframe",
      height: 250,
      width: 300,
      params: {},
    };

    const script = document.createElement("script");
    script.src = AD_SRC;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    container.appendChild(script);

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-[250px] w-[300px] max-w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-950/40 ring-1 ring-inset ring-zinc-800/80"
    />
  );
}

type SidebarAdProps = {
  className?: string;
  label?: string;
};

/**
 * Sidebar 300x250 banner that refreshes every 30s by remounting a fresh
 * `<AdInstance>` (a changed `key` destroys the old iframe and triggers a new
 * ad request). The timer pauses while the tab is hidden, and the whole slot is
 * hidden for ad-free (premium) accounts.
 */
export function SidebarAd({ className, label = "Sponsored" }: SidebarAdProps) {
  const adFree = useIsAdFree();
  const [refreshKey, setRefreshKey] = useState(0);

  // Stable 30s refresh loop (paused for ad-free users and hidden tabs).
  useInterval(
    () => {
      if (!document.hidden) setRefreshKey((prev) => prev + 1);
    },
    adFree ? null : REFRESH_MS
  );

  if (adFree) return null;

  return (
    <aside
      aria-label="Sponsored content"
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </span>
      <AdInstance key={refreshKey} />
    </aside>
  );
}
