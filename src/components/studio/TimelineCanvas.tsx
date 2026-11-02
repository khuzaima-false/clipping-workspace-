"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shell for the timeline page. The existing PremiereTimeline (track headers,
 * ruler, clip drag/trim/ripple logic) is rendered as the child so persistence,
 * undo/redo and pointer interactions stay untouched.
 */
export function TimelineCanvas({
  children,
  className,
  height,
}: {
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  const style: CSSProperties | undefined = height
    ? { height: `${height}px` }
    : undefined;
  return (
    <section
      data-tour="timeline-canvas"
      aria-label="Timeline canvas"
      style={style}
      className={cn(
        "flex h-[var(--studio-timeline-h)] min-h-0 shrink-0 flex-col overflow-hidden border-t border-studio-border bg-studio-bg",
        className
      )}
    >
      {children}
    </section>
  );
}
