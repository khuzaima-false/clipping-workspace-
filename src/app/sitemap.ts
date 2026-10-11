import type { MetadataRoute } from "next";

// Required so the route can be emitted by `output: "export"`.
export const dynamic = "force-static";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://forgevyn.com"
).replace(/\/+$/, "");

/**
 * Public, crawlable URLs for Google Search Console.
 *
 * `/` is now the marketing landing page (no redirect), so it is the primary
 * entry. The authenticated workspace routes are app-only and aren't listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
