"use client";

import { useRef } from "react";
import {
  MAX_SPEED,
  MIN_SPEED,
  useEditorStore,
  type SpeedPoint,
} from "@/store/editor";

const W = 320;
const H = 168;
const PAD_X = 30;
const PAD_Y = 12;

/**
 * Labeled speed breakpoints. They are laid out at *even vertical steps* (a
 * piecewise-linear axis) so the low multipliers — 0.25x and 0.5x — stay
 * legible instead of collapsing into each other on a straight linear scale.
 */
const SPEED_TICKS = [0.25, 0.5, 1, 2, 3, 4, 5];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Speed multiplier → 0..1 vertical ratio on the piecewise-linear axis. */
function speedToRatio(speed: number): number {
  const s = clamp(speed, MIN_SPEED, MAX_SPEED);
  if (s <= SPEED_TICKS[0]) return 0;
  for (let i = 1; i < SPEED_TICKS.length; i += 1) {
    const hi = SPEED_TICKS[i];
    if (s <= hi) {
      const lo = SPEED_TICKS[i - 1];
      return (i - 1 + (s - lo) / (hi - lo)) / (SPEED_TICKS.length - 1);
    }
  }
  return 1;
}

/** Inverse of {@link speedToRatio}. */
function ratioToSpeed(ratio: number): number {
  const x = clamp(ratio, 0, 1) * (SPEED_TICKS.length - 1);
  const i = Math.min(Math.floor(x), SPEED_TICKS.length - 2);
  const lo = SPEED_TICKS[i];
  const hi = SPEED_TICKS[i + 1];
  return lo + (x - i) * (hi - lo);
}

/**
 * CapCut-style interactive velocity-curve editor. Click the graph to drop a
 * speed point, drag a node to fine-tune, double-click a node to remove it. The
 * curve feeds `speedPoints`, which the render/exporter integrate per frame.
 */
export function VelocityCurveEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<number | null>(null);

  const points = useEditorStore((s) => s.speedPoints);
  const duration = useEditorStore((s) => s.duration);
  const addSpeedPoint = useEditorStore((s) => s.addSpeedPoint);
  const updateSpeedPoint = useEditorStore((s) => s.updateSpeedPoint);
  const removeSpeedPoint = useEditorStore((s) => s.removeSpeedPoint);
  const setSpeedPreset = useEditorStore((s) => s.setSpeedPreset);

  const span = duration > 0 ? duration : 10;
  const plotTop = PAD_Y;
  const plotBottom = H - PAD_Y;
  const toX = (time: number) =>
    PAD_X + (clamp(time, 0, span) / span) * (W - PAD_X * 2);
  const toY = (speed: number) =>
    plotBottom - speedToRatio(speed) * (plotBottom - plotTop);
  const yToSpeed = (y: number) =>
    clamp(
      ratioToSpeed((plotBottom - y) / (plotBottom - plotTop)),
      MIN_SPEED,
      MAX_SPEED
    );

  const clientToPoint = (clientX: number, clientY: number): SpeedPoint => {
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return { time: 0, speed: 1 };
    }
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    return {
      time: clamp(((x - PAD_X) / (W - PAD_X * 2)) * span, 0, span),
      speed: yToSpeed(y),
    };
  };

  const round = (value: number) => Math.round(value * 100) / 100;

  const onBackgroundDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = clientToPoint(event.clientX, event.clientY);
    addSpeedPoint({ time: round(point.time), speed: round(point.speed) });
  };

  const onPointDown = (
    event: React.PointerEvent<SVGCircleElement>,
    index: number
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = index;
  };
  const onPointMove = (event: React.PointerEvent<SVGCircleElement>) => {
    const index = dragRef.current;
    if (index === null) return;
    const point = clientToPoint(event.clientX, event.clientY);
    updateSpeedPoint(index, { time: round(point.time), speed: round(point.speed) });
  };
  const onPointUp = (event: React.PointerEvent<SVGCircleElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.time).toFixed(2)} ${toY(p.speed).toFixed(2)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Velocity Curve
        </span>
        <button
          type="button"
          onClick={() => setSpeedPreset("none")}
          className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          Reset
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none rounded-lg bg-zinc-950 ring-1 ring-inset ring-zinc-800"
        onPointerDown={onBackgroundDown}
      >
        <defs>
          <linearGradient id="velgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal speed reference lines + labels (evenly stepped axis) */}
        {SPEED_TICKS.map((speed) => (
          <g key={speed} pointerEvents="none">
            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={toY(speed)}
              y2={toY(speed)}
              stroke={speed === 1 ? "#52525b" : "#27272a"}
              strokeWidth={speed === 1 ? 1.2 : 0.6}
              strokeDasharray={speed === 1 ? "" : "3 3"}
            />
            <text
              x={PAD_X - 6}
              y={toY(speed) + 3}
              textAnchor="end"
              fontSize="8.5"
              fill={speed === 1 ? "#a1a1aa" : "#71717a"}
            >
              {speed}x
            </text>
          </g>
        ))}

        {/* area under curve */}
        <path
          d={`M ${toX(first?.time ?? 0)} ${toY(1)} ${points
            .map((p) => `L ${toX(p.time).toFixed(2)} ${toY(p.speed).toFixed(2)}`)
            .join(" ")} L ${toX(last?.time ?? span)} ${toY(1)} Z`}
          fill="url(#velgrad)"
        />

        {/* curve */}
        <path d={path} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" />

        {/* nodes */}
        {points.map((p, index) => (
          <circle
            key={`kf-${index}`}
            cx={toX(p.time)}
            cy={toY(p.speed)}
            r="6"
            fill="#0b0b12"
            stroke="#c4b5fd"
            strokeWidth="2"
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => onPointDown(e, index)}
            onPointerMove={onPointMove}
            onPointerUp={onPointUp}
            onPointerCancel={onPointUp}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (points.length > 1) removeSpeedPoint(index);
            }}
          />
        ))}
      </svg>

      <p className="text-[10px] leading-4 text-zinc-600">
        Click the graph to add a speed point · drag to fine-tune · double-click a
        point to remove. {points.length} keyframe{points.length === 1 ? "" : "s"} ·
        range {MIN_SPEED}×–{MAX_SPEED}×.
      </p>
    </div>
  );
}
