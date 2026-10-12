"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra content pinned to the bottom (action buttons). */
  footer?: React.ReactNode;
  className?: string;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: ModalProps) {
  // Escape closes the dialog; lock background scroll while open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50",
          className
        )}
      >
        {/* Always-visible close button, pinned above the scroll area */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-20 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* Body scrolls; the close button stays put. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {title && (
            <h2 className="mb-4 pr-8 text-sm font-semibold text-zinc-100">
              {title}
            </h2>
          )}

          {children}

          {footer && (
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
