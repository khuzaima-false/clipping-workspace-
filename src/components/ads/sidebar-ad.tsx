"use client";

import { useEffect, useRef, useState } from "react";
import { useIsAdFree } from "@/components/credits/use-ad-free";
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

type SidebarAdProps = {
  className?: string;
  label?: string;
};

/**
 * Sidebar 300x250 iframe banner with a 30s auto-refresh.
 *
 * Adsterra expects the `window.atOptions` config to exist *before* the loader
 * script runs, so both are injected together on every refresh cycle. The
 * refresh timer pauses while the tab is hidden. Renders nothing for ad-free
 * (premium) accounts.
 */
export function SidebarAd({ className, label = "Sponsored" }: SidebarAdProps) {
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

    // Drop the previous script/iframe before loading a new ad.
    container.innerHTML = "";

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
    script.dataset.adsterraSidebar = "true";
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
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </span>
      <div
        ref={containerRef}
        className="flex h-[250px] w-[300px] max-w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-950/40 ring-1 ring-inset ring-zinc-800/80"
      />
    </aside>
  );
}
