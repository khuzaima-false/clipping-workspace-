"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useIsTauri } from "@/hooks/use-is-tauri";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const desktop = useIsTauri();

  useEffect(() => {
    if (desktop) {
      document.documentElement.removeAttribute("data-tauri-entry");
    }
  }, [desktop]);

  // The studio is a full-bleed workspace: no nav rail, a slim header, and no
  // max-width cap so the program monitor can use every available pixel.
  const isEditor = pathname?.startsWith("/editor") ?? false;

  // Packaged app: no web sidebar, search bar, marketing header, or login rail.
  // The dashboard and editor provide their own native top surfaces.
  if (desktop) {
    return (
      <div className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-studio-bg text-zinc-100">
        <main className="relative min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="relative mx-auto h-full w-full max-w-none">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh max-h-dvh w-full max-w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {!isEditor && (
        /**
         * The sidebar reads `usePathname()` for active-link highlighting. On
         * routes with dynamic params it suspends during prerendering, so it is
         * wrapped in Suspense with a same-size fallback (Next.js requirement).
         */
        <Suspense
          fallback={
            <div
              aria-hidden
              className="hidden h-full w-80 shrink-0 border-r border-zinc-800 bg-zinc-950 lg:block"
            />
          }
        >
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </Suspense>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* The studio provides its own single grey menu bar; rendering the
            generic shell header here too created a second white brand header. */}
        {!isEditor && (
          <Header
            variant={isEditor ? "editor" : "default"}
            onMenuClick={() => setSidebarOpen(true)}
          />
        )}
        <main
          className={cn(
            "relative flex-1 overflow-y-auto",
            isEditor ? "p-3 sm:p-4" : "p-4 sm:p-6 lg:p-8"
          )}
        >
          {/* Ambient glow behind the page content */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.14),transparent_65%)]" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.1),transparent_65%)]" />
          </div>
          <div
            className={cn(
              "relative mx-auto h-full w-full",
              isEditor ? "max-w-none" : "max-w-7xl"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
