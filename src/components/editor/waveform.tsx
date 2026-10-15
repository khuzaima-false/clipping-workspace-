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

/**
 * Timeline waveform drawn from pre-computed peaks (see `waveform-peaks.ts`).
 *
 * `sliceStart`/`sliceEnd` are 0..1 fractions of the *source* so a trimmed clip
 * shows the exact region it plays, and every lane block can reuse one array.
 */
export function TimelineWaveform({
  peaks,
  sliceStart = 0,
  sliceEnd = 1,
  className,
  color = "#5eead4",
}: {
  peaks: number[] | undefined;
  sliceStart?: number;
  sliceEnd?: number;
  className?: string;
  color?: string;
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
    if (!peaks || peaks.length === 0) return;

    const from = Math.max(0, Math.min(sliceStart, 1));
    const to = Math.max(from + 1e-4, Math.min(sliceEnd, 1));
    const mid = h / 2;
    ctx.fillStyle = color;
    for (let x = 0; x < w; x += 1) {
      const t = from + ((to - from) * x) / w;
      const index = Math.min(peaks.length - 1, Math.floor(t * peaks.length));
      const peak = peaks[index] ?? 0;
      const bar = Math.max(1, peak * (h - 2));
      ctx.fillRect(x, mid - bar / 2, 1, bar);
    }
  }, [peaks, sliceStart, sliceEnd, color]);

  return (
    <canvas
      ref={ref}
      width={600}
      height={32}
      className={className}
      aria-hidden
    />
  );
}
