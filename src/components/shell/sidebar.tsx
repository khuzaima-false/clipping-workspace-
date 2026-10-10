"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdSlot } from "@/components/credits/ad-slot";
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
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 lg:static lg:h-full lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-zinc-800 px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Clapperboard className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              Forgevyn
              <span className="text-zinc-500"> Clipping</span>
            </span>
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-violet-600/15 text-violet-300 ring-1 ring-inset ring-violet-500/30"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="rounded-lg bg-zinc-900 p-3">
            <p className="text-xs font-medium text-zinc-300">Export queue</p>
            <p className="mt-1 text-xs text-zinc-500">
              No renders in progress.
            </p>
          </div>

          {/* Sidebar banner ad placement (hidden for ad-free accounts). */}
          <AdSlot variant="sidebar" className="mt-3" />
        </div>
      </aside>
    </>
  );
}
