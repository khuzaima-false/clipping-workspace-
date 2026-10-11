"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  CHANNEL_PLATFORMS,
  type Channel,
  type ChannelPlatform,
} from "@/types/database";
import { checkChannelEmailOwnership } from "@/lib/channel-email-check";

export type ChannelFormValues = {
  name: string;
  platform: ChannelPlatform;
  niche: string;
  url: string;
  notes: string;
  channel_email: string | null;
};

export function toChannelFormValues(channel?: Channel): ChannelFormValues {
  return {
    name: channel?.name ?? "",
    platform: channel?.platform ?? "YouTube",
    niche: channel?.niche ?? "",
    url: channel?.url ?? "",
    notes: channel?.notes ?? "",
    channel_email: channel?.channel_email ?? "",
  };
}

type ChannelFormProps = {
  initialValues?: Channel;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (values: ChannelFormValues) => Promise<void>;
};

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
const labelClass = "mb-1.5 block text-sm font-medium text-zinc-300";

export function ChannelForm({
  initialValues,
  busy = false,
  error,
  submitLabel,
  onSubmit,
}: ChannelFormProps) {
  const [values, setValues] = useState<ChannelFormValues>(() =>
    toChannelFormValues(initialValues)
  );
  const [verifyEmail, setVerifyEmail] = useState(
    Boolean(initialValues?.channel_email)
  );
  const [checkState, setCheckState] = useState<{
    status: "idle" | "checking" | "passed" | "failed";
    reason: string;
  }>({ status: "idle", reason: "" });
  const [localError, setLocalError] = useState<string | null>(null);

  function update<K extends keyof ChannelFormValues>(
    key: K,
    value: ChannelFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === "channel_email") {
      setCheckState({ status: "idle", reason: "" });
    }
  }

  async function runOwnershipCheck() {
    const email = values.channel_email?.trim() ?? "";
    if (!email) {
      setCheckState({
        status: "failed",
        reason: "Enter a channel email first.",
      });
      return;
    }
    setCheckState({ status: "checking", reason: "" });
    const result = await checkChannelEmailOwnership(email);
    setCheckState({
      status: result.ok ? "passed" : "failed",
      reason: result.reason,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!values.name.trim()) {
      setLocalError("Channel name is required.");
      return;
    }

    if (verifyEmail) {
      const email = values.channel_email?.trim() ?? "";
      if (!email) {
        setLocalError("Enter a channel email to verify ownership.");
        return;
      }
      if (checkState.status !== "passed") {
        // Run the check now; block submit until it passes.
        setCheckState({ status: "checking", reason: "" });
        const result = await checkChannelEmailOwnership(email);
        setCheckState({
          status: result.ok ? "passed" : "failed",
          reason: result.reason,
        });
        if (!result.ok) {
          setLocalError("Ownership check failed — fix the email and retry.");
          return;
        }
      }
    }

    await onSubmit({
      ...values,
      name: values.name.trim(),
      niche: values.niche.trim(),
      url: values.url.trim(),
      notes: values.notes.trim(),
      channel_email: verifyEmail ? values.channel_email?.trim() || null : null,
    });
  }

  const shownError = localError ?? error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="channel-name" className={labelClass}>
          Channel Name <span className="text-violet-400">*</span>
        </label>
        <input
          id="channel-name"
          name="name"
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Forgevyn Main"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="channel-platform" className={labelClass}>
            Platform <span className="text-violet-400">*</span>
          </label>
          <select
            id="channel-platform"
            name="platform"
            value={values.platform}
            onChange={(e) =>
              update("platform", e.target.value as ChannelPlatform)
            }
            className={inputClass}
          >
            {CHANNEL_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="channel-niche" className={labelClass}>
            Niche
          </label>
          <input
            id="channel-niche"
            name="niche"
            value={values.niche}
            onChange={(e) => update("niche", e.target.value)}
            placeholder="Gaming highlights"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="channel-url" className={labelClass}>
          Channel URL <span className="text-zinc-500">(optional)</span>
        </label>
        <input
          id="channel-url"
          name="url"
          type="url"
          value={values.url}
          onChange={(e) => update("url", e.target.value)}
          placeholder="https://youtube.com/@forgevyn"
          className={inputClass}
        />
      </div>

      {/* Optional email ownership check */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={verifyEmail}
            onChange={(e) => {
              setVerifyEmail(e.target.checked);
              setCheckState({ status: "idle", reason: "" });
            }}
            className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-violet-600"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
              <ShieldCheck className="h-4 w-4 text-violet-400" aria-hidden />
              Verify channel email ownership
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Optional. Confirms the mailbox can receive ownership emails before
              saving.
            </span>
          </span>
        </label>

        {verifyEmail && (
          <div className="mt-3 space-y-2">
            <input
              id="channel-email"
              name="channel_email"
              type="email"
              value={values.channel_email ?? ""}
              onChange={(e) => update("channel_email", e.target.value)}
              placeholder="owner@channel.com"
              className={inputClass}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runOwnershipCheck}
                disabled={checkState.status === "checking" || busy}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                {checkState.status === "checking" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                )}
                Run ownership check
              </button>

              {checkState.status === "passed" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Passed
                </span>
              )}
              {checkState.status === "failed" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  Failed
                </span>
              )}
            </div>

            {checkState.reason && (
              <p
                className={`text-xs leading-5 ${
                  checkState.status === "passed"
                    ? "text-emerald-500/80"
                    : "text-zinc-500"
                }`}
              >
                {checkState.reason}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="channel-notes" className={labelClass}>
          Notes <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Posting schedule, brand colors, contact…"
          className={`${inputClass} resize-y`}
        />
      </div>

      {shownError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
        >
          {shownError}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {submitLabel}
      </button>
    </form>
  );
}
