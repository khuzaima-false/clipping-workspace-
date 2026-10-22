import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { isTauri } from "@/lib/tauri";
import type { Project } from "@/types/database";

type ProjectsState = {
  projects: Project[];
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  setProjects: (projects: Project[]) => void;
};

/**
 * Projects owned by the signed-in user.
 * Lives outside React so effects subscribe to it as an external store
 * (the documented pattern for fetching-into-store data).
 */
export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  loading: true,
  error: null,

  setProjects: (projects) => set({ projects, error: null }),

  loadProjects: async () => {
    // Desktop shell is local-first: projects live in IndexedDB, never Supabase.
    if (isTauri()) {
      set({ projects: [], loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({
          projects: [],
          loading: false,
          error: "You must be signed in to view projects.",
        });
        return;
      }

      // RLS scopes rows to the owner; filter again as defense in depth.
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      set({ projects: (data ?? []) as Project[], loading: false, error: null });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load projects.",
      });
    }
  },
}));
