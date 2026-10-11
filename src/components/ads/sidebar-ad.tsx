"use client";

import { useEffect, useRef } from "react";
import { useIsAdFree } from "@/components/credits/use-ad-free";
import { cn } from "@/lib/utils";

/** Adsterra 300x250 iframe unit. */
const AD_KEY = "61a37ba5abbb5ed6eb1ae935df24e239";
const AD_SRC = `https://bauval.org/22/${AD_KEY}`;

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
 * Sidebar 300x250 iframe banner.
 *
 * Adsterra expects the `window.atOptions` config to exist *before* the loader
 * script runs, so both are injected in the same effect. Renders nothing for
 * ad-free (premium) accounts.
 */
export function SidebarAd({ className, label = "Sponsored" }: SidebarAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adFree = useIsAdFree();

  useEffect(() => {
    if (adFree) return;
    const container = containerRef.current;
    if (!container) return;
    // Guard against duplicate injection across Fast Refresh / remounts.
    if (container.querySelector("script[data-adsterra-sidebar]")) return;

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
      delete (window as unknown as AtWindow).atOptions;
    };
  }, [adFree]);

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
