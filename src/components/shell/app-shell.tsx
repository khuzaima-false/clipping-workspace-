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

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto h-full w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
