export const GITHUB_REPO = (
  process.env.NEXT_PUBLIC_GITHUB_REPO ?? "khuzaima-false/clipping-workspace-"
).replace(/^\/+|\/+$/g, "");

export const DESKTOP_RELEASE_TAG =
  process.env.NEXT_PUBLIC_DESKTOP_RELEASE_TAG?.trim() ?? "";

export const DESKTOP_RELEASE_PUBLISHED = DESKTOP_RELEASE_TAG.length > 0;

/** Keep in sync with `src-tauri/tauri.conf.json` + `Cargo.toml`. */
export const APP_VERSION = "0.1.6";

export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

/** A configured tag (e.g. `v0.1.0`) is authoritative for asset names. */
export const RELEASE_VERSION = (DESKTOP_RELEASE_TAG || `v${APP_VERSION}`).replace(
  /^v/,
  ""
);

export const releaseAssetUrl = (asset: string) =>
  `${RELEASES_URL}/download/${DESKTOP_RELEASE_TAG}/${asset}`;

export const DESKTOP_PLATFORMS = [
  {
    id: "windows",
    label: "Windows",
    detail: "64-bit installer",
    extension: ".exe",
    asset: `Forgevyn_${RELEASE_VERSION}_x64-setup.exe`,
  },
  {
    id: "macos",
    label: "macOS",
    detail: "Apple Silicon & Intel",
    extension: ".dmg",
    asset: `Forgevyn_${RELEASE_VERSION}_universal.dmg`,
  },
  {
    id: "linux",
    label: "Linux",
    detail: "AppImage / .deb",
    extension: ".AppImage",
    asset: `Forgevyn_${RELEASE_VERSION}_amd64.AppImage`,
  },
] as const;
