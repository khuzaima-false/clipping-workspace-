"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TOUR_CATEGORIES,
  buildFullTour,
  type TourStep,
} from "@/lib/tour";

type Rect = { x: number; y: number; w: number; h: number };

/** Spotlight padding around the target. */
const PAD = 8;
const TIP_W = 340;
const TIP_GAP = 14;
const EDGE = 12;
/** How long a target may be missing before the runner skips the step. */
const SKIP_AFTER_MS = 800;

function targetEl(key: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-tour="${key}"]`);
}

export function TutorialLauncher({ className }: { className?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [label, setLabel] = useState("Guided tour");
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tipH, setTipH] = useState(190);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef<string>("");

  const active = steps !== null;
  const step: TourStep | null = steps ? steps[index] ?? null : null;

  const exit = useCallback(() => {
    setSteps(null);
    setIndex(0);
    setRect(null);
    openedRef.current = "";
  }, []);

  const start = useCallback((next: TourStep[], name: string) => {
    setMenuOpen(false);
    setMenuPos(null);
    setLabel(name);
    setIndex(0);
    setRect(null);
    openedRef.current = "";
    setSteps(next.length > 0 ? next : null);
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (!steps) return;
      const next = index + delta;
      if (next < 0 || next >= steps.length) return;
      setIndex(next);
    },
    [steps, index]
  );

  /* --- menu anchoring ------------------------------------------------- */
  const openMenu = () => {
    const el = buttonRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setMenuPos({
        top: r.bottom + 8,
        left: Math.min(Math.max(r.right - 320, EDGE), window.innerWidth - 320 - EDGE),
      });
    }
    setMenuOpen((v) => !v);
  };

  /* --- close the menu on outside click / escape ----------------------- */
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-tour-menu]")) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  /* --- click the tab a step asks for, once per step ------------------- */
  useEffect(() => {
    if (!steps || !step) return;
    if (!step.open) return;
    const key = `${index}:${step.open}`;
    if (openedRef.current === key) return;
    openedRef.current = key;
    // Let the panel open before we take our measurement.
    const id = window.setTimeout(() => targetEl(step.open ?? "")?.click(), 30);
    return () => window.clearTimeout(id);
  }, [steps, step, index]);

  /* --- measure the spotlight, scroll into view, skip missing targets -- */
  useEffect(() => {
    if (!steps) return;
    let missingSince = performance.now();
    let lastKey = "";
    const el = targetEl(steps[index]?.target ?? "");
    el?.scrollIntoView({ block: "center", inline: "nearest" });

    const measure = () => {
      if (!steps) return;
      const current = steps[index];
      const node = current ? targetEl(current.target) : null;
      if (!node || node.getBoundingClientRect().width === 0) {
        if (performance.now() - missingSince > SKIP_AFTER_MS) {
          if (index + 1 < steps.length) {
            missingSince = performance.now();
            setIndex(index + 1);
          } else {
            exit();
          }
        }
        setRect(null);
        return;
      }
      const r = node.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      if (lastKey !== `${index}`) lastKey = `${index}`;
    };

    const id = window.setInterval(measure, 140);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [steps, index, exit]);

  /* --- keep the tooltip height accurate for placement ----------------- */
  useLayoutEffect(() => {
    if (tipRef.current) {
      const h = tipRef.current.offsetHeight;
      setTipH((prev) => (Math.abs(prev - h) > 2 ? h : prev));
    }
  }, [index, rect, steps]);

  /* --- keyboard navigation -------------------------------------------- */
  useEffect(() => {
    if (!steps) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exit();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, go, exit]);

  /* --- advance when the highlighted element is clicked ----------------- */
  useEffect(() => {
    if (!steps || !step || !step.advanceOnClick) return;
    const node = targetEl(step.target);
    if (!node) return;
    const onClick = () => go(1);
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  }, [steps, step, go]);

  /* --- tooltip placement ---------------------------------------------- */
  const tip = (() => {
    if (!rect || typeof window === "undefined") return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pref = step?.placement;
    let side = pref ?? "bottom";
    if (side === "bottom" && rect.y + rect.h + TIP_GAP + tipH > vh) side = "top";
    if (side === "top" && rect.y - TIP_GAP - tipH < EDGE) {
      side = rect.x > vw / 2 ? "left" : "right";
    }
    if (side === "right" && rect.x + rect.w + TIP_GAP + TIP_W > vw) side = "left";
    if (side === "left" && rect.x - TIP_GAP - TIP_W < EDGE) side = "right";

    const clampY = (value: number) =>
      Math.min(Math.max(value, EDGE), Math.max(EDGE, vh - tipH - EDGE));
    let left: number;
    let top: number;
    if (side === "bottom" || side === "top") {
      left = Math.min(Math.max(rect.x + rect.w / 2 - TIP_W / 2, EDGE), vw - TIP_W - EDGE);
      top = side === "bottom" ? rect.y + rect.h + TIP_GAP : rect.y - tipH - TIP_GAP;
    } else if (side === "right") {
      left = Math.min(rect.x + rect.w + TIP_GAP, vw - TIP_W - EDGE);
      top = clampY(rect.y + rect.h / 2 - tipH / 2);
    } else {
      left = Math.max(rect.x - TIP_W - TIP_GAP, EDGE);
      top = clampY(rect.y + rect.h / 2 - tipH / 2);
    }
    return { left: Math.max(EDGE, left), top: clampY(top), side };
  })();

  const progress = steps ? Math.round(((index + 1) / steps.length) * 100) : 0;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-tour="tutorial-button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="Interactive guided tour"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-600/10 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:border-violet-400 hover:bg-violet-600/20",
          className
        )}
      >
        <GraduationCap className="h-3.5 w-3.5" aria-hidden />
        Tutorial
      </button>

      {menuOpen &&
        menuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-tour-menu
            role="menu"
            className="fixed z-[90] w-80 overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <div className="border-b border-zinc-800 px-3.5 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" aria-hidden />
                Interactive tutorial
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
                Pick a section to spotlight, or run the complete tour.
              </p>
            </div>

            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto p-2 custom-scrollbar">
              {TOUR_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="menuitem"
                  onClick={() => start(category.steps, category.title)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border bg-gradient-to-br px-3 py-2.5 text-left transition-transform hover:scale-[1.01]",
                    category.accent
                  )}
                >
                  <span className="text-base leading-5" aria-hidden>
                    {category.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-zinc-100">
                      {category.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-zinc-400">
                      {category.blurb}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 self-center text-[10px] tabular-nums text-zinc-500">
                    {category.steps.length}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-zinc-800 p-2">
              <button
                type="button"
                role="menuitem"
                onClick={() => start(buildFullTour(), "Full studio tour")}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl brand-gradient brand-gradient-hover px-3 py-2.5 text-xs font-semibold text-white"
              >
                <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                Start Full Tour
              </button>
            </div>
          </div>,
          document.body
        )}

      {active &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-[100]"
            role="dialog"
            aria-label="Guided tour"
          >
            {rect && (
              <div
                aria-hidden
                className="absolute rounded-xl transition-[top,left,width,height] duration-200 ease-out"
                style={{
                  top: rect.y - PAD,
                  left: rect.x - PAD,
                  width: rect.w + PAD * 2,
                  height: rect.h + PAD * 2,
                  boxShadow:
                    "0 0 0 9999px rgba(2,6,23,0.72), 0 0 0 2px rgba(167,139,250,0.95), 0 0 26px 6px rgba(139,92,246,0.45)",
                }}
              />
            )}

            <div
              ref={tipRef}
              className="pointer-events-auto absolute w-[340px] overflow-hidden rounded-2xl border border-violet-500/30 bg-zinc-900/95 shadow-2xl shadow-black/70 backdrop-blur-xl"
              style={{ top: tip?.top ?? 0, left: tip?.left ?? 0 }}
            >
              <div className="flex items-start gap-2 border-b border-zinc-800 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                    {label}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-zinc-50">
                    {step?.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={exit}
                  aria-label="Exit tour"
                  title="Exit tour (Esc)"
                  className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <p className="max-h-40 overflow-y-auto px-3.5 py-3 text-[11px] leading-5 text-zinc-300 custom-scrollbar">
                {step?.body}
              </p>

              <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2.5">
                <span className="text-[10px] tabular-nums text-zinc-500">
                  {index + 1} / {steps?.length ?? 0}
                </span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <span
                    className="brand-gradient block h-full transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </span>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={index === 0}
                  aria-label="Previous step"
                  title="Previous (←)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-300 transition-colors hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (steps && index + 1 >= steps.length) exit();
                    else go(1);
                  }}
                  aria-label="Next step"
                  title="Next (→)"
                  className="flex h-7 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-500"
                >
                  {steps && index + 1 >= steps.length ? "Finish" : "Next"}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
