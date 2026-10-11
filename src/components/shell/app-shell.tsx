"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/**
       * The sidebar reads `usePathname()` for active-link highlighting. On
       * routes with dynamic params it suspends during prerendering, so it is
       * wrapped in Suspense with a same-size fallback (Next.js requirement).
       */}
      <Suspense
        fallback={
          <div
            aria-hidden
            className="hidden h-full w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 lg:block"
          />
        }
      >
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </Suspense>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Ambient glow behind the page content */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.14),transparent_65%)]" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.1),transparent_65%)]" />
          </div>
          <div className="relative mx-auto h-full w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
