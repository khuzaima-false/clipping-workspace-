import type { ProjectMedia } from "@/lib/video-storage";

export const PROJECT_FILE_EXTENSION = "forgevyn";
export const PROJECT_FILE_VERSION = 1;

export type ProjectFileV1 = {
  format: "forgevyn-project";
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: Record<string, unknown>;
  timeline: ProjectMedia;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "forgevyn-project"
  );
}

export function serializeProject(input: {
  id: string;
  title: string;
  settings?: Record<string, unknown>;
  media: ProjectMedia;
}): ProjectFileV1 {
  const now = new Date().toISOString();
  return {
    format: "forgevyn-project",
    version: PROJECT_FILE_VERSION,
    id: input.id,
    title: input.title,
    createdAt: now,
    updatedAt: now,
    settings: input.settings ?? {},
    timeline: input.media,
  };
}

/** Validates a `.forgevyn` file and strips unknown keys. */
export function deserializeProject(
  raw: unknown
): { ok: true; file: ProjectFileV1 } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "Project file is not an object." };
  if (raw.format !== "forgevyn-project") {
    return { ok: false, error: "Not a Forgevyn project file." };
  }
  if (raw.version !== PROJECT_FILE_VERSION) {
    return { ok: false, error: "Unsupported Forgevyn project version." };
  }
  const timeline = raw.timeline;
  if (!isRecord(timeline)) {
    return { ok: false, error: "Project file has no timeline." };
  }
  for (const key of ["assets", "sequence", "overlays", "audio"] as const) {
    if (!isArray(timeline[key])) {
      return { ok: false, error: `Project timeline.${key} must be an array.` };
    }
  }

  const cleanTimeline: ProjectMedia = {
    assets: timeline.assets as ProjectMedia["assets"],
    sequence: timeline.sequence as ProjectMedia["sequence"],
    overlays: timeline.overlays as ProjectMedia["overlays"],
    audio: timeline.audio as ProjectMedia["audio"],
    ...(isRecord(timeline.trackStates)
      ? { trackStates: timeline.trackStates }
      : {}),
    ...(typeof timeline.currentTime === "number"
      ? { currentTime: timeline.currentTime }
      : {}),
    ...(typeof timeline.savedAt === "number" ? { savedAt: timeline.savedAt } : {}),
  };

  return {
    ok: true,
    file: {
      format: "forgevyn-project",
      version: PROJECT_FILE_VERSION,
      id: typeof raw.id === "string" ? raw.id : "imported-project",
      title: typeof raw.title === "string" ? raw.title : "Imported Project",
      createdAt:
        typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      updatedAt:
        typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
      settings: isRecord(raw.settings) ? raw.settings : {},
      timeline: cleanTimeline,
    },
  };
}

export function downloadProjectFile(
  file: ProjectFileV1,
  filename?: string
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `${slugify(file.title)}.${PROJECT_FILE_EXTENSION}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(
  file: File
): Promise<ReturnType<typeof deserializeProject>> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    return deserializeProject(parsed);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse project file.",
    };
  }
}
