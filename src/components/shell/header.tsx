"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  HardDrive,
  LogIn,
  Menu,
  Search,
  User,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AuthModal } from "@/components/auth/auth-modal";
import { Logo } from "@/components/ui/logo";
import { useWorkspaceStore } from "@/store/workspace";
import { useAuth } from "@/hooks/use-auth";
import { useIsTauri } from "@/hooks/use-is-tauri";
import { isTauriEnvironment } from "@/lib/tauri";

type HeaderProps = {
  onMenuClick: () => void;
  /**
   * `editor` renders the stripped-back studio bar: brand + "Back to Projects"
   * only, with the channel switcher, search and nav rail removed.
   */
  variant?: "default" | "editor";
};

export function Header({ onMenuClick, variant = "default" }: HeaderProps) {
  const isEditor = variant === "editor";
  const desktop = useIsTauri();
  const [channelOpen, setChannelOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [cloudSignedIn, setCloudSignedIn] = useState(false);

  const channels = useWorkspaceStore((state) => state.channels);
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const setActiveChannel = useWorkspaceStore((state) => state.setActiveChannel);
  const loadChannels = useWorkspaceStore((state) => state.loadChannels);
  const channelsLoading = useWorkspaceStore((state) => state.channelsLoading);

  const profile = useWorkspaceStore((state) => state.profile);
  const loadProfile = useWorkspaceStore((state) => state.loadProfile);

  // Centralized auth: in the desktop shell this returns the local identity and
  // never creates a Supabase client. In the browser it tracks the real session.
  const {
    isAuthenticated,
    loading: authLoading,
    isLocalDesktop,
  } = useAuth();

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  const channelRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTauriEnvironment()) return;
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (isTauriEnvironment()) return;
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (
        channelRef.current &&
        !channelRef.current.contains(event.target as Node)
      ) {
        setChannelOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/70 px-4 backdrop-blur-xl sm:px-6" data-tour="header-bar">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className={cn(
          "rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 lg:hidden",
          isEditor && "hidden"
        )}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {/* Brand — in the studio it is the only left-side element. */}
      <Link
        href="/dashboard"
        aria-label="Forgevyn Clipping home"
        className={cn("flex items-center", !isEditor && "lg:hidden")}
      >
        <Logo size="sm" />
      </Link>

      {/* Active channel switcher — global Zustand state (studio omits it) */}
      {!isEditor && (
      <div className="relative" ref={channelRef}>
        <button
          type="button"
          onClick={() => {
            setChannelOpen((v) => !v);
            setProfileOpen(false);
          }}
          aria-haspopup="menu"
          aria-expanded={channelOpen}
          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              activeChannel ? "bg-emerald-500" : "bg-zinc-500"
            )}
            aria-hidden
          />
          <span className="max-w-32 truncate sm:max-w-56">
            {activeChannel ? activeChannel.name : "All channels"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-500 transition-transform",
              channelOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>

        {channelOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl shadow-black/40"
          >
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Switch channel
            </p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setActiveChannel(null);
                setChannelOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                activeChannelId === null
                  ? "bg-violet-600/15 text-violet-300"
                  : "text-zinc-300 hover:bg-zinc-800"
              )}
            >
              All channels
            </button>
            {channels.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-600">
                {channelsLoading
                  ? "Loading channels…"
                  : "No channels yet — add one on the Channels page."}
              </p>
            )}
            {channels.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setActiveChannel(item.id);
                  setChannelOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  item.id === activeChannelId
                    ? "bg-violet-600/15 text-violet-300"
                    : "text-zinc-300 hover:bg-zinc-800"
                )}
              >
                <span className="truncate">{item.name}</span>
                <span className="ml-auto shrink-0 text-xs text-zinc-600">
                  {item.platform}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Search placeholder (studio omits it) */}
      {!isEditor && (
      <div className="hidden flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 md:flex">
        <Search className="h-4 w-4 text-zinc-500" aria-hidden />
        <input
          type="search"
          placeholder="Search projects, clips, sponsorships…"
          className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
      )}
      <div className={cn("flex-1", !isEditor && "md:hidden")} />

      {isEditor && !desktop && (
        <Link
          href="/projects"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-violet-500/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Projects
        </Link>
      )}

      {/* Desktop shell: local identity, never a cloud sign-in wall.
          Web: user profile menu, or a sign-in CTA when signed out. */}
      {isLocalDesktop ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-400">
            <HardDrive className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            Local
          </span>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-violet-500/60 hover:text-white"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden />
            {cloudSignedIn ? "Cloud linked" : "Cloud sign-in"}
          </button>
        </div>
      ) : authLoading ? (
        <span
          aria-hidden
          className="h-8 w-8 animate-pulse rounded-full border border-zinc-800 bg-zinc-900"
        />
      ) : !isAuthenticated ? (
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Sign in
        </button>
      ) : (
        <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={() => {
            setProfileOpen((v) => !v);
            setChannelOpen(false);
          }}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          aria-label="Open profile menu"
          className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-1.5 transition-colors hover:border-zinc-700"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-semibold text-white">
            {(
              profile?.display_name?.trim()?.[0] ||
              profile?.email?.[0] ||
              "F"
            ).toUpperCase()}
          </span>
          <ChevronsUpDown className="h-4 w-4 text-zinc-500" aria-hidden />
        </button>

        {profileOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl shadow-black/40"
          >
            <div className="border-b border-zinc-800 px-3 py-2.5">
              <p className="truncate text-sm font-medium text-zinc-100">
                {profile?.display_name || "Creator"}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {profile?.email || "creator@forgevyn.app"}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <User className="h-4 w-4" aria-hidden />
              Profile
            </button>
            <SignOutButton />
          </div>
        )}
        </div>
      )}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => setCloudSignedIn(true)}
      />
    </header>
  );
}
