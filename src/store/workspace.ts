import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { computeDailyReset, isAdFree } from "@/lib/credits";
import type { Channel, Profile } from "@/types/database";

/** Result of attempting to spend an export credit. */
export type CreditAuthorization = {
  /** True when the export may proceed (a credit was spent server-side). */
  ok: boolean;
  /** Credits remaining after the attempt. */
  remaining: number;
  /** Why an attempt was rejected, for tailored UI. */
  reason?: "insufficient" | "error";
  /** Human-readable error for `reason: "error"`. */
  error?: string;
};

type WorkspaceState = {
  /** Channels owned by the signed-in user. */
  channels: Channel[];
  /** `null` = "All channels" (no filter). */
  activeChannelId: string | null;
  channelsLoading: boolean;
  channelsError: string | null;
  loadChannels: (options?: { force?: boolean }) => Promise<void>;
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string | null) => void;

  /** Signed-in user's profile row (credits, referrals, ad-free status). */
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  /** Loads the profile. Read-only: credits are only mutated via the RPC. */
  loadProfile: (options?: { force?: boolean }) => Promise<void>;
  setProfile: (profile: Profile | null) => void;
  /**
   * Spends `cost` daily credits through the `deduct_user_credit` Postgres
   * function. The refill + deduction happen atomically server-side; a client
   * can never write `daily_credits` directly (column-level privileges are
   * revoked). Fails closed if the RPC is unavailable.
   */
  consumeCredits: (cost: number) => Promise<CreditAuthorization>;
};

function isInsufficientCreditsError(error: { message?: string } | null): boolean {
  return Boolean(
    error?.message && error.message.toUpperCase().includes("INSUFFICIENT_CREDITS")
  );
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  channelsLoading: false,
  channelsError: null,

  setChannels: (channels) => set({ channels, channelsError: null }),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  loadChannels: async ({ force = false } = {}) => {
    const { channelsLoading, channels } = get();
    if (channelsLoading) return;
    if (!force && channels.length > 0) return;

    set({ channelsLoading: true, channelsError: null });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({ channels: [], channelsLoading: false, channelsError: null });
        return;
      }

      // RLS already scopes rows to the owner; filter again as defense in depth.
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const channels = (data ?? []) as Channel[];
      const active = get().activeChannelId;
      set({
        channels,
        channelsLoading: false,
        channelsError: null,
        // Drop a selected channel that no longer exists.
        activeChannelId:
          active && !channels.some((c) => c.id === active) ? null : active,
      });
    } catch (err) {
      set({
        channelsLoading: false,
        channelsError:
          err instanceof Error ? err.message : "Failed to load channels.",
      });
    }
  },

  profile: null,
  profileLoading: false,
  profileError: null,

  setProfile: (profile) => set({ profile, profileError: null }),

  loadProfile: async ({ force = false } = {}) => {
    const { profileLoading, profile } = get();
    if (profileLoading) return;
    if (!force && profile) return;

    set({ profileLoading: true, profileError: null });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({ profile: null, profileLoading: false, profileError: null });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw new Error(error.message);

      let next = (data as Profile | null) ?? null;

      // Present the refilled balance once the UTC day rolls over. This is
      // display-only; the authoritative reset happens in deduct_user_credit.
      if (next) {
        const reset = computeDailyReset(next);
        if (reset) next = { ...next, ...reset };
      }

      set({ profile: next, profileLoading: false, profileError: null });
    } catch (err) {
      set({
        profileLoading: false,
        profileError:
          err instanceof Error ? err.message : "Failed to load profile.",
      });
    }
  },

  consumeCredits: async (cost) => {
    const spend = Math.max(1, Math.floor(cost));
    const supabase = createClient();

    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
    if (!user) {
      return { ok: false, remaining: 0, reason: "error", error: "Not signed in." };
    }

    if (!get().profile) {
      await get().loadProfile({ force: true });
    }
    const current = get().profile;
    const baseline = current?.daily_credits ?? 0;

    // Optimistically reflect the spend so every credit counter updates the
    // instant an action runs, then reconcile with the server's value below.
    if (current) {
      set((state) => ({
        profile: state.profile
          ? { ...state.profile, daily_credits: Math.max(0, baseline - spend) }
          : state.profile,
      }));
    }

    // Server-authoritative, atomic refill + deduction.
    const { data, error } = await supabase.rpc("deduct_user_credit", {
      user_id: user.id,
      cost: spend,
    });

    if (error) {
      // Revert the optimistic update — the server rejected the spend.
      set((state) => ({
        profile: state.profile
          ? { ...state.profile, daily_credits: baseline }
          : state.profile,
      }));

      if (isInsufficientCreditsError(error)) {
        return { ok: false, remaining: baseline, reason: "insufficient" };
      }
      // Fail closed: never fall back to a client-side balance mutation.
      set({
        profileError:
          error.message ||
          "Could not verify your credits. Please try again.",
      });
      return {
        ok: false,
        remaining: baseline,
        reason: "error",
        error: error.message,
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as {
      remaining?: number;
      is_founding?: boolean;
      reset_at?: string;
    } | null;

    const optimistic = Math.max(0, baseline - spend);
    // Trust the server when it returns a finite balance, but never report a
    // value higher than the optimistic cut (guards against a stale/old
    // `deduct_user_credit` that didn't subtract).
    const remaining =
      typeof row?.remaining === "number" && Number.isFinite(row.remaining)
        ? Math.min(row.remaining, optimistic)
        : optimistic;

    set((state) => ({
      profile: state.profile
        ? {
            ...state.profile,
            daily_credits: remaining,
            last_credit_reset: row?.reset_at ?? state.profile.last_credit_reset,
          }
        : state.profile,
      profileError: null,
    }));

    return { ok: true, remaining };
  },
}));

/** Derived selector: true when ads should be hidden for the current profile. */
export const selectIsAdFree = (state: WorkspaceState): boolean =>
  isAdFree(state.profile);
