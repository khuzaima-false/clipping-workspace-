"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EXPORT_RESOLUTIONS,
  computeClipStarts,
  effectiveAudioTracks,
  resolveClipTransform,
  useEditorStore,
  type ExportResolutionId,
} from "@/store/editor";
import { drawScene } from "@/lib/render";
import { visibleLayerFlags } from "@/lib/tracks";
import { TutorialLauncher } from "@/components/tutorial/guided-tour";
import { StorageManager } from "@/components/editor/storage-manager";
import {
  EXPORT_FPS,
  downloadFile,
  exportVideo,
  type ExportSegment,
} from "@/lib/exporter";
import { DesktopEditor } from "@/components/editor/desktop-editor";
import { MobileEditor } from "@/components/editor/mobile-editor";
import { ExportDialog, type ExportRun } from "@/components/editor/export-dialog";
import { useAutosave } from "@/hooks/use-autosave";
import {
  buildLocalProject,
  getOrCreateLocalProject,
  isLocalProjectId,
  rememberLocalProject,
  renameLocalProject,
} from "@/lib/local-projects";
import { isTauri } from "@/lib/tauri";
import { useIsTauri } from "@/hooks/use-is-tauri";
import { cn } from "@/lib/utils";

function fileNameFor(title: string, extension: string, label: string): string {
  const slug =
    title
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "") || "video";
  return `${slug}_${label}.${extension}`;
}

function EditorView() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

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
  const desktop = useIsTauri();

  const [titleDraft, setTitleDraft] = useState("");

  const hasVideo = useEditorStore((state) => state.videoEl !== null);
  const exportResolution = useEditorStore((state) => state.exportResolution);
  const setExportResolution = useEditorStore((s) => s.setExportResolution);
  const [exportRun, setExportRun] = useState<ExportRun | null>(null);

  const preset = EXPORT_RESOLUTIONS[exportResolution];

  // Debounced IndexedDB autosave — drives the header status indicator.
  const saveStatus = useAutosave();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Opening /editor without an id (e.g. the landing "Launch Studio" CTA) is
      // not a valid uuid lookup — the redirect effect below resolves the newest
      // project. Clear any stale project from a previous id here.
      if (!projectId) {
        setProject(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      // Desktop shell: never contact the cloud. A cloud project id arriving
      // from a stale bookmark/link is swapped for the local desktop project.
      if (isTauri() && !isLocalProjectId(projectId)) {
        router.replace(`/editor?id=${getOrCreateLocalProject()}`);
        return;
      }

      // Browser demo projects (`local-…`) never touch Supabase: their
      // metadata lives in localStorage and their media/autosaves in
      // IndexedDB. This keeps "Try in Browser" instant for signed-out
      // visitors (and offline), landing them directly in a working editor.
      if (isLocalProjectId(projectId)) {
        rememberLocalProject(projectId);
        const local = buildLocalProject(projectId);
        if (!cancelled) {
          setProject(local);
          setTitleDraft(local.title);
          setLoading(false);
        }
        return;
      }

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
        if (!cancelled) {
          const next = (data as Project | null) ?? null;
          setProject(next);
          setTitleDraft(next?.title ?? "");
        }
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
  }, [projectId, router]);

  // No project id: jump straight into the most recent project so the landing
  // CTA opens real work. With no account or no projects, seed a browser demo
  // project instead of dead-ending on "No project selected".
  useEffect(() => {
    if (projectId) return;
    let cancelled = false;

    async function openLatest() {
      // Desktop shell: fully local-first — no session lookup, no network.
      if (isTauri()) {
        if (!cancelled) {
          router.replace(`/editor?id=${getOrCreateLocalProject()}`);
        }
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          router.replace(`/editor?id=${getOrCreateLocalProject()}`);
          return;
        }
        const { data } = await supabase
          .from("projects")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        router.replace(
          data?.id ? `/editor?id=${data.id}` : `/editor?id=${getOrCreateLocalProject()}`
        );
      } catch {
        // Supabase unavailable (offline or not configured) — the studio still
        // works locally, so open a demo project rather than an empty state.
        if (!cancelled) {
          router.replace(`/editor?id=${getOrCreateLocalProject()}`);
        }
      }
    }

    void openLatest();
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  // Load the project's media library + clip sequence from IndexedDB.
  useEffect(() => {
    if (!projectId) return;
    if (isLocalProjectId(projectId)) rememberLocalProject(projectId);
    void useEditorStore.getState().loadProjectMedia(projectId);
  }, [projectId]);

  // Release the blob URL, video element, and preview state when leaving.
  useEffect(() => {
    return () => {
      useEditorStore.getState().resetEditor();
    };
  }, []);

  /** Commits an inline title edit to local state + Supabase. */
  const commitTitle = async () => {
    const current = project;
    if (!current) return;
    const next = titleDraft.trim() || current.title;
    setTitleDraft(next);
    if (next === current.title) return;
    setProject((prev) => (prev ? { ...prev, title: next } : prev));
    useEditorStore.getState().setSaveStatus("unsaved");

    // Browser demo projects persist the title on-device only.
    if (isLocalProjectId(current.id)) {
      renameLocalProject(current.id, next);
      useEditorStore.getState().setSaveStatus("saved");
      return;
    }

    try {
      const supabase = createClient();
      await supabase.from("projects").update({ title: next }).eq("id", current.id);
    } catch {
      // Local state already reflects the change; retry on the next edit.
    }
    useEditorStore.getState().setSaveStatus("saved");
  };

  // Persist export stats onto the project (best-effort, never blocks the UI).
  const persistExport = async (target: Project, seconds: number) => {
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

    // Browser demo projects keep their stats in memory / IndexedDB only.
    if (isLocalProjectId(target.id)) return;

    try {
      const supabase = createClient();
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

    if (state.playing) state.setPlaying(false);

    const { width, height, bitrate, label } =
      EXPORT_RESOLUTIONS[state.exportResolution];
    const duration = state.duration > 0 ? state.duration : video.duration;
    const naturalStart = state.trimStart;
    const naturalEnd =
      state.trimEnd > naturalStart + 0.05
        ? Math.min(state.trimEnd, duration)
        : duration;
    // Mark In/Out bound the export region when set.
    const trimStart =
      state.markIn !== null ? Math.min(state.markIn, naturalEnd - 0.05) : naturalStart;
    const trimEnd =
      state.markOut !== null ? Math.max(trimStart + 0.05, Math.min(state.markOut, duration)) : naturalEnd;
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
      crisp: state.hdRendering,
      chromaKey: state.chromaKey,
      canvasFill: state.canvasFill,
      colorWheels: state.colorWheels,
      // Track visibility (V1/V2/V3 eye + solo) is honoured by the export too.
      ...visibleLayerFlags(state.trackStates),
    };

    // Multi-clip: build a decoder per sequence clip so the exporter can merge
    // them into one output. Clips are ordered by their (possibly dragged)
    // timeline position; a single clip uses the live preview element.
    const createdUrls: string[] = [];
    let segments: ExportSegment[] | undefined;
    const orderedClips = computeClipStarts(state.sequence)
      .sort((a, b) => a.start - b.start)
      .map((entry) => entry.clip);
    if (orderedClips.length > 1) {
      segments = [];
      for (const clip of orderedClips) {
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
          transition: clip.transitionIn,
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
        renderFrame: (ctx, time, frameVideo, transition) =>
          drawScene(ctx, frameVideo, {
            ...scene,
            sceneTime: time,
            // Per-clip transform keyframes (single-clip export path).
            clipTransform: segments
              ? undefined
              : resolveClipTransform(
                  state.sequence.find((item) => item.id === state.activeClipId),
                  time
                ),
            transition: transition
              ? {
                  type: transition.type,
                  progress: transition.progress,
                  fromVideo: transition.fromVideo,
                }
              : undefined,
          }),
        width,
        height,
        bitrate,
        trimStart,
        trimEnd,
        fps: EXPORT_FPS,
        file: state.videoFile,
        segments: segments && segments.length > 1 ? segments : undefined,
        audioTracks: effectiveAudioTracks(state),
        muteBase: state.trackStates.V1.muted,
        speedPoints: segments ? [] : state.speedPoints,
        signal: controller.signal,
        onProgress: (progress) => {
          setExportRun((previous) =>
            previous && previous.status === "running"
              ? { ...previous, label: progress.label, percent: progress.percent }
              : previous
          );
        },
      });

      const fileName = fileNameFor(project.title, result.extension, label);
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
      setExportRun({
        status: "error",
        label: "Export failed",
        percent: 0,
        error: err instanceof Error ? err.message : "The export failed.",
        controller,
      });
    }
  };

  // Batch export: encode + download each selected clip sequentially.
  const handleBatchExport = async (clipIds: string[]) => {
    const store = useEditorStore.getState();
    const res = EXPORT_RESOLUTIONS[store.exportResolution];
    for (const clipId of clipIds) {
      const clip = store.sequence.find((c) => c.id === clipId);
      const asset = clip
        ? store.assets.find((a) => a.id === clip.assetId)
        : undefined;
      if (!clip || !asset) continue;

      const url = URL.createObjectURL(asset.blob);
      const el = document.createElement("video");
      el.preload = "auto";
      el.playsInline = true;
      el.src = url;

      try {
        await new Promise<void>((resolve) => {
          if (el.readyState >= 1) resolve();
          else el.addEventListener("loadedmetadata", () => resolve(), { once: true });
        });
        const trimStart = clip.trimStart;
        const trimEnd =
          clip.trimEnd > clip.trimStart
            ? clip.trimEnd
            : Number.isFinite(el.duration)
              ? el.duration
              : 0;
        if (trimEnd <= trimStart) continue;

        const file =
          asset.blob instanceof File
            ? asset.blob
            : new File([asset.blob], asset.name, {
                type: asset.blob.type || "video/mp4",
              });

        const result = await exportVideo({
          video: el,
          renderFrame: (ctx, time, frameVideo) =>
            drawScene(ctx, frameVideo, {
              width: res.width,
              height: res.height,
              fit: store.fit,
              offsetX: store.offsetX,
              offsetY: store.offsetY,
              overlays: [],
              captionStyle: store.captionStyle,
              colorAdjustments: store.colorAdjustments,
              activeEffects: [],
              crisp: store.hdRendering,
              sceneTime: time,
              colorWheels: store.colorWheels,
            }),
          width: res.width,
          height: res.height,
          bitrate: res.bitrate,
          trimStart,
          trimEnd,
          fps: EXPORT_FPS,
          file,
          speedPoints: [],
          muteBase: store.trackStates.V1.muted,
          onProgress: () => {},
        });
        downloadFile(
          result.blob,
          fileNameFor(asset.name.replace(/\.[^.]+$/, ""), result.extension, res.label)
        );
      } catch {
        // Skip failed items and continue the queue.
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  };

  const exporting = exportRun?.status === "running";
  const exportPercent = exporting ? exportRun?.percent ?? 0 : 0;

  return (
    <div className="flex w-full max-w-full min-w-0 flex-col gap-4 max-md:h-full max-md:min-h-0 max-md:overflow-x-hidden">
      {/* Top bar */}
      <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-3 max-md:overflow-hidden">
        <div className="min-w-0 flex-1" data-tour="editor-title">
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <>
              {project ? (
                <input
                  value={titleDraft}
                  onChange={(e) => {
                    setTitleDraft(e.target.value);
                    useEditorStore.getState().setSaveStatus("unsaved");
                  }}
                  onBlur={() => void commitTitle()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    } else if (e.key === "Escape") {
                      setTitleDraft(project.title);
                      e.currentTarget.blur();
                    }
                  }}
                  aria-label="Project title"
                  spellCheck={false}
                  className="w-full max-w-md truncate rounded-md border border-transparent bg-transparent text-xl font-semibold tracking-tight text-zinc-50 outline-none transition-colors hover:border-zinc-800 focus:border-violet-500/50 focus:bg-zinc-900/60 focus:px-2"
                />
              ) : (
                <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50">
                  Editor
                </h1>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500" data-tour="save-indicator">
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    saveStatus === "saved" && "bg-emerald-400",
                    saveStatus === "saving" && "animate-pulse bg-amber-400",
                    saveStatus === "unsaved" && "bg-zinc-500"
                  )}
                />
                <span className="shrink-0" aria-live="polite">
                  {saveStatus === "saved"
                    ? "All changes saved"
                    : saveStatus === "saving"
                      ? "Auto-saving…"
                      : "Unsaved changes"}
                </span>
                {project && (
                  <span className="truncate text-zinc-600">
                    ·{" "}
                    {isLocalProjectId(project.id)
                      ? desktop
                        ? "Desktop project · saved on this device"
                        : "Browser demo · saved on this device"
                      : `Created ${new Date(project.created_at).toLocaleDateString()}`}
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        {/* Resolution selector */}
        <label className="inline-flex shrink-0 items-center gap-2" data-tour="export-resolution">
          <span className="sr-only">Export resolution</span>
          <select
            value={exportResolution}
            onChange={(e) => setExportResolution(e.target.value as ExportResolutionId)}
            aria-label="Export resolution"
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 focus:border-violet-500 focus:outline-none"
          >
            {(Object.keys(EXPORT_RESOLUTIONS) as ExportResolutionId[]).map((id) => {
              const option = EXPORT_RESOLUTIONS[id];
              return (
                <option key={id} value={id}>
                  {option.label} · {option.width}×{option.height}
                </option>
              );
            })}
          </select>
        </label>

        <StorageManager />
        <TutorialLauncher />

        <button
          type="button"
          data-tour="export-button"
          onClick={() => void handleExport()}
          disabled={!hasVideo || exporting}
          className="brand-gradient brand-gradient-hover relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-150"
              style={{ width: `${Math.max(2, exportPercent)}%` }}
            />
          )}
          <span className="relative inline-flex items-center gap-2">
            <Download className="h-4 w-4" aria-hidden />
            {exporting
              ? `Rendering ${exportPercent}%…`
              : `Export ${preset.label} Video`}
          </span>
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
        <div className="glass-card rounded-xl px-4 py-4 text-sm text-zinc-400">
          <p className="font-medium text-zinc-200">
            {projectId ? "Project not found" : "No project selected"}
          </p>
          <p className="mt-1 leading-6">
            {projectId
              ? "This project may have been removed or belongs to another account."
              : "Pick a project to open in the studio, or create a new one to get started."}
          </p>
          <Link
            href="/projects"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Go to projects
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop: Premiere-style 4-panel workspace */}
          <div className="hidden md:flex md:min-h-0 md:flex-1 md:flex-col">
            <DesktopEditor
              onBatchExport={(ids) => void handleBatchExport(ids)}
            />
          </div>

          {/* Mobile CapCut-style timeline editor */}
          <MobileEditor />
        </>
      )}

      <ExportDialog run={exportRun} onClose={() => setExportRun(null)} />
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
