import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { isTauri } from "@/lib/tauri";
import type { Channel, Profile } from "@/types/database";

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

  /** Signed-in user's profile row (display name, ad-free status). */
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  loadProfile: (options?: { force?: boolean }) => Promise<void>;
  setProfile: (profile: Profile | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  channelsLoading: false,
  channelsError: null,

  setChannels: (channels) => set({ channels, channelsError: null }),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  loadChannels: async ({ force = false } = {}) => {
    // Desktop shell is local-first: there is no cloud account to query.
    if (isTauri()) return;
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
    // Desktop shell is local-first: there is no cloud account to query.
    if (isTauri()) return;
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

      set({
        profile: (data as Profile | null) ?? null,
        profileLoading: false,
        profileError: null,
      });
    } catch (err) {
      set({
        profileLoading: false,
        profileError:
          err instanceof Error ? err.message : "Failed to load profile.",
      });
    }
  },
}));
