"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Reusable, jitter-free pointer drag controller.
 *
 * - Locks the event stream with `setPointerCapture` so fast pointer moves that
 *   leave the element (or the whole track) never drop the drag.
 * - Keeps the live drag state in a ref and coalesces preview updates with
 *   `requestAnimationFrame`, so heavy React renders can't lag the cursor.
 * - Releases capture on up/cancel and runs `onEnd` once with the final delta.
 */
export type PointerDragInfo = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** Latest pointer position (client coords). */
  clientX: number;
  clientY: number;
  /** Total movement since pointerdown, in pixels. */
  dx: number;
  dy: number;
  /** True once the movement passed the activation threshold. */
  moved: boolean;
};

export type PointerDragHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
};

type PointerDragOptions = {
  /** Pixels of movement before a drag is considered to have started. */
  threshold?: number;
  onStart?: (info: PointerDragInfo, event: ReactPointerEvent<HTMLElement>) => void;
  /** Called at most once per animation frame while dragging. */
  onDrag?: (info: PointerDragInfo) => void;
  /** Always called once on release (after any pending frame is cancelled). */
  onEnd?: (info: PointerDragInfo) => void;
};

export function usePointerDrag(options: PointerDragOptions): PointerDragHandlers {
  const optionsRef = useRef(options);
  // Keep the latest callbacks without reading/writing refs during render.
  useEffect(() => {
    optionsRef.current = options;
  });

  const infoRef = useRef<PointerDragInfo | null>(null);
  const rafRef = useRef(0);

  const flush = useCallback(() => {
    rafRef.current = 0;
    const info = infoRef.current;
    if (info?.moved) optionsRef.current.onDrag?.(info);
  }, []);

  const release = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const info = infoRef.current;
    if (!info) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    infoRef.current = null;
    optionsRef.current.onEnd?.(info);
  }, []);

  return useMemo<PointerDragHandlers>(
    () => ({
      onPointerDown: (event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const info: PointerDragInfo = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          clientX: event.clientX,
          clientY: event.clientY,
          dx: 0,
          dy: 0,
          moved: false,
        };
        infoRef.current = info;
        optionsRef.current.onStart?.(info, event);
      },
      onPointerMove: (event) => {
        const info = infoRef.current;
        if (!info || event.pointerId !== info.pointerId) return;
        info.clientX = event.clientX;
        info.clientY = event.clientY;
        info.dx = event.clientX - info.startClientX;
        info.dy = event.clientY - info.startClientY;
        const threshold = optionsRef.current.threshold ?? 4;
        if (!info.moved && Math.hypot(info.dx, info.dy) < threshold) return;
        info.moved = true;
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(flush);
      },
      onPointerUp: release,
      onPointerCancel: release,
    }),
    [flush, release]
  );
}

/**
 * Maps a client X coordinate to a timeline time. `laneRect` is the scrollable
 * lane's bounding rect (already includes scroll offset) and `pps` is the zoom
 * (pixels per second), so the result is correct at any zoom/scroll position.
 */
export function clientXToTime(
  clientX: number,
  laneRect: DOMRect,
  pps: number
): number {
  if (pps <= 0) return 0;
  return (clientX - laneRect.left) / pps;
}

/** Clamps a timeline start so a clip can never move before 0 (overlaps allowed). */
export function clampTimelineStart(start: number): number {
  return Math.max(0, start);
}
