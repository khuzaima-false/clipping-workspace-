import type { MetadataRoute } from "next";

// Required so the route can be emitted by `output: "export"`.
export const dynamic = "force-static";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://forgevyn.com"
).replace(/\/+$/, "");

/**
 * Public, crawlable URLs for Google Search Console.
 *
 * The workspace routes require authentication and are excluded via
 * `robots.txt`; only the marketing/entry pages are listed here. Note that `/`
 * redirects signed-out visitors to `/login` (and signed-in users to the
 * dashboard), so remove it if Search Console reports it as a redirect.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
