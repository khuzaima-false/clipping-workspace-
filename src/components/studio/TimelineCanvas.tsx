"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shell for the timeline page. The existing PremiereTimeline (track headers,
 * ruler, clip drag/trim/ripple logic) is rendered as the child so persistence,
 * undo/redo and pointer interactions stay untouched.
 */
export function TimelineCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-tour="timeline-canvas"
      aria-label="Timeline canvas"
      className={cn(
        "min-h-0 shrink-0 border-t border-studio-border bg-studio-bg",
        className
      )}
    >
      {children}
    </section>
  );
}
