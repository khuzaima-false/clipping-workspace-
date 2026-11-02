"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { NAV_ITEMS } from "./nav-items";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile scrim */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-80 flex-col overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl transition-transform duration-200 lg:static lg:h-full lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-zinc-800 px-5">
          <Link href="/dashboard" className="flex items-center" onClick={onClose}>
            <Logo size="md" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-violet-600/15 text-violet-200 ring-1 ring-inset ring-violet-500/30"
                    : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100"
                )}
              >
                {active && (
                  <span className="brand-gradient absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    active
                      ? "text-violet-300"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className="shrink-0 rounded-full bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="glass-card rounded-lg p-3">
            <p className="text-xs font-medium text-zinc-300">Export queue</p>
            <p className="mt-1 text-xs text-zinc-500">
              No renders in progress.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
