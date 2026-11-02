import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { isTauriEnvironment } from "@/lib/tauri";
import { listLocalProjects } from "@/lib/local-projects";
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
    const localProjects = listLocalProjects();
    // Desktop shell is local-first: projects live in localStorage/IndexedDB,
    // never Supabase.
    if (isTauriEnvironment()) {
      set({ projects: localProjects, loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Signed-out visitors still get their browser-local projects; the
        // dashboard is now a first-class landing surface, not a login wall.
        set({ projects: localProjects, loading: false, error: null });
        return;
      }

      // RLS scopes rows to the owner; filter again as defense in depth.
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const merged = new Map<string, Project>();
      for (const project of [
        ...((data ?? []) as Project[]),
        ...localProjects,
      ]) {
        merged.set(project.id, project);
      }
      const projects = [...merged.values()].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      set({ projects, loading: false, error: null });
    } catch (err) {
      set({
        projects: localProjects,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load projects.",
      });
    }
  },
}));
