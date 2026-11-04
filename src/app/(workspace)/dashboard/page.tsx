"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Clapperboard,
  Clock,
  Download,
  FolderKanban,
  HardDrive,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsTauri } from "@/hooks/use-is-tauri";
import { isTauriEnvironment } from "@/lib/tauri";
import { useProjectsStore } from "@/store/projects";
import { useWorkspaceStore } from "@/store/workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/ui/logo";
import { AuthModal } from "@/components/auth/auth-modal";
import { NewProjectModal } from "@/components/projects/new-project-modal";
import { ProjectCard } from "@/components/projects/project-card";
import type { Project } from "@/types/database";

const FILTERS = ["all", "draft", "in-progress", "ready", "exported"] as const;
type Filter = (typeof FILTERS)[number];

function settingsNumber(project: Project, keys: string[]): number {
  for (const key of keys) {
    const value = project.settings?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function exportCountOf(project: Project): number {
  return settingsNumber(project, ["exportCount", "exports"]);
}

function durationSecondsOf(project: Project): number {
  return settingsNumber(project, ["durationSeconds", "duration"]);
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 1) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[250px] flex-col items-center justify-center gap-4 rounded-md border border-dashed border-studio-border bg-[#15161a] p-6 text-center transition-colors hover:border-violet-500/60 hover:bg-violet-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-studio-border bg-studio-panel text-violet-300 transition-colors group-hover:border-violet-500/50 group-hover:bg-violet-500/10">
        <Plus className="h-5 w-5" aria-hidden />
      </span>
      <span>
        <span className="block text-sm font-semibold text-zinc-100">
          Create New Project
        </span>
        <span className="mt-1 block max-w-56 text-[11px] leading-5 text-zinc-500">
          Start with app storage, choose a custom folder, or create a new folder
          on your Desktop.
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-300">
        Start a project
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const desktop = useIsTauri();
  const { isAuthenticated, loading: authLoading, isLocalDesktop } = useAuth();

  const projects = useProjectsStore((state) => state.projects);
  const loading = useProjectsStore((state) => state.loading);
  const error = useProjectsStore((state) => state.error);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  const channels = useWorkspaceStore((state) => state.channels);
  const loadProfile = useWorkspaceStore((state) => state.loadProfile);
  const loadChannels = useWorkspaceStore((state) => state.loadChannels);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [cloudLinked, setCloudLinked] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // The dashboard is the desktop project manager. Web visitors are sent back
  // to the homepage instead of the removed web-only dashboard.
  useEffect(() => {
    if (!isTauriEnvironment()) {
      router.replace("/");
      return;
    }
  }, [router]);

  // The web dashboard remains a signed-in surface. The packaged app is local
  // first and must never be sent to the web login wall.
  useEffect(() => {
    if (isTauriEnvironment()) return;
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    void loadProjects();
    if (!isTauriEnvironment() && isAuthenticated) {
      void loadProfile();
      void loadChannels();
    }
  }, [loadProjects, loadProfile, loadChannels, isAuthenticated]);

  const channelNameById = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach((channel) => map.set(channel.id, channel.name));
    return map;
  }, [channels]);

  const stats = useMemo(() => {
    const loggedExports = projects.reduce(
      (sum, project) => sum + exportCountOf(project),
      0
    );
    const exported = projects.filter((project) => project.status === "exported").length;
    const totalSeconds = projects.reduce(
      (sum, project) => sum + durationSecondsOf(project),
      0
    );
    return {
      total: projects.length,
      exports: loggedExports > 0 ? loggedExports : exported,
      duration: totalSeconds,
      local: projects.filter((project) => project.id.startsWith("local-")).length,
    };
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects
      .filter((project) => filter === "all" || project.status === filter)
      .filter(
        (project) =>
          !needle || project.title.toLowerCase().includes(needle)
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
  }, [projects, filter, query]);

  const statCards = [
    {
      label: "Projects",
      value: String(stats.total),
      hint: `${stats.local} local · ${Math.max(0, stats.total - stats.local)} cloud`,
      icon: FolderKanban,
      accent: "text-violet-400",
    },
    {
      label: "Exports",
      value: String(stats.exports),
      hint: "completed renders",
      icon: Download,
      accent: "text-sky-400",
    },
    {
      label: "Processed duration",
      value: formatDuration(stats.duration),
      hint: "total video length",
      icon: Clock,
      accent: "text-emerald-400",
    },
    {
      label: "Rendering",
      value: "Unlimited",
      hint: "client-side · no credits",
      icon: Sparkles,
      accent: "text-amber-300",
    },
  ];

  return (
    <div className="space-y-6">
      {desktop && (
        <div className="flex items-center gap-2 border-b border-studio-border pb-3">
          <Logo size="sm" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Studio
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-panel px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              <HardDrive className="h-3 w-3 text-emerald-400" aria-hidden />
              {desktop ? "Desktop workspace" : "Web workspace"}
            </span>
            {isLocalDesktop && (
              <span className="rounded-full border border-studio-border bg-studio-panel px-2.5 py-1 text-[10px] text-zinc-500">
                Local-first
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">
            Project Manager
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Recent work, local projects, and cloud sessions in one place. Choose
            app storage, a custom folder, or a new Desktop folder when you start.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(!isAuthenticated && !isLocalDesktop) || isLocalDesktop ? (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              disabled={authLoading}
              className="inline-flex items-center gap-2 rounded-md border border-studio-border bg-studio-panel px-3.5 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-violet-500/60 hover:text-white disabled:opacity-60"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden />
              {isLocalDesktop
                ? cloudLinked
                  ? "Cloud linked"
                  : "Cloud sign-in"
                : "Sign in"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </button>
        </div>
      </div>

      {error && projects.length > 0 && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="flex items-start gap-2 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadProjects()}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-red-200 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="studio-panel p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {stat.label}
                </p>
                <Icon className={`h-4 w-4 ${stat.accent}`} aria-hidden />
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                {loading ? <Skeleton className="h-7 w-16" /> : stat.value}
              </div>
              <p className="mt-1 truncate text-[10px] text-zinc-600">
                {stat.hint}
              </p>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-studio-border bg-[#15161a] p-2.5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded border border-studio-border bg-[#121316] px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
          <span className="sr-only">Search projects</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects…"
            className="min-w-0 flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        </label>
        <div
          role="group"
          aria-label="Filter projects by status"
          className="flex flex-wrap items-center gap-1"
        >
          {FILTERS.map((value) => {
            const selected = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(value)}
                className={`rounded px-2.5 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                  selected
                    ? "bg-violet-600/20 text-violet-200 ring-1 ring-inset ring-violet-500/40"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {value === "all" ? "All" : value.replace("-", " ")}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="studio-panel p-4">
              <Skeleton className="h-28 w-full rounded-md" />
              <Skeleton className="mt-4 h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      ) : error && projects.length === 0 ? (
        <div className="studio-panel flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertCircle className="h-6 w-6 text-red-400" aria-hidden />
          <p className="text-sm font-medium text-zinc-200">
            Could not load projects
          </p>
          <p className="max-w-md text-xs text-zinc-500">{error}</p>
          <button
            type="button"
            onClick={() => void loadProjects()}
            className="inline-flex items-center gap-1.5 rounded-md border border-studio-border px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      ) : visibleProjects.length === 0 && !query && filter === "all" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <NewProjectCard onClick={() => setNewProjectOpen(true)} />
          <div className="studio-panel col-span-full flex min-h-44 flex-col items-center justify-center gap-3 p-8 text-center sm:col-span-1 xl:col-span-2">
            <Clapperboard className="h-6 w-6 text-zinc-600" aria-hidden />
            <p className="text-sm font-medium text-zinc-200">No projects yet</p>
            <p className="max-w-sm text-xs leading-5 text-zinc-500">
              Create a project to start cutting clips, grading colour, and
              exporting locally.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <NewProjectCard onClick={() => setNewProjectOpen(true)} />
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              channelName={
                project.channel_id
                  ? channelNameById.get(project.channel_id) ?? null
                  : null
              }
            />
          ))}
          {visibleProjects.length === 0 && (
            <div className="studio-panel col-span-full p-8 text-center text-xs text-zinc-500">
              No projects match this search or status filter.
            </div>
          )}
        </div>
      )}

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={(projectId) => {
          setNewProjectOpen(false);
          router.push(`/editor?id=${encodeURIComponent(projectId)}`);
        }}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => {
          setCloudLinked(true);
          void loadProjects();
        }}
      />
    </div>
  );
}
