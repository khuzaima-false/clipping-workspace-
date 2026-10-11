import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Coins,
  Crop,
  Gauge,
  Globe,
  Scissors,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { HeroPreview } from "@/components/marketing/hero-preview";
import {
  HeroAuthActions,
  NavAuthActions,
} from "@/components/marketing/auth-actions";
import {
  BASE_DAILY_CREDITS,
  CAPTIONS_CREDIT_COST,
  EXPORT_CREDIT_COST,
  FOUNDING_CREDIT_BONUS,
  MAX_REFERRALS,
  REFERRAL_CREDIT_BONUS,
} from "@/lib/credits";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const FOUNDING_DAILY = BASE_DAILY_CREDITS + FOUNDING_CREDIT_BONUS;
const STANDARD_MAX =
  BASE_DAILY_CREDITS + REFERRAL_CREDIT_BONUS * MAX_REFERRALS;

const FEATURES = [
  {
    icon: WandSparkles,
    title: "AI Auto-Captions & Styles",
    body: "Word-perfect subtitles with Hormozi, Pop-in, and Karaoke animations — generated on-device in seconds.",
  },
  {
    icon: Crop,
    title: "Dynamic Aspect Switching",
    body: "Reframe instantly between 9:16 Shorts, 16:9 landscape, and 1:1 square with smart subject tracking.",
  },
  {
    icon: Send,
    title: "Multi-Channel Publishing",
    body: "Export once and ship to TikTok, YouTube Shorts, and Instagram Reels — captioned and ready to post.",
  },
  {
    icon: Scissors,
    title: "Instant Clip Selection",
    body: "AI scores your footage and surfaces the most engaging moments before you even scrub the timeline.",
  },
];

const STATS = [
  { value: "10×", label: "Faster video editing" },
  { value: String(FOUNDING_DAILY), label: "Free daily credits for founding members" },
  { value: "3", label: "Platforms from one clip" },
  { value: "100%", label: "Runs in your browser" },
];

const TIERS = [
  {
    name: "Standard",
    price: "Free",
    tagline: "Everything you need to start clipping.",
    dailyCredits: BASE_DAILY_CREDITS,
    features: [
      `${BASE_DAILY_CREDITS} daily export credits`,
      "AI auto-captions & karaoke styles",
      "9:16, 16:9 & 1:1 aspect ratios",
      "Ad-supported exporting",
    ],
    cta: "Start Clipping Free",
    highlight: false,
  },
  {
    name: "Founding Member",
    price: "Free · 1st 1,000",
    tagline: "The full studio, supercharged with credits.",
    dailyCredits: FOUNDING_DAILY,
    features: [
      `${FOUNDING_DAILY} daily export credits (+${FOUNDING_CREDIT_BONUS} bonus)`,
      "Everything in Standard",
      "Priority render queue",
      "Founding badge on your profile",
    ],
    cta: "Become a Founding Member",
    highlight: true,
  },
  {
    name: "Referral Rewards",
    price: "Unlimited",
    tagline: "Grow your daily allowance by sharing.",
    dailyCredits: STANDARD_MAX,
    features: [
      `+${REFERRAL_CREDIT_BONUS} daily credits per referral`,
      `Bonus caps at ${MAX_REFERRALS} referrals`,
      `Reach ${STANDARD_MAX} credits / day`,
      "Stackable with your tier",
    ],
    cta: "Invite Friends",
    highlight: false,
  },
] as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.28),transparent_60%)]" />
        <div className="absolute right-[-10rem] top-64 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.22),transparent_65%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Forgevyn home">
            <Logo size="sm" />
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-zinc-100">
              Features
            </a>
            <a href="#pricing" className="transition-colors hover:text-zinc-100">
              Pricing
            </a>
            <a href="#preview" className="transition-colors hover:text-zinc-100">
              Demo
            </a>
          </nav>
          <NavAuthActions />
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Powered by Advanced AI Speech &amp; Frame Detection
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Turn Long Videos into{" "}
            <span className="text-gradient">Viral Shorts</span> in Seconds with AI
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            Forgevyn auto-frames your subject, generates dynamic captions, and
            picks the most engaging moments — so a single podcast or stream
            becomes a feed of scroll-stopping clips.
          </p>

          <HeroAuthActions />

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              Runs privately in your browser
            </span>
          </div>
        </div>

        <div id="preview" className="relative">
          <HeroPreview />
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`glass-card animate-fade-up rounded-2xl p-5 anim-delay-${(index + 1) * 100}`}
            >
              <p className="text-3xl font-bold tracking-tight text-white">
                {stat.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Built for speed
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to go viral, in one workspace
          </h2>
          <p className="mt-4 text-zinc-400">
            From raw footage to publish-ready shorts — captioned, reframed, and
            exported in a single flow.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="glass-card group rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/25 to-blue-600/20 text-violet-300 ring-1 ring-inset ring-violet-500/25">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {feature.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing / credit tiers */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Credits &amp; tiers
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Generous credits, no card required
          </h2>
          <p className="mt-4 text-zinc-400">
            Exports cost {EXPORT_CREDIT_COST} credits and AI captions cost{" "}
            {CAPTIONS_CREDIT_COST} — so a standard day covers a lot of clips.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl p-6 ${
                tier.highlight
                  ? "glass-card glow-brand border-violet-500/40"
                  : "glass-card"
              }`}
            >
              {tier.highlight && (
                <span className="brand-gradient absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg">
                  Most popular
                </span>
              )}
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                {tier.name}
              </h3>
              <p className="mt-3 text-3xl font-bold tracking-tight text-white">
                {tier.price}
              </p>
              <p className="mt-2 text-sm text-zinc-500">{tier.tagline}</p>

              <p className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
                <Coins className="h-4 w-4 text-amber-400" aria-hidden />
                <span className="font-semibold text-white">
                  {tier.dailyCredits}
                </span>
                credits / day
              </p>

              <ul className="mt-6 space-y-3">
                {tier.features.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] ${
                  tier.highlight
                    ? "brand-gradient brand-gradient-hover text-white shadow-lg shadow-violet-900/30"
                    : "border border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:border-zinc-600"
                }`}
              >
                {tier.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="glass-card glow-brand relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300">
              <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden />
              Your next viral clip is one upload away
            </span>
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Clip smarter, not harder
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Join creators turning long-form into high-performing shorts every
              single day.
            </p>
            <Link
              href="/login"
              className="brand-gradient brand-gradient-hover mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/30 transition-transform hover:scale-[1.03]"
            >
              Start Clipping Free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo size="md" />
            <p className="mt-4 max-w-xs text-sm leading-6 text-zinc-500">
              The AI video clipper that turns long podcasts, streams, and
              YouTube videos into viral shorts.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["X", "YouTube", "Instagram", "GitHub"].map((social) => (
                <span
                  key={social}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400"
                >
                  {social}
                </span>
              ))}
            </div>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "Demo", href: "#preview" },
            ]}
          />
          <FooterCol
            title="Workspace"
            links={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Projects", href: "/projects" },
              { label: "Channels", href: "/channels" },
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              { label: "Sign in", href: "/login" },
              { label: "Create account", href: "/login" },
              { label: "Referrals", href: "/login" },
            ]}
          />
        </div>

        <div className="border-t border-zinc-800/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:px-6">
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" aria-hidden />
              © {new Date().getFullYear()} Forgevyn. All rights reserved.
            </span>
            <span className="inline-flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Built for creators
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-violet-400" aria-hidden />
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                Optimized for growth
              </span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-zinc-500 transition-colors hover:text-zinc-200"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
