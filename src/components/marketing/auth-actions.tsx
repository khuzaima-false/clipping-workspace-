"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { ArrowRight } from "lucide-react";
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
            Start Clipping Free
          </Link>
        </>
      )}
    </div>
  );
}

/** Hero CTAs: "Start Clipping Free" becomes "Go to Workspace" when signed in. */
export function HeroAuthActions() {
  const user = useAuthedUser();

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        href={user ? "/dashboard" : "/login"}
        className="brand-gradient brand-gradient-hover inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-900/30 transition-transform hover:scale-[1.03]"
      >
        {user ? "Go to Workspace" : "Start Clipping Free"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <a
        href="#preview"
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-200 backdrop-blur transition-colors hover:border-zinc-600 hover:text-white"
      >
        Watch Demo
      </a>
    </div>
  );
}
