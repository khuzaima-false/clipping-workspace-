#!/usr/bin/env node
/**
 * Normalize a Tauri updater manifest for public GitHub Releases.
 *
 * Tauri's release action can emit `api.github.com/repos/.../releases/assets/<id>`
 * URLs. Those endpoints are rate-limited for unauthenticated updater clients and
 * are not the stable browser download URLs we want shipped in `latest.json`.
 *
 * This script maps each platform entry to the release asset's public
 * `browser_download_url` and fails if any entry cannot be resolved.
 *
 * Usage:
 *   node scripts/normalize-updater-manifest.mjs <latest.json> <release.json>
 */

import { readFileSync, writeFileSync } from "node:fs";

const [manifestPath, releasePath] = process.argv.slice(2);
if (!manifestPath || !releasePath) {
  console.error(
    "Usage: node scripts/normalize-updater-manifest.mjs <latest.json> <release.json>"
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const release = JSON.parse(readFileSync(releasePath, "utf8"));

if (!manifest.platforms || typeof manifest.platforms !== "object") {
  throw new Error("latest.json has no platforms object");
}
if (!Array.isArray(release.assets)) {
  throw new Error("release.json has no assets array");
}

const directUrlById = new Map(
  release.assets.map((asset) => [String(asset.id), asset.browser_download_url])
);

const apiAssetPattern =
  /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/assets\/(\d+)(?:\?.*)?$/;

let normalized = 0;
for (const [platform, entry] of Object.entries(manifest.platforms)) {
  if (!entry || typeof entry.url !== "string") {
    throw new Error(`Platform ${platform} has no download URL`);
  }

  const match = entry.url.match(apiAssetPattern);
  if (match) {
    const directUrl = directUrlById.get(match[1]);
    if (!directUrl) {
      throw new Error(
        `Platform ${platform} points at release asset ${match[1]}, but that asset is missing from the release`
      );
    }
    entry.url = directUrl;
    normalized += 1;
  }

  if (!entry.url.startsWith("https://github.com/")) {
    throw new Error(
      `Platform ${platform} still has a non-public download URL: ${entry.url}`
    );
  }
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  `Normalized ${normalized} updater URL(s); all platform URLs are public release downloads.`
);
