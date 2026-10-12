"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Coins, Download, Gift } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditorStore } from "@/store/editor";
import { ASPECT_RESOLUTIONS, drawScene } from "@/lib/render";
import {
  EXPORT_FPS,
  InsufficientCreditsError,
  downloadFile,
  exportVideo,
  type ExportSegment,
} from "@/lib/exporter";
import { useWorkspaceStore } from "@/store/workspace";
import { EXPORT_CREDIT_COST } from "@/lib/credits";
import { DesktopEditor } from "@/components/editor/desktop-editor";
import { MobileEditor } from "@/components/editor/mobile-editor";
import { ExportDialog, type ExportRun } from "@/components/editor/export-dialog";
import { ReferralModal } from "@/components/credits/referral-modal";

function fileNameFor(title: string, extension: string): string {
  const slug =
    title
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "") || "video";
  return `${slug}_1080p.${extension}`;
}

function EditorView() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Static export can't serve arbitrary /editor/<id> paths, so the active
  // project id travels in the query string (`/editor?id=<uuid>`). A pathname
  // fallback keeps legacy `/editor/<id>` links working where the host rewrites
  // them to this page.
  const projectId = useMemo(() => {
    const fromQuery = searchParams.get("id") ?? searchParams.get("projectId");
    if (fromQuery) return fromQuery;
    const fromPath = pathname?.match(/\/editor\/([^/?#]+)/)?.[1];
    return fromPath && fromPath !== "index"
      ? decodeURIComponent(fromPath)
      : "";
  }, [searchParams, pathname]);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aspect = useEditorStore((state) => state.aspect);
  const hasVideo = useEditorStore((state) => state.videoEl !== null);
  const [exportRun, setExportRun] = useState<ExportRun | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);

  const profile = useWorkspaceStore((state) => state.profile);
  const loadProfile = useWorkspaceStore((state) => state.loadProfile);
  /** Reason the last credit attempt failed (for tailored error UI). */
  const creditReason = useRef<"insufficient" | "error" | null>(null);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be signed in to open a project.");

        const { data, error: queryError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (queryError) throw new Error(queryError.message);
        if (!cancelled) setProject(data as Project | null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load project."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Load the project's media library + clip sequence from IndexedDB.
  useEffect(() => {
    if (!projectId) return;
    void useEditorStore.getState().loadProjectMedia(projectId);
  }, [projectId]);

  // Release the blob URL, video element, and preview state when leaving.
  useEffect(() => {
    return () => {
      useEditorStore.getState().resetEditor();
    };
  }, []);

  // Persist export stats onto the project so the dashboard can show real
  // counts and total processed duration (best-effort, never blocks the UI).
  const persistExport = async (target: Project, seconds: number) => {
    try {
      const supabase = createClient();
      const previous =
        typeof target.settings?.exportCount === "number"
          ? target.settings.exportCount
          : 0;
      const settings = {
        ...target.settings,
        exportCount: previous + 1,
        durationSeconds: seconds,
        lastExportAt: new Date().toISOString(),
      };
      setProject((prev) =>
        prev ? { ...prev, status: "exported", settings } : prev
      );
      await supabase
        .from("projects")
        .update({ status: "exported", settings })
        .eq("id", target.id);
    } catch {
      // Stats are advisory; ignore persistence failures.
    }
  };

  const handleExport = async () => {
    const state = useEditorStore.getState();
    const video = state.videoEl;
    if (!video || !project || exportRun?.status === "running") return;

    // Block early with the referral prompt when today's credits are short.
    const workspace = useWorkspaceStore.getState();
    if (workspace.profile && workspace.profile.daily_credits < EXPORT_CREDIT_COST) {
      setReferralOpen(true);
      return;
    }
    creditReason.current = null;

    if (state.playing) state.setPlaying(false);

    const { width, height } = ASPECT_RESOLUTIONS[state.aspect];
    const duration = state.duration > 0 ? state.duration : video.duration;
    const trimStart = state.trimStart;
    const trimEnd =
      state.trimEnd > trimStart + 0.05 ? Math.min(state.trimEnd, duration) : duration;
    if (!Number.isFinite(trimEnd) || trimEnd <= trimStart) {
      setExportRun({
        status: "error",
        label: "Export failed",
        percent: 0,
        error: "The video has no exportable range. Re-import the video and try again.",
        controller: new AbortController(),
      });
      return;
    }

    const controller = new AbortController();
    const scene = {
      width,
      height,
      fit: state.fit,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      overlays: state.overlays,
      captionStyle: state.captionStyle,
      colorAdjustments: state.colorAdjustments,
      activeEffects: state.activeEffects,
    };

    // Multi-clip: build a decoder per sequence clip so the exporter can merge
    // them into one output. A single clip uses the live preview element.
    const createdUrls: string[] = [];
    let segments: ExportSegment[] | undefined;
    if (state.sequence.length > 1) {
      segments = [];
      for (const clip of state.sequence) {
        const asset = state.assets.find((item) => item.id === clip.assetId);
        if (!asset) continue;
        const url = URL.createObjectURL(asset.blob);
        createdUrls.push(url);
        const el = document.createElement("video");
        el.preload = "auto";
        el.playsInline = true;
        el.src = url;
        const file =
          asset.blob instanceof File
            ? asset.blob
            : new File([asset.blob], asset.name, {
                type: asset.blob.type || "video/mp4",
              });
        segments.push({
          video: el,
          trimStart: clip.trimStart,
          trimEnd: clip.trimEnd,
          file,
        });
      }
    }
    const releaseSegments = () => {
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };

    setExportRun({
      status: "running",
      label: "Preparing export…",
      percent: 0,
      controller,
    });

    try {
      const result = await exportVideo({
        video,
        renderFrame: (ctx, time, frameVideo) =>
          drawScene(ctx, frameVideo, { ...scene, sceneTime: time }),
        width,
        height,
        trimStart,
        trimEnd,
        fps: EXPORT_FPS,
        file: state.videoFile,
        segments: segments && segments.length > 1 ? segments : undefined,
        audioTracks: state.audioTracks,
        speedPoints: segments ? [] : state.speedPoints,
        // Server-side credit gate: spends the export cost before rendering.
        authorize: async () => {
          const result = await useWorkspaceStore
            .getState()
            .consumeCredits(EXPORT_CREDIT_COST);
          creditReason.current = result.ok ? null : (result.reason ?? "error");
          return result.ok;
        },
        signal: controller.signal,
        onProgress: (progress) => {
          setExportRun((previous) =>
            previous && previous.status === "running"
              ? { ...previous, label: progress.label, percent: progress.percent }
              : previous
          );
        },
      });

      const fileName = fileNameFor(project.title, result.extension);
      downloadFile(result.blob, fileName);
      void persistExport(project, Math.max(0, trimEnd - trimStart));
      setExportRun({
        status: "done",
        label: "Export complete",
        percent: 100,
        fileName,
        fileSize: result.blob.size,
        usedFallback: result.usedFallback,
        controller,
      });
      releaseSegments();
    } catch (err) {
      releaseSegments();
      if (err instanceof DOMException && err.name === "AbortError") {
        setExportRun(null);
        return;
      }
      if (err instanceof InsufficientCreditsError) {
        setExportRun(null);
        if (creditReason.current === "insufficient") {
          setReferralOpen(true);
        } else {
          setExportRun({
            status: "error",
            label: "Export blocked",
            percent: 0,
            error:
              useWorkspaceStore.getState().profileError ??
              "Could not verify your export credits. Please try again.",
            controller,
          });
        }
        return;
      }
      setExportRun({
        status: "error",
        label: "Export failed",
        percent: 0,
        error: err instanceof Error ? err.message : "The export failed.",
        controller,
      });
    }
  };

  const resolution = ASPECT_RESOLUTIONS[aspect];
  const exporting = exportRun?.status === "running";

  return (
    <div className="flex w-full max-w-full min-w-0 flex-col gap-4 max-md:h-full max-md:min-h-0 max-md:overflow-x-hidden">
      {/* Top bar */}
      <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-3 max-md:overflow-hidden">
        <Link
          href="/projects"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to projects
        </Link>

        <div className="min-w-0 flex-1">
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <>
              <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50">
                {project?.title ?? "Editor"}
              </h1>
              {project && (
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  Status: {project.status} · Created{" "}
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </div>

        <span className="hidden shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] tabular-nums text-zinc-400 ring-1 ring-inset ring-zinc-800 sm:inline-block">
          {aspect} · {resolution.width}×{resolution.height}
        </span>

        {profile && (
          <button
            type="button"
            onClick={() => setReferralOpen(true)}
            title="Daily export credits — click for referrals & rewards"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 ring-1 ring-inset ring-zinc-800 transition-colors hover:ring-zinc-600"
          >
            <Coins className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            <span className="tabular-nums">{profile.daily_credits}</span>
            <span className="text-zinc-500">credits</span>
            <Gift className="h-3.5 w-3.5 text-violet-400" aria-hidden />
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={!hasVideo || exporting}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg brand-gradient brand-gradient-hover px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          Export 1080p Video
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      ) : !project ? (
        <p className="glass-card rounded-xl px-4 py-3 text-sm text-zinc-400">
          Project not found.
        </p>
      ) : (
        <>
          {/* Desktop: Premiere-style 4-panel workspace */}
          <div className="hidden md:flex md:min-h-0 md:flex-1 md:flex-col">
            <DesktopEditor onRequireCredits={() => setReferralOpen(true)} />
          </div>

          {/* Mobile CapCut-style timeline editor */}
          <MobileEditor />
        </>
      )}

      <ExportDialog run={exportRun} onClose={() => setExportRun(null)} />
      <ReferralModal
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
      />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <EditorView />
    </Suspense>
  );
}
