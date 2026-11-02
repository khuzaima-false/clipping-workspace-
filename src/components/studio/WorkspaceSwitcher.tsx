"use client";

import { cn } from "@/lib/utils";
import {
  WORKSPACE_PAGES,
  type WorkspacePage,
} from "@/components/studio/EditorMenuBar";

/**
 * DaVinci-style page switcher pinned to the bottom of the studio.
 * Presentational: the parent maps each page to the relevant panel/action.
 */
export function WorkspaceSwitcher({
  active,
  onChange,
}: {
  active: WorkspacePage;
  onChange: (page: WorkspacePage) => void;
}) {
  return (
    <nav
      aria-label="Workspace pages"
      data-tour="workspace-switcher"
      className="sticky bottom-0 z-30 hidden h-9 shrink-0 items-center justify-center gap-1 border-t border-studio-border bg-studio-panel px-2 md:flex"
    >
      {WORKSPACE_PAGES.map((page) => {
        const Icon = page.icon;
        const selected = active === page.id;
        return (
          <button
            key={page.id}
            type="button"
            title={page.hint}
            aria-current={selected ? "page" : undefined}
            aria-pressed={selected}
            onClick={() => onChange(page.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              selected
                ? "bg-violet-600/20 text-violet-200 ring-1 ring-inset ring-violet-500/40"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {page.label}
          </button>
        );
      })}
    </nav>
  );
}
