import type { MetadataRoute } from "next";

// Required so the route can be emitted by `output: "export"`.
export const dynamic = "force-static";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://forgevyn.com"
).replace(/\/+$/, "");

/**
 * Lets crawlers index the public entry points while keeping the
 * authenticated workspace, auth callbacks, and per-user referral pages out of
 * search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/projects",
          "/channels",
          "/campaigns",
          "/settings",
          "/editor/",
          "/auth/",
          "/ref/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
