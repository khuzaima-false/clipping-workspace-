"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowRight,
  Clapperboard,
  Gift,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

const PERKS = [
  { icon: Clapperboard, text: `Full multi-track studio — 100% free, unlimited exports` },
  { icon: Sparkles, text: "Auto-captions, chroma key, keyframes, transitions & SFX" },
  {
    icon: TrendingUp,
    text: "Runs locally in your browser — no installs, nothing uploaded",
  },
];

export default function ReferralLandingPage() {
  const params = useParams<{ userId: string }>();
  const pathname = usePathname();

  // Cloudflare Pages rewrites every /ref/<id> request to the pre-rendered
  // /ref/index shell, so the URL is the source of truth for the referrer id.
  const userId = useMemo(() => {
    const fromParams = params?.userId;
    if (fromParams && fromParams !== "index") return fromParams;
    const fromPath = pathname?.match(/\/ref\/([^/?#]+)/)?.[1];
    return fromPath ? decodeURIComponent(fromPath) : (fromParams ?? "");
  }, [params, pathname]);

  const signupHref = userId
    ? `/login?ref=${encodeURIComponent(userId)}`
    : "/login";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center px-6 py-5">
        <Logo size="md" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-center shadow-2xl shadow-black/40 sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
            <Gift className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">
            You&apos;ve been invited to Forgevyn
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Create your free account to edit and export videos in your browser —
            no credit card, no watermarks, no limits.
          </p>

          <ul className="mx-auto mt-5 space-y-2.5 text-left">
            {PERKS.map((perk) => (
              <li key={perk.text} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-400 ring-1 ring-inset ring-violet-500/25">
                  <perk.icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="text-xs leading-5 text-zinc-400">
                  {perk.text}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href={signupHref}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
          >
            Create free account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>

          <p className="mt-3 text-[11px] text-zinc-600">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300">
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <footer className="px-6 pb-6 text-center text-xs text-zinc-600">
        Free in-browser video studio · Projects, Channels &amp; Sponsorships
      </footer>
    </div>
  );
}
