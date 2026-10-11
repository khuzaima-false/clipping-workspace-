"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Clapperboard,
  Coins,
  Film,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_CREATE_CREDIT_COST } from "@/lib/credits";
import { useWorkspaceStore } from "@/store/workspace";
import { useProjectsStore } from "@/store/projects";
import type { Project } from "@/types/database";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  "in-progress": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  ready: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  exported: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
};

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

export default function ProjectsPage() {
  const router = useRouter();
  const {
    channels,
    loadChannels,
    activeChannelId,
    setActiveChannel,
    consumeCredits,
  } = useWorkspaceStore();

  const projects = useProjectsStore((state) => state.projects);
  const loading = useProjectsStore((state) => state.loading);
  const error = useProjectsStore((state) => state.error);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Projects load through the external store (subscribed, not fetched
  // into component state from an effect).
  useEffect(() => {
    void loadChannels();
    void loadProjects();
  }, [loadChannels, loadProjects]);

  const channelNameById = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach((channel) => map.set(channel.id, channel.name));
    return map;
  }, [channels]);

  const visibleProjects = useMemo(() => {
    if (!activeChannelId) return projects;
    return projects.filter((p) => p.channel_id === activeChannelId);
  }, [projects, activeChannelId]);

  const activeChannelName = activeChannelId
    ? channelNameById.get(activeChannelId) ?? "unknown channel"
    : null;

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      setCreateError("Project title is required.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to create a project.");

      // Charge for the new project before it is created.
      const charge = await consumeCredits(PROJECT_CREATE_CREDIT_COST);
      if (!charge.ok) {
        throw new Error(
          charge.reason === "insufficient"
            ? `Creating a project costs ${PROJECT_CREATE_CREDIT_COST} credits and you're out of credits for today. Check back after the UTC reset, or invite friends for more.`
            : charge.error ?? "Could not verify your credits. Please try again."
        );
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title,
          channel_id: newChannelId || null,
          status: "draft",
          settings: {},
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      setCreateOpen(false);
      setNewTitle("");
      setNewChannelId("");
      router.push(`/editor?id=${data.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create project."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renaming) return;
    const title = renameTitle.trim();
    if (!title) {
      setRenameError("Project title cannot be empty.");
      return;
    }

    setRenameBusy(true);
    setRenameError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const { error } = await supabase
        .from("projects")
        .update({ title })
        .eq("id", renaming.id)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);

      setRenaming(null);
      await loadProjects();
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Failed to rename project."
      );
    } finally {
      setRenameBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", deleting.id)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);

      setDeleting(null);
      await loadProjects();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete project."
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Clipping projects, timelines, and export queues.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setNewTitle("");
            setNewChannelId(activeChannelId ?? "");
            setCreateOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create New Project
        </button>
      </div>

      {activeChannelId && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200">
          <span>
            Showing projects for <strong>{activeChannelName}</strong>
          </span>
          <button
            type="button"
            onClick={() => setActiveChannel(null)}
            className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 px-2 py-1 font-medium transition-colors hover:bg-violet-500/20"
          >
            <X className="h-3 w-3" aria-hidden />
            Show all channels
          </button>
        </div>
      )}

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

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-5"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-4 w-24" />
              <Skeleton className="mt-5 h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : visibleProjects.length === 0 && !error ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400 ring-1 ring-inset ring-violet-500/25">
            <Clapperboard className="h-5.5 w-5.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {activeChannelId
                ? "No projects for this channel"
                : "No projects yet"}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              {activeChannelId
                ? "Clear the channel filter or start a new project for it."
                : "Projects hold your clips, timeline, and 1080p export settings."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setNewTitle("");
              setNewChannelId(activeChannelId ?? "");
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => {
            const channelName = project.channel_id
              ? channelNameById.get(project.channel_id)
              : null;

            return (
              <article
                key={project.id}
                className="flex flex-col glass-card rounded-xl p-5 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-zinc-100">
                      {project.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Created{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                      STATUS_STYLES[project.status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-1 items-end">
                  <span
                    className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border px-2.5 py-1.5 text-xs ${
                      channelName
                        ? "border-zinc-700 bg-zinc-800/70 text-zinc-300"
                        : "border-zinc-800 bg-zinc-950 text-zinc-600"
                    }`}
                  >
                    <Film className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {channelName ?? "No channel"}
                    </span>
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-zinc-800 pt-4">
                  <button
                    type="button"
                    onClick={() => router.push(`/editor?id=${project.id}`)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600/90 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameError(null);
                      setRenameTitle(project.title);
                      setRenaming(project);
                    }}
                    aria-label={`Rename ${project.title}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(project);
                    }}
                    aria-label={`Delete ${project.title}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create project */}
      <Modal
        open={createOpen}
        title="Create new project"
        onClose={() => (creating ? undefined : setCreateOpen(false))}
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="project-title"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              Project Title <span className="text-violet-400">*</span>
            </label>
            <input
              id="project-title"
              name="title"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="October highlight reel"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="project-channel"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              Select Channel
            </label>
            <select
              id="project-channel"
              name="channel_id"
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              className={inputClass}
            >
              <option value="">No channel (optional)</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} · {channel.platform}
                </option>
              ))}
            </select>
            {channels.length === 0 && (
              <p className="mt-1.5 text-xs text-zinc-500">
                No channels yet — add one on the Channels page to tag projects.
              </p>
            )}
          </div>

          {createError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
            >
              {createError}
            </p>
          )}

          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Coins className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            Creating a project costs {PROJECT_CREATE_CREDIT_COST} credits.
          </p>

          <button
            type="submit"
            disabled={creating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create project"}
          </button>
        </form>
      </Modal>

      {/* Rename project */}
      <Modal
        open={renaming !== null}
        title="Rename project"
        onClose={() => (renameBusy ? undefined : setRenaming(null))}
      >
        <form onSubmit={handleRename} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="rename-title"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              Project Title <span className="text-violet-400">*</span>
            </label>
            <input
              id="rename-title"
              name="title"
              required
              autoFocus
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          {renameError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
            >
              {renameError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setRenaming(null)}
              disabled={renameBusy}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={renameBusy}
              className="rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
            >
              {renameBusy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete project"
        message={`Delete “${deleting?.title ?? ""}” and its settings? This cannot be undone.`}
        confirmLabel="Delete project"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
