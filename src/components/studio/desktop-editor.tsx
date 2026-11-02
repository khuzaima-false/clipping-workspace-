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
      } else if (lower === "i") {
        event.preventDefault();
        state.setMarkIn(state.currentTime);
      } else if (lower === "o") {
        event.preventDefault();
        state.setMarkOut(state.currentTime);
      } else if (lower === "s" && !event.shiftKey) {
        event.preventDefault();
        state.splitActiveClip();
      } else if (event.key === "Delete" && event.shiftKey) {
        event.preventDefault();
        if (state.activeClipId) state.rippleDeleteClip(state.activeClipId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)_220px] gap-2 p-2 lg:grid-cols-[236px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <LeftPanel
          activeTab={leftTab}
          onTabChange={setLeftTab}
          aiContent={<AIAssistantPanel />}
        />
        <DualViewport program={<ProgramPreview />} />
        <InspectorPanel onBatchExport={onBatchExport} />
      </div>

      <TimelineCanvas>
        <PremiereTimeline />
      </TimelineCanvas>

      <WorkspaceSwitcher
        active={workspacePage}
        onChange={handleWorkspacePage}
      />
    </div>
  );
}
