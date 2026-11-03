"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Apple,
  ArrowRight,
  ChevronDown,
  Download,
  HardDrive,
  Monitor,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { getOrCreateLocalProject } from "@/lib/local-projects";
import {
  DESKTOP_PLATFORMS,
  DESKTOP_RELEASE_TAG,
  RELEASES_URL,
  releaseAssetUrl,
} from "@/lib/desktop-release";

/**
 * Tracks the signed-in user on the client. Static export has no server auth,
 * so the landing page renders signed-out first and swaps after hydration.
 * `ready` flips once the first auth check settles, so click handlers can avoid
 * racing the initial signed-out render.
 */
function useAuthedUser(): { user: User | null; ready: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

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
        .catch(() => {})
        .finally(() => {
          if (active) setReady(true);
        });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          setUser(session?.user ?? null);
          setReady(true);
        }
      });
      subscription = data.subscription;
    } catch {
      // Auth not configured — stay signed-out. `ready` stays false, so the
      // hero CTA routes through `/editor`, which seeds a browser demo.
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { user, ready };
}

/** Navbar actions: sign-in links, or "Go to Workspace" when authenticated. */
export function NavAuthActions() {
  const { user } = useAuthedUser();

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

/**
 * Desktop release wiring.
 *
 * Installers are published automatically by `.github/workflows/release.yml`
 * whenever a `v*` tag is pushed. Until the first release exists (or when the
 * repo/tag override is absent) the platform rows explain that builds are
 * compiling instead of sending visitors to a 404.
 *
 * Override at build time:
 *   NEXT_PUBLIC_GITHUB_REPO=owner/repo
 *   NEXT_PUBLIC_DESKTOP_RELEASE_TAG=v0.1.0
 */
// Constants now live in `@/lib/desktop-release` so server components (such as
// the /download page) can import them without pulling in client-only code.

const PLATFORM_ICONS = {
  windows: Monitor,
  macos: Apple,
  linux: Terminal,
} as const;

function PlatformRowContent({
  platform,
}: {
  platform: (typeof DESKTOP_PLATFORMS)[number];
}) {
  const Icon = PLATFORM_ICONS[platform.id as keyof typeof PLATFORM_ICONS];
  return (
    <>
      <Icon className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-100">
          {platform.label}
        </span>
        <span className="block text-[10px] text-zinc-500">{platform.detail}</span>
      </span>
      <code className="shrink-0 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-violet-300">
        {platform.extension}
      </code>
    </>
  );
}

/** "Download Desktop App" button with a platform dropdown. */
export function DesktopDownloadMenu() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const published = DESKTOP_RELEASE_TAG.length > 0;

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

  const rowClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-800/70 focus-visible:bg-zinc-800/70 focus-visible:outline-none";

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
          className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Available for
          </p>
          {DESKTOP_PLATFORMS.map((platform) =>
            published ? (
              <a
                key={platform.id}
                role="menuitem"
                href={releaseAssetUrl(platform.asset)}
                target="_blank"
                rel="noreferrer"
                className={rowClass}
                onClick={() => setOpen(false)}
              >
                <PlatformRowContent platform={platform} />
              </a>
            ) : (
              <button
                key={platform.id}
                type="button"
                role="menuitem"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  setNotice(
                    `The ${platform.label} installer (${platform.extension}) is compiling via GitHub Actions and will be available shortly.`
                  );
                }}
              >
                <PlatformRowContent platform={platform} />
              </button>
            )
          )}
          <div className="mt-1 border-t border-zinc-800 px-2 pt-2">
            {published ? (
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200"
              >
                <span>All releases &amp; changelog</span>
                <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
              </a>
            ) : (
              <>
                <p className="text-[10px] leading-4 text-zinc-500">
                  Desktop builds are compiling via GitHub Actions — available
                  shortly. The browser studio is available today.
                </p>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-violet-300 transition-colors hover:text-violet-200"
                >
                  Download
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </a>
              </>
            )}
          </div>
        </div>
      )}

      <Modal
        open={notice !== null}
        onClose={() => setNotice(null)}
        title="Desktop app"
        footer={
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-700"
          >
            Download
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        }
      >
        <p className="text-sm leading-6 text-zinc-300">{notice}</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Installers for Windows (.exe), macOS (.dmg) and Linux (.AppImage /
          .deb) are built automatically by GitHub Actions whenever a new version
          tag is pushed. In the meantime, the full studio runs in your browser.
        </p>
      </Modal>
    </div>
  );
}

/**
 * Hero CTAs: "Try in Browser" (web studio) + "Download Desktop App"
 * (platform dropdown), followed by the storage/privacy clarification.
 */
export function HeroAuthActions() {
  const { user, ready } = useAuthedUser();
  const router = useRouter();

  /**
   * Always land in a working editor:
   * - signed in → `/editor` auto-opens the newest cloud project (and seeds a
   *   browser demo when the account has none yet);
   * - signed out → reuse the remembered browser project or create a fresh
   *   "Browser Demo Project", then open it directly.
   */
  const enterStudio = () => {
    // Until the session check settles, let `/editor` resolve the right
    // project instead of guessing (newest cloud project, or a demo).
    if (!ready || user) {
      router.push("/editor");
      return;
    }
    router.push(`/editor?id=${getOrCreateLocalProject()}`);
  };

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enterStudio}
          className="brand-gradient brand-gradient-hover inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-900/30 transition-transform hover:scale-[1.03]"
        >
          Try in Browser
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
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
