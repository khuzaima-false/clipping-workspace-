"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTauri } from "@/lib/tauri";

/**
 * Client-side safety net for the desktop entry redirect.
 *
 * The inline script in the root layout performs the redirect before first
 * paint (no marketing flash). This component covers the cases where that
 * script could not run — e.g. a future CSP that blocks inline scripts — by
 * issuing the same navigation once React has hydrated.
 *
 * Renders nothing and is a no-op in a regular browser.
 */
export function DesktopEntryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isTauri()) return;
    if (pathname !== "/" && pathname !== "/index.html") return;
    router.replace("/editor");
  }, [pathname, router]);

  return null;
}
