"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isEditorPath, isTauriEnvironment } from "@/lib/tauri";
import { getOrCreateLocalProject } from "@/lib/local-projects";

/**
 * Desktop route guard: the Tauri app is local-first, so any route other than
 * `/editor` (marketing, login, dashboard, projects, OAuth callbacks…) is sent
 * straight back to the local studio.
 *
 * The inline script in the root layout performs this before first paint; this
 * component covers client-side navigations and the case where the inline
 * script could not run (e.g. a future CSP that blocks inline scripts).
 *
 * Renders nothing and is a no-op in a regular browser.
 */
export function DesktopEntryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    if (isEditorPath(pathname)) return;
    // The landing page carries its own black-screen guard.
    if (pathname === "/") return;
    // Reuse the remembered project or create the first desktop project.
    router.replace(`/editor?id=${getOrCreateLocalProject()}`);
  }, [pathname, router]);

  return null;
}
