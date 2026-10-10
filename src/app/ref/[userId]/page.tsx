import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Gift,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const PERKS = [
  { icon: Clapperboard, text: "10 free 1080p exports every day" },
  { icon: Sparkles, text: "AI auto-captions, colour grading & speed ramps" },
  { icon: ShieldCheck, text: "Refer 10 friends to unlock ad-free exporting" },
];

// The route reads dynamic `params`, so it renders per-request instead of
// being forced into the static prerender.
export const instant = false;

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const signupHref = userId
    ? `/login?ref=${encodeURIComponent(userId)}`
    : "/login";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Clapperboard className="h-4.5 w-4.5" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          Forgevyn
          <span className="text-zinc-500"> Clipping</span>
        </span>
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
            Create your free account to clip and export 1080p videos in your
            browser — your friend earns rewards when you join.
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
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
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
        1080p clipping workspace · Projects, Channels &amp; Campaigns
      </footer>
    </div>
  );
}
