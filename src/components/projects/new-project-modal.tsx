"use client";

import { useState } from "react";
import { AlertCircle, FolderOpen, FolderPlus, HardDrive, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useIsTauri } from "@/hooks/use-is-tauri";
import { isTauriEnvironment } from "@/lib/tauri";
import { createLocalProject } from "@/lib/local-projects";
import { createProjectDirectory, getProjectParent, pickProjectFolder } from "@/lib/project-fs";
import { saveProjectManifest } from "@/lib/project-fs";
import { serializeProject } from "@/lib/project-file";
import { cn } from "@/lib/utils";

type StorageMode = "app" | "custom" | "desktop";

const STORAGE_OPTIONS: {
  id: StorageMode;
  title: string;
  description: string;
  icon: typeof HardDrive;
}[] = [
  {
    id: "app",
    title: "Default App Storage",
    description: "%APPDATA% on Windows · ~/.config/forgevyn on macOS/Linux",
    icon: HardDrive,
  },
  {
    id: "custom",
    title: "Select Custom Folder",
    description: "Choose an existing parent folder with the system picker",
    icon: FolderOpen,
  },
  {
    id: "desktop",
    title: "Create New Folder on Desktop",
    description: "Create a named project folder directly on your Desktop",
    icon: FolderPlus,
  },
];

export function NewProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const desktop = useIsTauri();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<StorageMode>("app");
  const [customParent, setCustomParent] = useState<string | null>(null);
  const [desktopFolder, setDesktopFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setMode("app");
    setCustomParent(null);
    setDesktopFolder("");
    setBusy(false);
    setError(null);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function chooseCustomParent() {
    setError(null);
    const selected = await pickProjectFolder();
    if (selected) setCustomParent(selected);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Give your project a title first.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const inDesktopShell = isTauriEnvironment();
      if (!inDesktopShell) {
        const id = createLocalProject({
          title: cleanTitle,
          storageMode: "browser",
          status: "draft",
        });
        onCreated(id);
        reset();
        return;
      }

      let parent: string | null = null;
      if (mode === "custom") {
        parent = customParent;
        if (!parent) {
          setError("Choose a parent folder first.");
          return;
        }
      } else if (mode === "desktop") {
        parent = await getProjectParent("desktop");
      } else {
        parent = await getProjectParent("app");
      }

      if (!parent) {
        setError("Could not resolve the selected storage folder.");
        return;
      }

      const folderName =
        (mode === "desktop" ? desktopFolder.trim() : "") || cleanTitle;
      const directory = await createProjectDirectory(parent, folderName);
      if (!directory) {
        setError("Could not create the project folder.");
        return;
      }

      const id = createLocalProject({
        title: cleanTitle,
        storageMode: mode,
        rootPath: directory.path,
        manifestPath: directory.projectJsonPath,
        status: "draft",
      });

      // Replace the Rust seed with the real project identity. This also writes
      // the first commit snapshot under .forgevyn/commits/.
      const manifest = serializeProject({
        id,
        title: cleanTitle,
        settings: { storageMode: mode, rootPath: directory.path },
        media: {
          assets: [],
          sequence: [],
          overlays: [],
          audio: [],
          currentTime: 0,
          savedAt: Date.now(),
        },
      });
      await saveProjectManifest(directory.projectJsonPath, manifest);
      onCreated(id);
      reset();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the project."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Create new project"
      onClose={close}
      className="max-w-2xl border-studio-border bg-studio-panel"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            htmlFor="new-project-title"
            className="mb-1.5 block text-xs font-medium text-zinc-300"
          >
            Project title <span className="text-violet-400">*</span>
          </label>
          <input
            id="new-project-title"
            autoFocus
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!desktopFolder) setDesktopFolder(event.target.value);
            }}
            placeholder="October highlight reel"
            className="w-full rounded-md border border-studio-border bg-[#0f1013] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-300">
            Where should this project live?
          </p>
          <div
            role="radiogroup"
            aria-label="Project storage location"
            className="space-y-2"
          >
            {STORAGE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const disabled = !desktop && option.id !== "app";
              const selected = mode === option.id;
              return (
                <div
                  key={option.id}
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={disabled}
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => {
                    if (disabled) return;
                    setMode(option.id);
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (disabled) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setMode(option.id);
                      setError(null);
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                    selected
                      ? "border-violet-500/60 bg-violet-500/10"
                      : "border-studio-border bg-[#121316] hover:border-zinc-600",
                    disabled && "cursor-not-allowed opacity-45"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                      selected
                        ? "bg-violet-500/15 text-violet-300 ring-violet-500/40"
                        : "bg-zinc-800/70 text-zinc-500 ring-zinc-700"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      {option.title}
                      {disabled && (
                        <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500">
                          Desktop only
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">
                      {option.id === "app" && !desktop
                        ? "Browser IndexedDB · saved on this device"
                        : option.description}
                    </span>
                    {option.id === "custom" && selected && desktop && (
                      <span className="mt-2 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate rounded border border-studio-border bg-studio-bg px-2 py-1 text-[10px] text-zinc-400">
                          {customParent ?? "No folder selected"}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void chooseCustomParent();
                          }}
                          className="shrink-0 rounded border border-studio-border bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-200 hover:border-violet-500/60"
                        >
                          Browse
                        </button>
                      </span>
                    )}
                    {option.id === "desktop" && selected && desktop && (
                      <span className="mt-2 block" onClick={(event) => event.stopPropagation()}>
                        <input
                          value={desktopFolder}
                          onChange={(event) => setDesktopFolder(event.target.value)}
                          placeholder="Folder name on Desktop"
                          className="w-full rounded border border-studio-border bg-studio-bg px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                        />
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {!desktop && (
            <p className="mt-2 text-[11px] text-zinc-500">
              The browser stores projects in IndexedDB. Install the desktop app
              to use app-data or filesystem folders.
            </p>
          )}
          <p className="mt-2 text-[11px] text-zinc-600">
            Source media stays on this device and is referenced from the project
            manifest — it is never duplicated.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-studio-border pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-md border border-studio-border px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
