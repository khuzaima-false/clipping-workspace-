import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  Coins,
  Crop,
  Diamond,
  Gauge,
  Globe,
  Mic,
  Monitor,
  MonitorPlay,
  Pipette,
  Send,
  ShieldCheck,
  Smile,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
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

/** The 10 real, 100% client-side power tools live in the editor. */
const FEATURES = [
  {
    icon: Pipette,
    title: "Chroma Key (Green Screen)",
    body: "Knock out green or blue backdrops with an eyedropper, tolerance and edge-feather controls — computed frame-by-frame on the canvas.",
  },
  {
    icon: Diamond,
    title: "Keyframe Animation Engine",
    body: "Animate scale, position, opacity and rotation with keyframes. The renderer linearly interpolates between them for smooth motion.",
  },
  {
    icon: AudioLines,
    title: "Multi-Track Audio Mixer & SFX",
    body: "Per-track volume, mute/solo and fade in/out with live waveforms — plus seven royalty-free effects synthesized with Web Audio.",
  },
  {
    icon: Captions,
    title: "Auto-Captions & Social Styles",
    body: "On-device transcription with word-level karaoke, bounce and neon-glow-box styles — or turn a typed script into timed subtitles.",
  },
  {
    icon: Gauge,
    title: "Speed Ramping & Velocity Curves",
    body: "Normal, Montage, Bullet, Hero Ramp and Jump Cut presets reshape playback and export timing with smooth accelerations.",
  },
  {
    icon: ArrowLeftRight,
    title: "Video Transitions Library",
    body: "Cross dissolve, dip to black, whip pan, glitch cut and zoom — blended frame-by-frame across every clip boundary.",
  },
  {
    icon: Smile,
    title: "Stickers, Memes & Emoji",
    body: "Badges, arrows, subscribe buttons, lower-thirds and emoji stickers, generated as crisp SVG overlays you drop on the V2 track.",
  },
  {
    icon: Crop,
    title: "Framing & Aspect Presets",
    body: "One-tap TikTok/Reels, YouTube, Square and Cinematic framing with automatic blurred or letterboxed background fill.",
  },
  {
    icon: Mic,
    title: "Voiceover & Audio Recorder",
    body: "Record a live voiceover straight onto the A2 track with a real-time level meter and an instant waveform preview.",
  },
  {
    icon: MonitorPlay,
    title: "Screen & Webcam Recorder",
    body: "Capture your screen or camera inside the studio and send the recording straight to the media bin for the timeline.",
  },
];

/** One engine, two purpose-built interfaces. */
const INTERFACES = [
  {
    icon: Monitor,
    badge: "hidden md:flex",
    title: "Desktop Studio",
    tagline: "Premiere Pro-style precision",
    points: [
      "4-panel workspace: project bin, program monitor, colour panel and timeline",
      "Multi-track timeline — video V1–V3 and audio A1–A2 with trim handles",
      "Clip property inspectors, keyframe clock and transition markers",
      "Waveform audio headers with per-track volume, mute/solo and fades",
      "Screen and webcam recorder built into the project bin",
    ],
  },
  {
    icon: Smartphone,
    badge: "md:hidden",
    title: "Mobile Studio",
    tagline: "CapCut-style touch editing",
    points: [
      "Touch drawers and quick-action bottom sheets",
      "Single-tap keyframing on the transport bar",
      "Drag-to-reposition clips with touch trim handles",
      "Voiceover recording with a live level meter",
      "Stickers, captions, cutout and framing sheets on the go",
    ],
  },
];

const STATS = [
  { value: "10", label: "Pro editing tools built in" },
  { value: "100%", label: "Client-side — nothing is uploaded" },
  { value: "0", label: "Server round-trips while editing" },
  { value: "Free", label: "Full studio, no card required" },
];

const TIERS = [
  {
    name: "Standard",
    price: "Free",
    tagline: "The full studio, unlocked for everyone.",
    dailyCredits: BASE_DAILY_CREDITS,
    features: [
      `${BASE_DAILY_CREDITS} daily export credits`,
      "All 10 editing tools included",
      "On-device auto-captions & styles",
      "9:16, 16:9, 1:1 & 21:9 exports",
    ],
    cta: "Launch Studio",
    highlight: false,
  },
  {
    name: "Founding Member",
    price: "Free · 1st 1,000",
    tagline: "The same studio with a bigger render budget.",
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
            <a href="#studio" className="transition-colors hover:text-zinc-100">
              Studio
            </a>
            <a href="#pricing" className="transition-colors hover:text-zinc-100">
              Pricing
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
            100% free · Runs entirely in your browser
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Forgevyn | Free Professional{" "}
            <span className="text-gradient">In-Browser Video Studio</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            Full-featured multi-track editing, Chroma key, keyframe animations,
            audio mixing, and customizable templates — running 100% locally in
            your browser with zero server lag.
          </p>

          <HeroAuthActions />

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              Nothing leaves your device
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-violet-400" aria-hidden />
              No server lag
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

      {/* Dual interface: desktop vs mobile */}
      <section id="studio" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            One engine, two interfaces
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A studio that adapts to your screen
          </h2>
          <p className="mt-4 text-zinc-400">
            The same client-side engine renders a precision desktop workspace on
            large screens and a touch-first editor on phones. Reach for whatever
            device is in front of you — your project comes with it.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {INTERFACES.map((ui) => {
            const Icon = ui.icon;
            return (
              <div key={ui.title} className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/25 to-blue-600/20 text-violet-300 ring-1 ring-inset ring-violet-500/25">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{ui.title}</h3>
                    <p className="text-xs text-zinc-500">{ui.tagline}</p>
                  </div>
                  <code className="ml-auto shrink-0 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-violet-300">
                    {ui.badge}
                  </code>
                </div>
                <ul className="mt-5 space-y-3">
                  {ui.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-sm text-zinc-300"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature grid: 10 real client-side power tools */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            10 power tools · zero uploads
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Every tool runs locally in your browser
          </h2>
          <p className="mt-4 text-zinc-400">
            From chroma key and keyframes to transitions, captions and audio
            mixing — the whole studio is free and processes your footage on your
            own device.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            Free · credits &amp; tiers
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything&apos;s free — credits just pace your exports
          </h2>
          <p className="mt-4 text-zinc-400">
            Every tool in the studio is unlocked for everyone. Exports cost{" "}
            {EXPORT_CREDIT_COST} credits and on-device captions cost{" "}
            {CAPTIONS_CREDIT_COST}, so a standard day covers plenty of clips.
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
              No installs, no uploads, no waiting
            </span>
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Open the studio and start editing
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Launch the full multi-track editor right now — free, private, and
              running at native speed on your own device.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/editor"
                className="brand-gradient brand-gradient-hover inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/30 transition-transform hover:scale-[1.03]"
              >
                Launch Studio
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white"
              >
                <Send className="h-4 w-4" aria-hidden />
                Open Editor
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo size="md" />
            <p className="mt-4 max-w-xs text-sm leading-6 text-zinc-500">
              A free, professional in-browser video studio — multi-track editing,
              chroma key, keyframes, captions, transitions and audio mixing, all
              running locally on your device.
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
            title="Studio"
            links={[
              { label: "10 Tools", href: "#features" },
              { label: "Dual Interface", href: "#studio" },
              { label: "Pricing", href: "#pricing" },
            ]}
          />
          <FooterCol
            title="Workspace"
            links={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Projects", href: "/projects" },
              { label: "Launch Editor", href: "/editor" },
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
                Runs at native speed
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
