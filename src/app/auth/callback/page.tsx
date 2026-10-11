"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase auth code-exchange callback.
 *
 * Static export (`output: "export"`) has no server runtime, so the exchange is
 * performed in the browser instead of a route handler. The PKCE code verifier
 * is stored client-side by the Supabase browser client, so this works without a
 * server.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = searchParams.get("code");
      const rawNext = searchParams.get("next") ?? "/";

      // Only allow same-origin relative redirects (blocks open redirects).
      const next =
        rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

      if (!code) {
        router.replace("/login?error=auth");
        return;
      }

      try {
        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (cancelled) return;

        if (error) {
          console.error("[auth] code exchange failed:", error.message);
          setMessage("Sign-in failed. Redirecting…");
          router.replace("/login?error=auth");
          return;
        }

        router.replace(next);
      } catch (err) {
        if (cancelled) return;
        console.error("[auth] code exchange failed:", err);
        setMessage("Sign-in failed. Redirecting…");
        router.replace("/login?error=auth");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <Logo size="lg" iconOnly />
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <p className="text-sm text-zinc-400">Completing sign-in…</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
