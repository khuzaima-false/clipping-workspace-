"use client";

import Link from "next/link";
import { Clock, Cloud, Film, HardDrive } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
import { isLocalProjectId } from "@/lib/local-projects";
import type { Project } from "@/types/database";

const THUMBNAIL_GRADIENTS = [
  "from-violet-600/45 via-indigo-500/20 to-[#18191d]",
  "from-sky-500/40 via-cyan-400/15 to-[#18191d]",
  "from-amber-500/35 via-rose-500/15 to-[#18191d]",
  "from-emerald-500/35 via-teal-400/15 to-[#18191d]",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return THUMBNAIL_GRADIENTS[hash % THUMBNAIL_GRADIENTS.length];
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ProjectCard({
  project,
  channelName,
}: {
  project: Project;
  channelName?: string | null;
}) {
  const local = isLocalProjectId(project.id);
  const storageMode =
    typeof project.settings?.storageMode === "string"
      ? project.settings.storageMode
      : local
        ? "local"
        : "cloud";

  return (
    <article className="studio-panel flex min-h-[250px] flex-col overflow-hidden transition-colors hover:border-zinc-600">
      <div
        className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${gradientFor(project.id)}`}
      >
        <Film className="h-9 w-9 text-white/50" aria-hidden />
        <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-medium text-zinc-200 backdrop-blur-sm">
          {local ? (
            <HardDrive className="h-2.5 w-2.5" aria-hidden />
          ) : (
            <Cloud className="h-2.5 w-2.5" aria-hidden />
          )}
          {local ? (storageMode === "browser" ? "Browser" : "Local") : "Cloud"}
        </div>
        <div className="absolute right-2.5 top-2.5">
          <StatusChip status={project.status} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <h2 className="truncate text-sm font-semibold text-zinc-100">
          {project.title}
        </h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          Updated {formatUpdated(project.updated_at)}
        </p>
        <div className="mt-2">
          <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded border border-studio-border bg-[#121316] px-2 py-1 text-[10px] text-zinc-500">
            <Film className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{channelName ?? "No channel"}</span>
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-studio-border pt-3">
          <Link
            href={`/editor?id=${encodeURIComponent(project.id)}`}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-violet-600/90 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500"
          >
            Open project
          </Link>
        </div>
      </div>
    </article>
  );
}
