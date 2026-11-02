"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AIAssistantPanel,
  InspectorPanel,
  PremiereTimeline,
  ProgramPreview,
} from "@/components/editor/desktop-editor";
import {
  EditorMenuBar,
  type WorkspacePage,
} from "@/components/studio/EditorMenuBar";
import { DualViewport } from "@/components/studio/DualViewport";
import {
  LeftPanel,
  type LeftPanelTab,
} from "@/components/studio/LeftPanel";
import { TimelineCanvas } from "@/components/studio/TimelineCanvas";
import { WorkspaceSwitcher } from "@/components/studio/WorkspaceSwitcher";
import { requestEditorTab } from "@/lib/editor-events";
import { windowControl } from "@/lib/tauri";
import { useEditorStore } from "@/store/editor";

/**
 * High-density DaVinci-style desktop studio shell.
 *
 * The existing ProgramPreview / InspectorPanel / PremiereTimeline remain the
 * source of playback, inspector and timeline behavior; this shell adds the
 * menu bar, source/program dual viewport, media/effects/AI left panel and the
 * bottom workspace switcher.
 */
export function DesktopEditor({
  title,
  onExport,
  onBatchExport,
}: {
  title?: string;
  onExport?: () => void;
  onBatchExport?: (clipIds: string[]) => void;
}) {
  const [workspacePage, setWorkspacePage] = useState<WorkspacePage>("edit");
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("media");
  const [leftWidth, setLeftWidth] = useState(236);
  const [rightWidth, setRightWidth] = useState(300);
  const [timelineHeight, setTimelineHeight] = useState(270);

  const startResize =
    (kind: "left" | "right" | "timeline") =>
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = leftWidth;
      const startRight = rightWidth;
      const startTimeline = timelineHeight;
      const previousCursor = document.body.style.cursor;
      const previousSelect = document.body.style.userSelect;
      document.body.style.cursor =
        kind === "timeline" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (move: PointerEvent) => {
        if (kind === "left") {
          setLeftWidth(
            Math.min(360, Math.max(170, startLeft + move.clientX - startX))
          );
        } else if (kind === "right") {
          setRightWidth(
            Math.min(420, Math.max(220, startRight - (move.clientX - startX)))
          );
        } else {
          setTimelineHeight(
            Math.min(440, Math.max(170, startTimeline - (move.clientY - startY)))
          );
        }
      };
      const onUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousSelect;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

  // Global keyboard shortcuts: undo/redo, play/pause, frame step, marks, razor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      const state = useEditorStore.getState();
      const key = event.key;
      const lower = key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (lower === "z" && !event.shiftKey) {
          event.preventDefault();
          state.undo();
        } else if (lower === "y" || (lower === "z" && event.shiftKey)) {
          event.preventDefault();
          state.redo();
        } else if (lower === "e") {
          event.preventDefault();
          onExport?.();
        } else if (lower === "d") {
          event.preventDefault();
          state.duplicateActiveClip();
        } else if (lower === "x") {
          event.preventDefault();
          state.cutActiveClip();
        } else if (lower === "c") {
          event.preventDefault();
          state.copyActiveClip();
        } else if (lower === "v") {
          event.preventDefault();
          state.pasteClip();
        } else if (lower === "a") {
          event.preventDefault();
          state.selectAllClips();
        } else if (lower === "s") {
          event.preventDefault();
          void state.checkpoint();
        }
        return;
      }

      if (!window.matchMedia("(min-width: 768px)").matches) return;

      if (key === " ") {
        event.preventDefault();
        if (state.videoEl) state.setPlaying(!state.playing);
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        state.stepFrame(-1);
      } else if (key === "ArrowRight") {
        event.preventDefault();
        state.stepFrame(1);
      } else if (key === "Home") {
        event.preventDefault();
        state.seek(0);
      } else if (key === "End") {
        event.preventDefault();
        state.seek(state.duration);
      } else if (key === "+" || key === "=") {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent<number>("forgevyn:timeline-zoom", { detail: 12 })
        );
      } else if (key === "-") {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent<number>("forgevyn:timeline-zoom", { detail: -12 })
        );
      } else if (key === "F11") {
        event.preventDefault();
        void windowControl("fullscreen").then((handled) => {
          if (handled) return;
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.();
        });
      } else if (lower === "i") {
        event.preventDefault();
        state.setMarkIn(state.currentTime);
      } else if (lower === "o") {
        event.preventDefault();
        state.setMarkOut(state.currentTime);
      } else if (lower === "s" && !event.shiftKey) {
        event.preventDefault();
        state.splitActiveClip();
      } else if (event.key === "Delete" && !event.shiftKey) {
        event.preventDefault();
        const ids =
          state.selectedClipIds.length > 0
            ? state.selectedClipIds
            : state.activeClipId
              ? [state.activeClipId]
              : [];
        ids.forEach((id) => state.removeClip(id));
      } else if (event.key === "Delete" && event.shiftKey) {
        event.preventDefault();
        if (state.activeClipId) state.rippleDeleteClip(state.activeClipId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExport]);

  const handleWorkspacePage = useCallback(
    (page: WorkspacePage) => {
      setWorkspacePage(page);

      if (page === "fusion") {
        setLeftTab("ai");
      }
      if (page === "deliver") {
        onExport?.();
        return;
      }
      if (page === "color") {
        requestEditorTab("color");
      }

      if (typeof document === "undefined") return;
      const target =
        page === "cut" || page === "fairlight"
          ? '[data-tour="timeline"]'
          : page === "edit"
            ? '[data-tour="program-monitor"]'
            : page === "fusion"
              ? '[data-tour="studio-left-panel"]'
              : '[data-tour="inspector-panel"]';
      document
        .querySelector(target)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [onExport]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-studio-bg text-zinc-100">
      <EditorMenuBar
        title={title ?? "Forgevyn Studio"}
        onExport={onExport}
        onSelectPage={handleWorkspacePage}
      />

      <div
        className="grid min-h-0 flex-1 gap-1 p-2"
        style={{
          gridTemplateColumns: `${leftWidth}px 6px minmax(0,1fr) 6px ${rightWidth}px`,
        }}
      >
        <LeftPanel
          activeTab={leftTab}
          onTabChange={setLeftTab}
          aiContent={<AIAssistantPanel />}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize media panel"
          data-tour="left-panel-resizer"
          onPointerDown={startResize("left")}
          className="my-2 cursor-col-resize rounded bg-studio-border/50 transition-colors hover:bg-violet-500/60"
        />
        <DualViewport program={<ProgramPreview />} />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector panel"
          data-tour="inspector-resizer"
          onPointerDown={startResize("right")}
          className="my-2 cursor-col-resize rounded bg-studio-border/50 transition-colors hover:bg-violet-500/60"
        />
        <InspectorPanel onBatchExport={onBatchExport} />
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline"
        data-tour="timeline-resizer"
        onPointerDown={startResize("timeline")}
        className="mx-2 mb-1 h-1.5 shrink-0 cursor-row-resize rounded bg-studio-border/50 transition-colors hover:bg-violet-500/60"
      />

      <TimelineCanvas height={timelineHeight}>
        <PremiereTimeline />
      </TimelineCanvas>

      <WorkspaceSwitcher
        active={workspacePage}
        onChange={handleWorkspacePage}
      />
    </div>
  );
}
