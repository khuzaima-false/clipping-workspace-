"use client";

import { isTauriEnvironment } from "@/lib/tauri";

export type SecureAuthSession = {
  accessToken: string;
  refreshToken: string;
  email?: string;
};

/**
 * Optional desktop cloud session persistence.
 *
 * Supabase still owns the live browser session. This mirror exists so future
 * AI-credit calls from the Tauri shell can authenticate without exposing the
 * token in localStorage. Browser builds are a no-op.
 */
export async function persistAuthSession(
  session: SecureAuthSession
): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_auth_token", { token: JSON.stringify(session) });
    return true;
  } catch (error) {
    console.warn("[tauri] save_auth_token failed", error);
    return false;
  }
}

export async function readAuthSession(): Promise<SecureAuthSession | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = await invoke<string | null>("load_auth_token");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<SecureAuthSession>;
    if (
      typeof value.accessToken !== "string" ||
      typeof value.refreshToken !== "string"
    ) {
      return null;
    }
    return {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
      email: typeof value.email === "string" ? value.email : undefined,
    };
  } catch (error) {
    console.warn("[tauri] load_auth_token failed", error);
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("clear_auth_token");
  } catch (error) {
    console.warn("[tauri] clear_auth_token failed", error);
  }
}
