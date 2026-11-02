"use client";

import { isTauriEnvironment } from "@/lib/tauri";

export type ProjectDirInfo = {
  path: string;
  projectJsonPath: string;
  created: boolean;
};

async function call<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(command, args);
  } catch (error) {
    console.warn(`[tauri] ${command} failed`, error);
    return null;
  }
}

/** Returns the app-data or Desktop parent folder for project creation. */
export function getProjectParent(kind: "app" | "desktop"): Promise<string | null> {
  return call<string>("get_project_parent", { kind });
}

/** Opens the native folder picker. Returns null in browsers or on cancel. */
export function pickProjectFolder(): Promise<string | null> {
  return call<string | null>("pick_project_folder");
}

/** Creates `<parent>/<name>/.forgevyn/{commits,cache,project.forgevyn}`. */
export function createProjectDirectory(
  parent: string,
  name: string
): Promise<ProjectDirInfo | null> {
  return call<ProjectDirInfo>("create_project_directory", { parent, name });
}

/** Reads a project manifest from the root or exact manifest path. */
export function loadProjectManifest(
  path: string
): Promise<Record<string, unknown> | null> {
  return call<Record<string, unknown> | null>("load_project_manifest", { path });
}

/**
 * Writes the manifest atomically. The Rust side also appends a bounded commit
 * snapshot under `.forgevyn/commits/` for non-destructive history.
 */
export async function saveProjectManifest(
  path: string,
  data: unknown
): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_project_manifest", { path, data });
    return true;
  } catch (error) {
    console.warn("[tauri] save_project_manifest failed", error);
    return false;
  }
}
