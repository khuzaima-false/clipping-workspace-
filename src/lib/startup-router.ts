import type { Project } from "@/types/database";

export type StartupResolution =
  | { kind: "dashboard" }
  | { kind: "editor"; projectId: string; to: string };

/**
 * Determines the launch destination.
 *
 * A remembered project opens directly in the editor; otherwise the desktop
 * shell and web app both land on the Project Manager dashboard. The editor's
 * explicit `?id=` query is handled by the editor route itself.
 */
export function resolveStartupProject(
  activeLocalProjectId: string | null
): StartupResolution {
  if (!activeLocalProjectId) return { kind: "dashboard" };
  return {
    kind: "editor",
    projectId: activeLocalProjectId,
    to: `/editor?id=${encodeURIComponent(activeLocalProjectId)}`,
  };
}

/** Convenience for guards that need a href string. */
export function resolveStartupHref(activeLocalProjectId: string | null): string {
  const resolution = resolveStartupProject(activeLocalProjectId);
  return resolution.kind === "editor" ? resolution.to : "/dashboard";
}

export function projectDashboardHref(project: Pick<Project, "id">): string {
  return `/editor?id=${encodeURIComponent(project.id)}`;
}
