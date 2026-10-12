"use client";

import { useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra content pinned to the bottom (action buttons). */
  footer?: React.ReactNode;
  className?: string;
  /** Render a centered downward-arrow "handle" close button on the bottom edge. */
  bottomClose?: boolean;
  /** Accessible label for the bottom handle (defaults to "Close dialog"). */
  bottomCloseLabel?: string;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
  bottomClose = false,
  bottomCloseLabel = "Close dialog",
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

      {/* Relative wrapper so the bottom handle can sit on the box's border */}
      <div className="relative z-10 w-full max-w-lg">
        <div
          className={cn(
            "relative flex max-h-[90vh] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50",
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

          {/* Body scrolls; the close buttons stay put. */}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              bottomClose && "pb-6"
            )}
          >
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

        {bottomClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={bottomCloseLabel}
            className="absolute -bottom-4 left-1/2 z-20 flex h-8 w-12 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 shadow-md transition-all hover:scale-105 hover:bg-zinc-700 hover:text-white"
          >
            <ChevronDown className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
