"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "./modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = true,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? () => undefined : onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60 ${
              destructive
                ? "bg-red-600 hover:bg-red-500"
                : "bg-violet-600 hover:bg-violet-500"
            }`}
          >
            {busy && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            destructive
              ? "bg-red-500/15 text-red-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        </span>
        <p className="text-sm leading-6 text-zinc-300">{message}</p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
        >
          {error}
        </p>
      )}
    </Modal>
  );
}
