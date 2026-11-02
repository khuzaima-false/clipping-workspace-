"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isEditorPath, isTauriEnvironment } from "@/lib/tauri";
import { activeLocalProjectId } from "@/lib/local-projects";
import { resolveStartupHref } from "@/lib/startup-router";

/**
 * Desktop route guard.
 *
 * The Project Manager dashboard and the editor are the two valid desktop
 * surfaces. Marketing, login, and OAuth routes return to the dashboard (or the
 * remembered project) before they can become a dead end.
 *
 * The inline script in the root layout performs the launch redirect before
 * first paint; this component covers client-side navigations. Renders nothing
 * and is a no-op in a regular browser.
 */
export function DesktopEntryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    if (isEditorPath(pathname)) return;
    if (
      pathname === "/dashboard" ||
      pathname === "/dashboard.html" ||
      pathname?.startsWith("/dashboard/")
    ) {
      return;
    }
    // The landing page carries its own black-screen guard.
    if (pathname === "/") return;
    router.replace(resolveStartupHref(activeLocalProjectId()));
  }, [pathname, router]);

  return null;
}
