"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Gift, Loader2, LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

type Banner = {
  tone: "error" | "success";
  message: string;
} | null;

/** No-op subscription: the referral param never changes during a session. */
const subscribeNoop = () => () => {};

function getReferrerSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  const ref = new URLSearchParams(window.location.search).get("ref");
  return ref && ref.trim() ? ref.trim() : null;
}

function getReferrerServerSnapshot(): string | null {
  return null;
}

export function LoginForm() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  /** Referrer user id from `/ref/[userId]` → `/login?ref=...`. */
  const referrer = useSyncExternalStore(
    subscribeNoop,
    getReferrerSnapshot,
    getReferrerServerSnapshot
  );

  function switchMode(next: Mode) {
    setMode(next);
    setBanner(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setBanner({ tone: "error", message: "Enter your email and password." });
      return;
    }

    setLoading(true);
    setBanner(null);

    const supabase = createClient();

    try {
      if (mode === "sign-in") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setBanner({
            tone: "error",
            message:
              error.message === "Invalid login credentials"
                ? "Invalid email or password. Try again or create an account."
                : error.message,
          });
          return;
        }

        if (data.session) {
          setBanner({ tone: "success", message: "Signed in. Redirecting…" });
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            // Stored in user metadata; handle_new_user() attributes the
            // referral and rewards the referrer.
            data: referrer ? { ref: referrer } : undefined,
          },
        });

        if (error) {
          setBanner({ tone: "error", message: error.message });
          return;
        }

        if (data.session) {
          // Email confirmation disabled: session issued immediately.
          setBanner({ tone: "success", message: "Account created. Redirecting…" });
          router.push("/dashboard");
          router.refresh();
        } else {
          setBanner({
            tone: "success",
            message:
              "Account created. Check your inbox to confirm your email, then sign in.",
          });
        }
      }
    } catch (err) {
      setBanner({
        tone: "error",
        message:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const isSignIn = mode === "sign-in";

  return (
    <div className="glass-card w-full max-w-md rounded-2xl p-6 shadow-2xl shadow-black/40 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
          {isSignIn ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isSignIn
            ? "Sign in to your clipping workspace."
            : "Start clipping and exporting 1080p videos."}
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Authentication"
        className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={isSignIn}
          onClick={() => switchMode("sign-in")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isSignIn
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isSignIn}
          onClick={() => switchMode("sign-up")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !isSignIn
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Feedback banner */}
      {referrer && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3.5 py-3 text-xs text-violet-200">
          <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            You were invited! Create an account and your friend earns +10 daily
            credits.
          </span>
        </div>
      )}

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`mb-5 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
            banner.tone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {banner.tone === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={
              isSignIn ? "current-password" : "new-password"
            }
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignIn ? "••••••••" : "At least 6 characters"}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="brand-gradient brand-gradient-hover inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {isSignIn ? "Signing in…" : "Creating account…"}
            </>
          ) : (
            <>
              {isSignIn ? (
                <LogIn className="h-4 w-4" aria-hidden />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden />
              )}
              {isSignIn ? "Sign In" : "Sign Up"}
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-zinc-600">
        {isSignIn
          ? "New here? Switch to Sign Up to create an account."
          : "Already have an account? Switch to Sign In."}
      </p>
    </div>
  );
}
