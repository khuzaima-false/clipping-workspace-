"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  Download,
  Film,
  Loader2,
  MonitorPlay,
  Pipette,
  Redo2,
  RefreshCw,
  Scissors,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  runUpdateCheck,
  UPDATER_ENDPOINT,
  type UpdateCheckOutcome,
} from "@/lib/updater";
import { useEditorStore } from "@/store/editor";

export type WorkspacePage =
  | "cut"
  | "edit"
  | "fusion"
  | "color"
  | "fairlight"
  | "deliver";

export const WORKSPACE_PAGES: {
  id: WorkspacePage;
  label: string;
  hint: string;
  icon: typeof Scissors;
}[] = [
  { id: "cut", label: "Cut", hint: "Timeline cut page", icon: Scissors },
  { id: "edit", label: "Edit", hint: "Dual monitor edit page", icon: Film },
  { id: "fusion", label: "Fusion", hint: "AI / effects page", icon: Sparkles },
  { id: "color", label: "Color", hint: "Color grading page", icon: Pipette },
  {
    id: "fairlight",
    label: "Fairlight",
    hint: "Audio timeline page",
    icon: AudioLines,
  },
  {
    id: "deliver",
    label: "Deliver",
    hint: "Export / deliver page",
    icon: MonitorPlay,
  },
];

type MenuId =
  | "file"
  | "edit"
  | "trim"
  | "timeline"
  | "clip"
  | "view"
  | "playback"
  | "help";

const MENUS: { id: MenuId; label: string }[] = [
  { id: "file", label: "File" },
  { id: "edit", label: "Edit" },
  { id: "trim", label: "Trim" },
  { id: "timeline", label: "Timeline" },
  { id: "clip", label: "Clip" },
  { id: "view", label: "View" },
  { id: "playback", label: "Playback" },
  { id: "help", label: "Help" },
];

function MenuItem({
  label,
  shortcut,
  disabled = false,
  onSelect,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-[11px] text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut && (
        <kbd className="shrink-0 font-sans text-[9px] text-zinc-600">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-studio-border" aria-hidden />;
}

export function EditorMenuBar({
  title = "Forgevyn Studio",
  onExport,
  onSelectPage,
}: {
  title?: string;
  onExport?: () => void;
  onSelectPage?: (page: WorkspacePage) => void;
}) {
  const [open, setOpen] = useState<MenuId | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateOutcome, setUpdateOutcome] = useState<UpdateCheckOutcome | null>(
    null
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const projectFileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const playing = useEditorStore((state) => state.playing);
  const saveStatus = useEditorStore((state) => state.saveStatus);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(null);
    action();
  };

  const state = () => useEditorStore.getState();
  const activeClipId = () => state().activeClipId;

  const zoom = (delta: number) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent<number>("forgevyn:timeline-zoom", { detail: delta })
    );
  };

  const togglePlay = () => {
    const s = state();
    if (!s.videoEl) return;
    s.setPlaying(!s.playing);
  };

  async function handleProjectImport(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await useEditorStore.getState().importProjectFile(file);
    if (result.ok && result.newProjectId) {
      setFileError(null);
      router.push(`/editor?id=${encodeURIComponent(result.newProjectId)}`);
    } else {
      setFileError(result.error ?? "Could not import that project file.");
    }
  }

  async function checkForUpdates() {
    setUpdateOpen(true);
    setUpdateChecking(true);
    setUpdateOutcome(null);
    const outcome = await runUpdateCheck();
    setUpdateOutcome(outcome);
    setUpdateChecking(false);
  }

  const menuBody: Record<MenuId, React.ReactNode> = {
    file: (
      <>
        <MenuItem
          label="Project Manager"
          onSelect={() => run(() => router.push("/dashboard"))}
        />
        <MenuDivider />
        <MenuItem label="New project" shortcut="Ctrl+N" disabled onSelect={() => {}} />
        <MenuItem label="Open project" shortcut="Ctrl+O" disabled onSelect={() => {}} />
        <MenuDivider />
        <MenuItem
          label="Export project (.forgevyn)"
          onSelect={() => run(() => void state().exportProjectFile())}
        />
        <MenuItem
          label="Import project (.forgevyn)…"
          onSelect={() => run(() => projectFileInput.current?.click())}
        />
        <MenuDivider />
        <MenuItem
          label="Export video…"
          shortcut="Ctrl+E"
          disabled={!onExport}
          onSelect={() => onExport?.()}
        />
      </>
    ),
    edit: (
      <>
        <MenuItem
          label="Undo"
          shortcut="Ctrl+Z"
          onSelect={() => run(() => state().undo())}
        />
        <MenuItem
          label="Redo"
          shortcut="Ctrl+Y"
          onSelect={() => run(() => state().redo())}
        />
      </>
    ),
    trim: (
      <>
        <MenuItem
          label="Mark in"
          shortcut="I"
          onSelect={() => run(() => state().setMarkIn(state().currentTime))}
        />
        <MenuItem
          label="Mark out"
          shortcut="O"
          onSelect={() => run(() => state().setMarkOut(state().currentTime))}
        />
        <MenuDivider />
        <MenuItem
          label="Ripple delete active clip"
          shortcut="Shift+Del"
          disabled={!activeClipId()}
          onSelect={() => {
            const id = activeClipId();
            if (id) run(() => state().rippleDeleteClip(id));
          }}
        />
      </>
    ),
    timeline: (
      <>
        <MenuItem
          label="Split at playhead"
          shortcut="S"
          onSelect={() => run(() => state().splitActiveClip())}
        />
        <MenuItem
          label="Ripple delete active clip"
          shortcut="Shift+Del"
          disabled={!activeClipId()}
          onSelect={() => {
            const id = activeClipId();
            if (id) run(() => state().rippleDeleteClip(id));
          }}
        />
        <MenuDivider />
        <MenuItem label="Zoom in" shortcut="+" onSelect={() => run(() => zoom(12))} />
        <MenuItem label="Zoom out" shortcut="-" onSelect={() => run(() => zoom(-12))} />
      </>
    ),
    clip: (
      <>
        <MenuItem
          label="Split at playhead"
          shortcut="S"
          onSelect={() => run(() => state().splitActiveClip())}
        />
        <MenuItem
          label="Ripple delete"
          shortcut="Shift+Del"
          disabled={!activeClipId()}
          onSelect={() => {
            const id = activeClipId();
            if (id) run(() => state().rippleDeleteClip(id));
          }}
        />
        <MenuItem
          label="Delete clip"
          disabled={!activeClipId()}
          onSelect={() => {
            const id = activeClipId();
            if (id) run(() => state().removeClip(id));
          }}
        />
        <MenuDivider />
        <MenuItem
          label="Reset transform & opacity"
          disabled={!activeClipId()}
          onSelect={() => {
            const id = activeClipId();
            if (id) {
              run(() =>
                state().setClipTransformAtPlayhead(id, {
                  x: 0,
                  y: 0,
                  scale: 1,
                  rotation: 0,
                  opacity: 1,
                })
              );
            }
          }}
        />
      </>
    ),
    view: (
      <>
        <MenuItem
          label="Go to Color page"
          disabled={!onSelectPage}
          onSelect={() => onSelectPage?.("color")}
        />
        <MenuItem
          label="Go to Deliver page"
          disabled={!onSelectPage}
          onSelect={() => onSelectPage?.("deliver")}
        />
        <MenuDivider />
        <MenuItem
          label="Toggle fullscreen"
          shortcut="F11"
          onSelect={() =>
            run(() => {
              if (typeof document === "undefined") return;
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.();
            })
          }
        />
      </>
    ),
    playback: (
      <>
        <MenuItem
          label={playing ? "Pause" : "Play"}
          shortcut="Space"
          onSelect={() => run(togglePlay)}
        />
        <MenuItem
          label="Step back one frame"
          shortcut="←"
          onSelect={() => run(() => state().stepFrame(-1))}
        />
        <MenuItem
          label="Step forward one frame"
          shortcut="→"
          onSelect={() => run(() => state().stepFrame(1))}
        />
        <MenuDivider />
        <MenuItem label="Go to start" shortcut="Home" onSelect={() => run(() => state().seek(0))} />
        <MenuItem
          label="Go to end"
          shortcut="End"
          onSelect={() => run(() => state().seek(state().duration))}
        />
      </>
    ),
    help: (
      <>
        <MenuItem
          label="Check for updates"
          onSelect={() => run(() => void checkForUpdates())}
        />
        <MenuDivider />
        <MenuItem
          label="Keyboard shortcuts"
          shortcut="?"
          onSelect={() => run(() => setShortcutsOpen(true))}
        />
        <MenuItem
          label="About Forgevyn Studio"
          onSelect={() => run(() => setAboutOpen(true))}
        />
      </>
    ),
  };

  return (
    <>
      <div
        ref={wrapRef}
        role="menubar"
        aria-label="Studio menu"
        data-tour="studio-menu-bar"
        className="sticky top-0 z-30 hidden h-8 shrink-0 items-center gap-0.5 border-b border-studio-border bg-studio-panel px-2 text-[11px] md:flex"
      >
        <span className="mr-1 flex items-center gap-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:text-zinc-200"
            aria-label="Open Project Manager"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden />
            Forgevyn
          </button>
        </span>

        {MENUS.map((menu) => (
          <div key={menu.id} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open === menu.id}
              onClick={() => setOpen((value) => (value === menu.id ? null : menu.id))}
              className={cn(
                "rounded px-2 py-1 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100",
                open === menu.id && "bg-white/5 text-zinc-100"
              )}
            >
              {menu.label}
            </button>
            {open === menu.id && (
              <div
                role="menu"
                aria-label={menu.label}
                className="absolute left-0 top-full z-[60] mt-1 w-60 rounded-md border border-studio-border bg-studio-panel p-1 shadow-2xl shadow-black/60"
              >
                {menuBody[menu.id]}
              </div>
            )}
          </div>
        ))}

        <span className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 truncate text-[11px] font-medium text-zinc-500 xl:block">
          {title}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <span
            title={saveStatus === "saved" ? "All changes saved" : "Unsaved changes"}
            className={cn(
              "mr-1 h-1.5 w-1.5 rounded-full",
              saveStatus === "saved" ? "bg-emerald-400" : "bg-amber-400"
            )}
            aria-label={
              saveStatus === "saved" ? "All changes saved" : "Unsaved changes"
            }
          />
          <button
            type="button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            onClick={() => state().undo()}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            onClick={() => state().redo()}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Export video"
            title="Export video"
            disabled={!onExport}
            onClick={() => onExport?.()}
            className="ml-1 inline-flex items-center gap-1.5 rounded border border-studio-border bg-[#202127] px-2 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:border-violet-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3 w-3" aria-hidden />
            Deliver
          </button>
        </div>
      </div>

      <input
        ref={projectFileInput}
        type="file"
        accept=".forgevyn,application/json"
        className="sr-only"
        onChange={(event) => void handleProjectImport(event)}
      />

      {fileError && (
        <button
          type="button"
          onClick={() => setFileError(null)}
          className="fixed bottom-12 left-1/2 z-[70] -translate-x-1/2 rounded-md border border-red-500/30 bg-[#2a1215] px-3 py-2 text-xs text-red-200 shadow-xl"
        >
          {fileError} · dismiss
        </button>
      )}

      <Modal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Keyboard shortcuts"
      >
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-xs text-zinc-400">
          {[
            ["Play / pause", "Space"],
            ["Step one frame", "← / →"],
            ["Mark in / out", "I / O"],
            ["Split at playhead", "S"],
            ["Ripple delete", "Shift+Delete"],
            ["Undo / redo", "Ctrl+Z / Ctrl+Y"],
            ["Zoom timeline", "Timeline menu"],
          ].map(([label, keys]) => (
            <div key={label} className="contents">
              <dt>{label}</dt>
              <dd className="font-mono text-[11px] text-zinc-200">{keys}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      <Modal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="Forgevyn Studio"
      >
        <p className="text-sm leading-6 text-zinc-300">
          A client-side, high-density video studio inspired by professional
          NLEs. All media, edits, and renders stay on your device.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          DaVinci-style workspace shell · Source/Program dual monitors · Local
          persistence.
        </p>
      </Modal>
      <Modal
        open={updateOpen}
        onClose={() => {
          if (!updateChecking) setUpdateOpen(false);
        }}
        title="Check for updates"
      >
        {updateChecking || !updateOutcome ? (
          <div className="flex items-center gap-3 rounded-md border border-studio-border bg-[#121316] p-4">
            <Loader2 className="h-5 w-5 animate-spin text-violet-300" aria-hidden />
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Checking GitHub Releases…
              </p>
              <p className="mt-1 break-all text-[10px] text-zinc-600">
                {UPDATER_ENDPOINT}
              </p>
            </div>
          </div>
        ) : updateOutcome.status === "available" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Update v{updateOutcome.update.version} is available
            </p>
            <p className="text-xs text-zinc-400">
              You are running v{updateOutcome.currentVersion}. The update banner
              is ready below — choose Update Now to download and restart.
            </p>
          </div>
        ) : updateOutcome.status === "uptodate" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              You&apos;re up to date
            </p>
            <p className="text-xs text-zinc-400">
              Current version: v{updateOutcome.currentVersion}. No newer signed
              release is published at this endpoint.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-red-300">
              <AlertCircle className="h-4 w-4" aria-hidden />
              Update check failed
            </p>
            <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
              {updateOutcome.error}
            </p>
            <p className="text-xs leading-5 text-zinc-500">
              Private GitHub repositories do not expose release assets to the
              updater. Make the release repository public or serve a public
              <code className="mx-1 rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
                latest.json
              </code>
              proxy.
            </p>
          </div>
        )}

        <p className="mt-4 break-all rounded-md border border-studio-border bg-[#121316] p-2 text-[10px] text-zinc-600">
          Endpoint: {updateOutcome?.endpoint ?? UPDATER_ENDPOINT}
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setUpdateOpen(false)}
            disabled={updateChecking}
            className="inline-flex items-center gap-1.5 rounded-md border border-studio-border px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {updateChecking ? "Checking…" : "Close"}
          </button>
        </div>
      </Modal>

    </>
  );
}
