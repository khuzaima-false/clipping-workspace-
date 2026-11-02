"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearAuthSession } from "@/lib/auth-session";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await clearAuthSession();
    } finally {
      setBusy(false);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleSignOut}
      disabled={busy}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
