/**
 * Local desktop identity.
 *
 * The Tauri shell is 100% local-first: it never signs in, never reads a cloud
 * session, and never shows a login wall. Components that need an "authenticated
 * user" in the desktop shell receive this stable local identity instead.
 */

export type LocalDesktopUser = {
  id: string;
  email: string;
  displayName: string;
};

export const LOCAL_DESKTOP_USER: LocalDesktopUser = {
  id: "local-desktop-user",
  email: "desktop@local.forgevyn",
  displayName: "Desktop Editor",
};

export const LOCAL_DESKTOP_SESSION = {
  user: LOCAL_DESKTOP_USER,
  isAuthenticated: true,
  mode: "local",
} as const;
