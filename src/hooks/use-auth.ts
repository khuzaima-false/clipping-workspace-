"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isTauriEnvironment } from "@/lib/tauri";
import { LOCAL_DESKTOP_USER, type LocalDesktopUser } from "@/lib/desktop-auth";
import { useIsTauri } from "@/hooks/use-is-tauri";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthState = {
  user: AuthUser | LocalDesktopUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** True when the local desktop identity is standing in for cloud auth. */
  isLocalDesktop: boolean;
};

/**
 * Central auth hook.
 *
 * Desktop (Tauri): returns the local identity immediately and **never creates a
 * Supabase client** — no `getUser()`, no `onAuthStateChange()`, no sign-in wall.
 *
 * Web: resolves the real Supabase session exactly as before.
 */
export function useAuth(): AuthState {
  const isDesktop = useIsTauri();
  const [cloud, setCloud] = useState<{
    user: AuthUser | null;
    loading: boolean;
  }>({ user: null, loading: true });

  useEffect(() => {
    // Check the environment synchronously: even the first effect run must not
    // touch the network in the desktop shell.
    if (isTauriEnvironment()) return;

    let active = true;
    const supabase = createClient();

    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setCloud({
          user: data.user
            ? { id: data.user.id, email: data.user.email ?? "" }
            : null,
          loading: false,
        });
      })
      .catch(() => {
        if (active) setCloud({ user: null, loading: false });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setCloud({
        user: session?.user
          ? { id: session.user.id, email: session.user.email ?? "" }
          : null,
        loading: false,
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isDesktop) {
    return {
      user: LOCAL_DESKTOP_USER,
      isAuthenticated: true,
      loading: false,
      isLocalDesktop: true,
    };
  }

  return {
    user: cloud.user,
    isAuthenticated: cloud.user !== null,
    loading: cloud.loading,
    isLocalDesktop: false,
  };
}
