"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  ChevronDown,
  Download,
  HardDrive,
  Monitor,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Tracks the signed-in user on the client. Static export has no server auth,
 * so the landing page renders signed-out first and swaps after hydration.
 */
function useAuthedUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;

    try {
      const supabase = createClient();
      void supabase.auth
        .getUser()
        .then(({ data }) => {
          if (active) setUser(data.user ?? null);
        })
        .catch(() => {});

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setUser(session?.user ?? null);
      });
      subscription = data.subscription;
    } catch {
      // Auth not configured — stay signed-out.
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  return user;
}

/** Navbar actions: sign-in links, or "Go to Workspace" when authenticated. */
export function NavAuthActions() {
  const user = useAuthedUser();

  return (
    <div className="ml-auto flex items-center gap-2">
      {user ? (
        <Link
          href="/dashboard"
          className="brand-gradient brand-gradient-hover inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-transform hover:scale-[1.03]"
        >
          Go to Workspace
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="brand-gradient brand-gradient-hover inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-transform hover:scale-[1.03]"
          >
            Launch Studio
          </Link>
        </>
      )}
    </div>
  );
}

const DESKTOP_PLATFORMS = [
  {
    id: "windows",
    label: "Windows",
    detail: "64-bit installer",
    extension: ".exe",
    icon: Monitor,
  },
  {
    id: "macos",
    label: "macOS",
    detail: "Apple Silicon & Intel",
    extension: ".dmg",
    icon: Monitor,
  },
  {
    id: "linux",
    label: "Linux",
    detail: "AppImage / .deb",
    extension: "Linux",
    icon: Terminal,
  },
] as const;

/** "Download Desktop App" button with a platform dropdown. */
export function DesktopDownloadMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (event handlers, not effect state churn).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-200 backdrop-blur transition-colors hover:border-zinc-600 hover:text-white"
      >
        <Download className="h-4 w-4 text-violet-300" aria-hidden />
        Download Desktop App
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Desktop downloads"
          className="absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Available for
          </p>
          {DESKTOP_PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            return (
              <div
                key={platform.id}
                role="menuitem"
                aria-disabled
                className="flex items-center gap-2.5 rounded-lg px-2 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-100">
                    {platform.label}
                  </span>
                  <span className="block text-[10px] text-zinc-500">
                    {platform.detail}
                  </span>
                </span>
                <code className="shrink-0 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-violet-300">
                  {platform.extension}
                </code>
              </div>
            );
          })}
          <p className="mt-1 border-t border-zinc-800 px-2 pt-2 text-[10px] leading-4 text-zinc-500">
            Windows <span className="text-zinc-400">(.exe)</span> · macOS{" "}
            <span className="text-zinc-400">(.dmg)</span> · Linux. The browser
            studio is available today — desktop builds are rolling out.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Hero CTAs: "Try in Browser" (web studio) + "Download Desktop App"
 * (platform dropdown), followed by the storage/privacy clarification.
 */
export function HeroAuthActions() {
  const user = useAuthedUser();
  const studioHref = user ? "/editor" : "/login";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={studioHref}
          className="brand-gradient brand-gradient-hover inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-900/30 transition-transform hover:scale-[1.03]"
        >
          Try in Browser
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <DesktopDownloadMenu />
      </div>

      {/* Storage / privacy clarification */}
      <p className="mt-4 flex max-w-xl items-start gap-2 text-xs leading-5 text-zinc-500">
        <ShieldCheck
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400"
          aria-hidden
        />
        <span>
          <span className="font-medium text-zinc-300">
            Zero Cloud Fees. 100% Private.
          </span>{" "}
          Browser mode saves to local browser storage; the Desktop app saves
          directly to your computer folders.
          <HardDrive className="ml-1 inline h-3 w-3 text-zinc-600" aria-hidden />
        </span>
      </p>
    </div>
  );
}
