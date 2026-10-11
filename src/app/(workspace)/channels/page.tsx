"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Mail,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace";
import type { Channel } from "@/types/database";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChannelForm, type ChannelFormValues } from "@/components/channels/channel-form";
import { Skeleton } from "@/components/ui/skeleton";

const PLATFORM_STYLES: Record<string, string> = {
  YouTube: "bg-red-500/15 text-red-400 ring-red-500/30",
  TikTok: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30",
  Instagram: "bg-fuchsia-500/15 text-fuchsia-400 ring-fuchsia-500/30",
};

const COLUMN_MISSING_HINT =
  "Your Supabase channels table is missing the channel_email column. Run supabase/migrations/0001_add_channel_email.sql in the SQL editor, then retry.";

function isColumnMissing(error: { message: string; code?: string | null }) {
  return (
    error.message.includes("channel_email") ||
    error.code === "PGRST204" ||
    error.code === "42703"
  );
}

export default function ChannelsPage() {
  const {
    channels,
    channelsLoading,
    channelsError,
    loadChannels,
  } = useWorkspaceStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState<Channel | null>(null);

  const [saving, setSaving] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = useCallback(
    () => loadChannels({ force: true }),
    [loadChannels]
  );

  useEffect(() => {
    void loadChannels({ force: true });
  }, [loadChannels]);

  async function handleCreate(values: ChannelFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to add a channel.");

      // `channel_email` only ships when set: the column may not exist in the
      // deployed schema yet (supabase/migrations/0001_add_channel_email.sql).
      const payload: Record<string, unknown> = {
        user_id: user.id,
        name: values.name,
        platform: values.platform,
        niche: values.niche || null,
        url: values.url || null,
        notes: values.notes || null,
      };
      if (values.channel_email) {
        payload.channel_email = values.channel_email;
      }

      const { error } = await supabase.from("channels").insert(payload);

      if (error) {
        throw new Error(
          isColumnMissing(error) ? COLUMN_MISSING_HINT : error.message
        );
      }

      setCreateOpen(false);
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create channel."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(values: ChannelFormValues) {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to edit a channel.");

      // Include channel_email only when it changes, so edits keep working
      // before the migration adds the column.
      const update: Record<string, unknown> = {
        name: values.name,
        platform: values.platform,
        niche: values.niche || null,
        url: values.url || null,
        notes: values.notes || null,
      };
      if (values.channel_email || editing.channel_email) {
        update.channel_email = values.channel_email;
      }

      const { error } = await supabase
        .from("channels")
        .update(update)
        .eq("id", editing.id)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(
          isColumnMissing(error) ? COLUMN_MISSING_HINT : error.message
        );
      }

      setEditing(null);
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update channel."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to delete a channel.");

      const { error } = await supabase
        .from("channels")
        .delete()
        .eq("id", deleting.id)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);

      setDeleting(null);
      await refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete channel."
      );
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Channels
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage the channels you clip for.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setCreateOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add Channel
        </button>
      </div>

      {channelsError && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {channelsError}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {channelsLoading && channels.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-5"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-3 h-4 w-24" />
              <Skeleton className="mt-5 h-3.5 w-full" />
              <Skeleton className="mt-2 h-3.5 w-2/3" />
            </div>
          ))}
        </div>
      ) : channels.length === 0 && !channelsError ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400 ring-1 ring-inset ring-violet-500/25">
            <Radio className="h-5.5 w-5.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-200">
              No channels yet
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              Channels keep your projects organized by destination. Add the
              first one to get started.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add Your First Channel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel) => (
            <article
              key={channel.id}
              className="flex flex-col glass-card rounded-xl p-5 transition-colors hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-zinc-100">
                    {channel.name}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {channel.niche || "No niche set"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    PLATFORM_STYLES[channel.platform] ??
                    PLATFORM_STYLES.TikTok
                  }`}
                >
                  {channel.platform}
                </span>
              </div>

              <div className="mt-4 flex flex-1 flex-col gap-2 text-xs text-zinc-500">
                {channel.url && (
                  <a
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 truncate text-zinc-400 hover:text-violet-400"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{channel.url}</span>
                  </a>
                )}
                {channel.channel_email && (
                  <span className="inline-flex items-center gap-1.5 truncate text-zinc-400">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{channel.channel_email}</span>
                  </span>
                )}
                <span>
                  Added {new Date(channel.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setEditing(channel);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(channel);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create channel */}
      <Modal
        open={createOpen}
        title="Add channel"
        onClose={() => (saving ? undefined : setCreateOpen(false))}
      >
        <ChannelForm
          submitLabel="Create channel"
          busy={saving}
          error={formError}
          onSubmit={handleCreate}
        />
      </Modal>

      {/* Edit channel */}
      <Modal
        open={editing !== null}
        title="Edit channel"
        onClose={() => (saving ? undefined : setEditing(null))}
      >
        {editing && (
          <ChannelForm
            initialValues={editing}
            submitLabel="Save changes"
            busy={saving}
            error={formError}
            onSubmit={handleEdit}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete channel"
        message={`Delete “${deleting?.name ?? ""}”? Projects linked to it will be kept but unlinked. This cannot be undone.`}
        confirmLabel="Delete channel"
        busy={deletingBusy}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
