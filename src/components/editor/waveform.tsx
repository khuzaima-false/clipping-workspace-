"use client";

import { useEffect, useRef } from "react";

/**
 * Tiny canvas waveform preview for an audio buffer. Draws per-pixel peaks so
 * recorded voiceovers and imported tracks get an instant visual shape.
 */
export function Waveform({
  buffer,
  className,
  height = 40,
}: {
  buffer: AudioBuffer | null;
  className?: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!buffer || buffer.length === 0) {
      ctx.fillStyle = "#3f3f46";
      ctx.fillRect(0, h / 2 - 1, w, 2);
      return;
    }

    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = h / 2;
    ctx.fillStyle = "#a78bfa";
    for (let x = 0; x < w; x++) {
      let peak = 0;
      const start = x * step;
      for (let i = 0; i < step; i++) {
        const value = Math.abs(data[start + i] ?? 0);
        if (value > peak) peak = value;
      }
      const bar = Math.max(1, peak * (h - 2));
      ctx.fillRect(x, mid - bar / 2, 1, bar);
    }
  }, [buffer]);

  return <canvas ref={ref} width={240} height={height} className={className} aria-hidden />;
}
