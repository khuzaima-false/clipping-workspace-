"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  Clapperboard,
  Clock,
  Coins,
  Download,
  Film,
  FolderKanban,
  LogIn,
  Plus,
  RefreshCw,
  Scissors,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProjectsStore } from "@/store/projects";
import { useWorkspaceStore } from "@/store/workspace";
import { BASE_DAILY_CREDITS, dailyCreditLimit } from "@/lib/credits";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  "in-progress": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  ready: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  exported: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
};

const WORKFLOW = [
  { icon: Upload, label: "Import raw footage" },
  { icon: Scissors, label: "Trim and mark highlight points" },
  { icon: Clapperboard, label: "Assemble clip timeline" },
  { icon: Film, label: "Export GPU-accelerated MP4 (1080p)" },
];

/** Reads the first finite numeric settings key present on a project. */
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
  const seconds = Math.round(totalSeconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function DashboardPage() {
  const projects = useProjectsStore((state) => state.projects);
  const loading = useProjectsStore((state) => state.loading);
  const error = useProjectsStore((state) => state.error);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  const profile = useWorkspaceStore((state) => state.profile);
  const channels = useWorkspaceStore((state) => state.channels);
  const loadProfile = useWorkspaceStore((state) => state.loadProfile);
  const loadChannels = useWorkspaceStore((state) => state.loadChannels);

  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Track the signed-in user so the dashboard can gate on authentication.
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Unauthenticated visitors are sent to the sign-in page.
  useEffect(() => {
    if (authChecked && !user) {
      router.push("/login");
    }
  }, [authChecked, user, router]);

  // Data loads through external stores (no setState-in-effect).
  useEffect(() => {
    void loadProjects();
    void loadProfile();
    void loadChannels();
  }, [loadProjects, loadProfile, loadChannels]);

  const channelNameById = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach((channel) => map.set(channel.id, channel.name));
    return map;
  }, [channels]);

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const loggedExports = projects.reduce((sum, p) => sum + exportCountOf(p), 0);
    const exportedProjects = projects.filter(
      (p) => p.status === "exported"
    ).length;
    const totalSeconds = projects.reduce(
      (sum, p) => sum + durationSecondsOf(p),
      0
    );
    return {
      totalProjects,
      // Prefer explicit export counts; fall back to exported-status projects.
      totalExports: loggedExports > 0 ? loggedExports : exportedProjects,
      totalSeconds,
    };
  }, [projects]);

  const recentProjects = useMemo(() => projects.slice(0, 5), [projects]);

  const creditLimit = profile
    ? dailyCreditLimit(profile.referral_count, profile.is_founding_user)
    : BASE_DAILY_CREDITS;
  const creditsRemaining = profile?.daily_credits ?? null;
  const creditPercent =
    creditsRemaining === null
      ? 0
      : Math.min(100, Math.round((creditsRemaining / creditLimit) * 100));

  const statCards = [
    {
      label: "Total Projects",
      value: String(stats.totalProjects),
      hint: "clips in your workspace",
      icon: FolderKanban,
      accent: "text-violet-400",
    },
    {
      label: "Exports (1080p)",
      value: String(stats.totalExports),
      hint: "completed renders",
      icon: Download,
      accent: "text-sky-400",
    },
    {
      label: "Processed duration",
      value: formatDuration(stats.totalSeconds),
      hint: "total video length",
      icon: Clock,
      accent: "text-emerald-400",
    },
  ];

  // Show a clear sign-in CTA while the redirect to /login is in flight.
  if (authChecked && !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400 ring-1 ring-inset ring-violet-500/25">
          <LogIn className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-base font-medium text-zinc-100">
            You&apos;re signed out
          </p>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Sign in to view your dashboard, projects, and export credits.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Overview of your clipping pipeline across all channels.
          </p>
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center justify-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New project
        </Link>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadProjects()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="glass-card rounded-xl p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {stat.label}
                </p>
                <Icon className={`h-4 w-4 ${stat.accent}`} aria-hidden />
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
                {loading ? <Skeleton className="h-8 w-16" /> : stat.value}
              </p>
              <p className="mt-1 text-xs text-zinc-600">{stat.hint}</p>
            </div>
          );
        })}

        {/* Daily credits remaining */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Daily Credits Remaining
            </p>
            <Coins className="h-4 w-4 text-amber-400" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
            {creditsRemaining === null ? "—" : creditsRemaining}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-300"
              style={{ width: `${creditPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            of {creditLimit} remaining today
            {profile?.is_founding_user ? " · Founding" : ""}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent clips */}
        <div className="glass-card rounded-xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              Recent projects
            </h2>
            <Link
              href="/projects"
              className="text-xs text-violet-400 transition-colors hover:text-violet-300"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <ul className="divide-y divide-zinc-800/70">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-10 w-16 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </li>
              ))}
            </ul>
          ) : recentProjects.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400 ring-1 ring-inset ring-violet-500/25">
                <Clapperboard className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  No projects yet
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                  Create a project to start clipping, captioning, and exporting
                  1080p videos.
                </p>
              </div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Create New Project
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/70">
              {recentProjects.map((project) => {
                const channelName = project.channel_id
                  ? channelNameById.get(project.channel_id)
                  : null;
                const clipSeconds = durationSecondsOf(project);
                const meta = [
                  channelName ?? "No channel",
                  new Date(project.created_at).toLocaleDateString(),
                  clipSeconds > 0 ? formatDuration(clipSeconds) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={project.id}>
                    <Link
                      href={`/editor?id=${project.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-900"
                    >
                      <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-500">
                        <Film className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">
                          {project.title}
                        </p>
                        <p className="truncate text-xs text-zinc-500">{meta}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${
                          STATUS_STYLES[project.status] ?? STATUS_STYLES.draft
                        }`}
                      >
                        {project.status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Workflow */}
        <div className="glass-card rounded-xl">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              Clipping workflow
            </h2>
          </div>
          <ul className="space-y-4 p-5">
            {WORKFLOW.map((task, index) => {
              const Icon = task.icon;
              return (
                <li key={task.label} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-400 ring-1 ring-inset ring-violet-500/25">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300">{task.label}</p>
                    <p className="text-xs text-zinc-600">Step {index + 1}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
