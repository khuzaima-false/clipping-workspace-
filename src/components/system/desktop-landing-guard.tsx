"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsTauri } from "@/hooks/use-is-tauri";
import { activeLocalProjectId } from "@/lib/local-projects";
import { resolveStartupHref } from "@/lib/startup-router";

/**
 * Landing-page desktop gate.
 *
 * The inline head script already redirects before first paint; this component
 * is the React-level guarantee. In the desktop shell it renders a solid black
 * launch screen (so no marketing HTML can remain visible) and replaces the
 * route with the remembered project or the Project Manager dashboard.
 */
export function DesktopLandingGuard() {
  const isDesktop = useIsTauri();
  const router = useRouter();

  useEffect(() => {
    if (!isDesktop) return;
    router.replace(resolveStartupHref(activeLocalProjectId()));
  }, [isDesktop, router]);

  if (!isDesktop) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black"
    >
      <span
        aria-hidden
        className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400"
      />
      <span className="text-sm font-medium text-zinc-400">
        Opening Forgevyn…
      </span>
    </div>
  );
}
