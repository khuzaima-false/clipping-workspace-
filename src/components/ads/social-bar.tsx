"use client";

import { useEffect } from "react";
import { useIsAdFree } from "@/components/credits/use-ad-free";

/** Adsterra Social Bar loader. */
const SOCIAL_BAR_SRC =
  "https://bauval.org/14/fc7213d745b38648aab50dbe3ae4b845";

/**
 * Injects the Adsterra Social Bar script once, app-wide, for non-premium users.
 *
 * Uses a DOM script insertion (rather than `next/script`) so the exact loader
 * tag is reproduced and it can be cleanly removed when the account is ad-free.
 */
export function SocialBar() {
  const adFree = useIsAdFree();

  useEffect(() => {
    if (adFree) return;

    // Guard against duplicate injection across Fast Refresh / remounts.
    if (document.querySelector("script[data-adsterra-social-bar]")) return;

    const script = document.createElement("script");
    script.src = SOCIAL_BAR_SRC;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.dataset.adsterraSocialBar = "true";
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [adFree]);

  return null;
}
