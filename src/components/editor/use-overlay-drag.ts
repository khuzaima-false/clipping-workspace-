"use client";

import { useRef } from "react";
import { hitTestOverlay } from "@/lib/render";
import { useEditorStore } from "@/store/editor";

type DragInfo = {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
};

/**
 * Lets the user grab a text/image overlay directly on the preview canvas and
 * reposition it (X/Y) on both desktop and touch devices. Returns pointer
 * handlers to spread onto the canvas plus `consumeDrag()`, which reports (and
 * clears) whether the last gesture was a drag so a tap-to-play can ignore it.
 */
export function useOverlayCanvasDrag(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const info = useRef<DragInfo | null>(null);
  const didDrag = useRef(false);

  const currentSceneTime = (): number => {
    const state = useEditorStore.getState();
    return state.videoEl ? state.videoEl.currentTime : state.currentTime;
  };

  const toCanvasPoint = (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * w,
      y: ((clientY - rect.top) / rect.height) * h,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = useEditorStore.getState();

    // Eyedropper mode: sample the pixel under the cursor as the key color.
    if (state.eyedropper) {
      const point = toCanvasPoint(event.clientX, event.clientY, canvas);
      try {
        const pixel = ctx.getImageData(
          Math.min(canvas.width - 1, Math.max(0, Math.floor(point.x))),
          Math.min(canvas.height - 1, Math.max(0, Math.floor(point.y))),
          1,
          1
        ).data;
        const hex = `#${[pixel[0], pixel[1], pixel[2]]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("")}`;
        state.setChromaKey({ color: hex, enabled: true });
      } catch {
        // Tainted canvas / read failure — just leave the color unchanged.
      }
      state.setEyedropper(false);
      return;
    }

    const { x, y } = toCanvasPoint(event.clientX, event.clientY, canvas);
    const hit = hitTestOverlay(
      ctx,
      state.overlays,
      canvas.width,
      canvas.height,
      currentSceneTime(),
      x,
      y
    );
    if (!hit) return;
    state.selectOverlay(hit.id);
    info.current = {
      id: hit.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: hit.x,
      originY: hit.y,
    };
    didDrag.current = false;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = info.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!didDrag.current && Math.hypot(dx, dy) < 3) return;
    didDrag.current = true;
    const x = Math.min(Math.max(drag.originX + (dx / rect.width) * 100, 0), 100);
    const y = Math.min(Math.max(drag.originY + (dy / rect.height) * 100, 0), 100);
    useEditorStore.getState().updateOverlay(drag.id, { x, y });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    info.current = null;
  };

  /** True when the previous gesture was a drag; resets the flag for the next tap. */
  const consumeDrag = () => {
    if (!didDrag.current) return false;
    didDrag.current = false;
    return true;
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    consumeDrag,
  };
}
