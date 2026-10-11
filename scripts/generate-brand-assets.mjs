#!/usr/bin/env node
/**
 * Generates the static brand assets from the shared mark geometry in
 * `src/lib/brand-mark.json` (the same source the <Logo /> component uses).
 *
 * Outputs:
 *   public/logo.png      512x512 transparent PNG
 *   public/favicon.ico   multi-size ICO (16/32/48/64), PNG-encoded
 *   public/og-image.png  1200x630 Open Graph / social card
 *
 * Usage: npm run brand:assets
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(root, "public");
const appDir = resolve(root, "src/app");
const mark = JSON.parse(
  readFileSync(resolve(root, "src/lib/brand-mark.json"), "utf8")
);

const { viewBox, path: markPath, gradientFrom, gradientTo } = mark;

const FONT_STACK = "Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif";

/** Full standalone SVG for the mark, with an optional viewBox override. */
function markSvg({ width, height, viewBoxOverride = viewBox }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBoxOverride}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${gradientFrom}"/>
      <stop offset="1" stop-color="${gradientTo}"/>
    </linearGradient>
  </defs>
  <path d="${markPath}" fill="url(#g)" fill-rule="evenodd" clip-rule="evenodd"/>
</svg>`;
}

/** The mark re-centered into a square viewBox so it sits evenly in the canvas. */
function centeredMarkSvg(size) {
  // Glyph bounds in the source viewBox are roughly x:6..44, y:8..44.
  const cx = (6 + 44) / 2;
  const cy = (8 + 44) / 2;
  const side = 48;
  const vb = `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;
  return markSvg({ width: size, height: size, viewBoxOverride: vb });
}

function ogSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${gradientFrom}"/>
      <stop offset="1" stop-color="${gradientTo}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.32" cy="0.42" r="0.55">
      <stop offset="0" stop-color="${gradientFrom}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${gradientFrom}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="#09090b"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <g transform="translate(300 226)">
    <path transform="scale(3.2)" d="${markPath}" fill="url(#g)" fill-rule="evenodd" clip-rule="evenodd"/>
  </g>

  <text x="482" y="322" font-family="${FONT_STACK}" font-size="86" font-weight="700"
        fill="#f4f4f5" letter-spacing="3">FORGEVYN</text>
  <text x="488" y="372" font-family="${FONT_STACK}" font-size="30" font-weight="300"
        fill="#a1a1aa" letter-spacing="15">CLIPPING</text>

  <text x="600" y="540" text-anchor="middle" font-family="${FONT_STACK}" font-size="30"
        font-weight="400" fill="#a1a1aa">1080p video-clipping workspace</text>
  <text x="600" y="584" text-anchor="middle" font-family="${FONT_STACK}" font-size="22"
        font-weight="400" fill="#52525b" letter-spacing="2">forgevyn.com</text>
</svg>`;
}

/** Assembles a PNG-encoded .ico container from [{ size, png }] entries. */
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;

  entries.forEach((entry, i) => {
    const b = i * 16;
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, b + 0); // width
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, b + 1); // height
    dir.writeUInt8(0, b + 2); // palette colours
    dir.writeUInt8(0, b + 3); // reserved
    dir.writeUInt16LE(1, b + 4); // colour planes
    dir.writeUInt16LE(32, b + 6); // bits per pixel
    dir.writeUInt32LE(entry.png.length, b + 8); // size of data
    dir.writeUInt32LE(offset, b + 12); // offset of data
    offset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

async function main() {
  mkdirSync(publicDir, { recursive: true });

  // 1. Logo — 512x512 transparent.
  const logo = await sharp(Buffer.from(centeredMarkSvg(512)))
    .resize(512, 512)
    .png()
    .toBuffer();
  writeFileSync(resolve(publicDir, "logo.png"), logo);

  // 2. Favicon — PNG frames wrapped into a multi-size .ico. Written to
  //    `public/` and mirrored into `src/app/` so Next's file convention serves
  //    the same brand icon at /favicon.ico.
  const icoSizes = [16, 32, 48, 64];
  const icoEntries = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      png: await sharp(Buffer.from(markSvg({ width: size * 4, height: size * 4 })))
        .resize(size, size)
        .png()
        .toBuffer(),
    }))
  );
  const ico = buildIco(icoEntries);
  writeFileSync(resolve(publicDir, "favicon.ico"), ico);
  mkdirSync(appDir, { recursive: true });
  writeFileSync(resolve(appDir, "favicon.ico"), ico);

  // 2b. PNG icon + apple touch icon via Next's file conventions, so a fresh
  //     (non-cached) icon path is emitted alongside /favicon.ico.
  const appIcon = await sharp(Buffer.from(centeredMarkSvg(512)))
    .resize(512, 512)
    .png()
    .toBuffer();
  writeFileSync(resolve(appDir, "icon.png"), appIcon);

  const appleIcon = await sharp(Buffer.from(centeredMarkSvg(180)))
    .resize(180, 180)
    .png()
    .toBuffer();
  writeFileSync(resolve(appDir, "apple-icon.png"), appleIcon);

  // 3. Open Graph card — 1200x630.
  const og = await sharp(Buffer.from(ogSvg()))
    .resize(1200, 630)
    .png()
    .toBuffer();
  writeFileSync(resolve(publicDir, "og-image.png"), og);

  console.log("Brand assets written:");
  console.log(`  public/logo.png        ${logo.length} bytes (512x512)`);
  console.log(`  public/favicon.ico     ${icoSizes.join("/")} (${ico.length} bytes)`);
  console.log(`  src/app/favicon.ico    ${ico.length} bytes (mirrored)`);
  console.log(`  src/app/icon.png       ${appIcon.length} bytes (512x512)`);
  console.log(`  src/app/apple-icon.png ${appleIcon.length} bytes (180x180)`);
  console.log(`  public/og-image.png    ${og.length} bytes (1200x630)`);
}

main().catch((err) => {
  console.error("Failed to generate brand assets:", err);
  process.exit(1);
});
