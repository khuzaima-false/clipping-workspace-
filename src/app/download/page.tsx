import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import {
  DESKTOP_PLATFORMS,
  DESKTOP_RELEASE_PUBLISHED,
  DESKTOP_RELEASE_TAG,
  RELEASES_URL,
  releaseAssetUrl,
} from "@/lib/desktop-release";

export const metadata: Metadata = {
  title: "Download Forgevyn for Desktop",
  description: "Download Forgevyn for macOS, Windows, or Linux.",
};

function OsLogo({ id }: { id: string }) {
  if (id === "macos") {
    return (
      <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden>
        <path
          fill="currentColor"
          d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        />
      </svg>
    );
  }

  if (id === "windows") {
    return (
      <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden>
        <path
          fill="currentColor"
          d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.1H3v6zm8.5-14.2 9.5-1.3v8.5h-9.5V4.3zm0 15.4 9.5 1.3v-8.5h-9.5v7.2z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2C8.5 2 6 4.3 6 7.1c0 1.2.4 2.2 1 3.1L5 13.5c-.3.5-.1 1.2.4 1.5l1.7 1c.5.3 1.2.1 1.5-.4l.8-1.4c.8.3 1.7.4 2.6.4s1.8-.1 2.6-.4l.8 1.4c.3.5 1 .7 1.5.4l1.7-1c.5-.3.7-1 .4-1.5l-2-3.3c.6-.9 1-1.9 1-3.1C18 4.3 15.5 2 12 2zm-3 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
      />
    </svg>
  );
}

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Forgevyn
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <Logo size="sm" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Download Forgevyn for Desktop
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Native installers for macOS, Windows, and Linux.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {DESKTOP_PLATFORMS.map((platform) => (
            <section
              key={platform.id}
              className="glass-card rounded-2xl p-6 text-center"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900/70 text-violet-300 ring-1 ring-inset ring-violet-500/25">
                <OsLogo id={platform.id} />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-white">
                {platform.label}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">{platform.detail}</p>
              <p className="mt-1 text-xs text-zinc-600">{platform.extension}</p>

              <a
                href={
                  DESKTOP_RELEASE_PUBLISHED
                    ? releaseAssetUrl(platform.asset)
                    : RELEASES_URL
                }
                target="_blank"
                rel="noreferrer"
                className={
                  DESKTOP_RELEASE_PUBLISHED
                    ? "brand-gradient brand-gradient-hover mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-transform hover:scale-[1.02]"
                    : "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white"
                }
              >
                <Download className="h-4 w-4" aria-hidden />
                Download
              </a>
            </section>
          ))}
        </div>

        <p className="mt-10 text-center text-xs leading-5 text-zinc-500">
          {DESKTOP_RELEASE_TAG
            ? `Current release: ${DESKTOP_RELEASE_TAG}`
            : "Desktop builds are published automatically by GitHub Actions."}
        </p>
      </div>
    </main>
  );
}
