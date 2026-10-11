"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sends already-authenticated visitors away from `/login` to the workspace so
 * they don't bounce between the marketing page and the sign-in flow.
 */
export function RedirectIfAuthed() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    try {
      const supabase = createClient();
      void supabase.auth
        .getUser()
        .then(({ data }) => {
          if (active && data.user) router.replace("/dashboard");
        })
        .catch(() => {});
    } catch {
      // Auth not configured — nothing to redirect.
    }

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
