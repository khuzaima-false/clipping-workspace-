/**
 * Client-side sticker / meme / emoji library.
 *
 * Emoji stickers are plain text overlays (rendered by the canvas text engine).
 * Graphic stickers (badges, arrows, buttons, lower-thirds) are generated as
 * inline SVG data URLs at runtime — no assets, no network, no server.
 */

export type StickerCategory = "emoji" | "badges" | "arrows" | "ui" | "lowerThirds";

export type Sticker = {
  id: string;
  label: string;
  category: StickerCategory;
  /** Emoji glyph for text stickers. */
  emoji?: string;
  /** Font size for emoji stickers (output px). */
  fontSize?: number;
  /** Inline SVG markup for graphic stickers. */
  svg?: string;
  /** Natural size of the graphic (for the data URL). */
  width?: number;
  height?: number;
};

export const STICKER_CATEGORIES: { id: StickerCategory; label: string }[] = [
  { id: "emoji", label: "Emoji" },
  { id: "badges", label: "Badges" },
  { id: "arrows", label: "Arrows" },
  { id: "ui", label: "Buttons" },
  { id: "lowerThirds", label: "Lower Thirds" },
];

function svgWrap(inner: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
}

function badge(label: string, bg: string, fg: string): string {
  return svgWrap(
    `<rect x="10" y="176" rx="52" width="492" height="160" fill="${bg}"/>` +
      `<text x="256" y="290" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="bold" fill="${fg}" text-anchor="middle">${label}</text>`,
    512,
    512
  );
}

function arrowShape(): string {
  return svgWrap(
    `<path d="M40 216 L300 216 L300 132 L488 256 L300 380 L300 296 L40 296 Z" fill="#facc15" stroke="#111827" stroke-width="12" stroke-linejoin="round"/>`,
    512,
    512
  );
}

function swirlArrow(): string {
  return svgWrap(
    `<path d="M120 380 C 80 200, 300 120, 420 220 L 470 170 L 470 300 L 340 300 L 380 260 C 300 200, 160 240, 180 380 Z" fill="#22d3ee" stroke="#0f172a" stroke-width="12" stroke-linejoin="round"/>`,
    512,
    512
  );
}

function downArrow(): string {
  return svgWrap(
    `<path d="M216 40 L216 300 L132 300 L256 488 L380 300 L296 300 L296 40 Z" fill="#f472b6" stroke="#111827" stroke-width="12" stroke-linejoin="round"/>`,
    512,
    512
  );
}

function curvedArrow(): string {
  return svgWrap(
    `<path d="M80 380 C 80 160, 300 120, 400 200 L 448 150 L 448 310 L 288 310 L 330 268 C 250 200, 150 230, 150 380 Z" fill="#a855f7" stroke="#111827" stroke-width="12" stroke-linejoin="round"/>`,
    512,
    512
  );
}

function pillButton(label: string, bg: string): string {
  return svgWrap(
    `<rect x="52" y="188" rx="22" width="408" height="136" fill="${bg}"/>` +
      `<text x="256" y="280" font-family="Arial, Helvetica, sans-serif" font-size="60" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>`,
    512,
    512
  );
}

function speechBubble(): string {
  return svgWrap(
    `<rect x="40" y="120" rx="40" width="432" height="230" fill="#ffffff" stroke="#111827" stroke-width="12"/>` +
      `<path d="M160 348 L200 440 L250 348 Z" fill="#ffffff" stroke="#111827" stroke-width="12" stroke-linejoin="round"/>` +
      `<text x="256" y="258" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="bold" fill="#111827" text-anchor="middle">WOW!</text>`,
    512,
    512
  );
}

function starBurst(): string {
  let points = "";
  for (let i = 0; i < 16; i += 1) {
    const r = i % 2 === 0 ? 240 : 120;
    const a = (Math.PI * 2 * i) / 16 - Math.PI / 2;
    points += `${256 + Math.cos(a) * r},${256 + Math.sin(a) * r} `;
  }
  return svgWrap(
    `<polygon points="${points}" fill="#fbbf24" stroke="#111827" stroke-width="10" stroke-linejoin="round"/>` +
      `<text x="256" y="286" font-family="Arial, Helvetica, sans-serif" font-size="80" font-weight="bold" fill="#111827" text-anchor="middle">NEW</text>`,
    512,
    512
  );
}

function lowerThird(title: string, subtitle: string, bar: string, accent: string): string {
  return svgWrap(
    `<rect x="0" y="322" width="700" height="160" fill="${bar}" opacity="0.94"/>` +
      `<rect x="0" y="322" width="20" height="160" fill="${accent}"/>` +
      `<text x="44" y="404" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="bold" fill="#ffffff">${title}</text>` +
      `<text x="46" y="452" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#e5e7eb">${subtitle}</text>`,
    700,
    512
  );
}

const EMOJIS: string[] = [
  "🔥", "😂", "❤️", "👍", "🎉", "⭐", "✅", "😮",
  "😎", "💯", "🚀", "💰", "😭", "🙌", "👀", "🤯",
  "💪", "✨", "🎯", "⚡", "🏆", "🎬", "📣", "💥",
];

const emojiStickers: Sticker[] = EMOJIS.map((emoji, index) => ({
  id: `emoji-${index}`,
  label: emoji,
  category: "emoji",
  emoji,
  fontSize: 180,
}));

export const STICKERS: Sticker[] = [
  ...emojiStickers,
  // Badges
  { id: "badge-new", label: "NEW", category: "badges", svg: badge("NEW", "#22c55e", "#052e16"), width: 512, height: 512 },
  { id: "badge-sale", label: "SALE", category: "badges", svg: badge("SALE", "#f97316", "#431407"), width: 512, height: 512 },
  { id: "badge-live", label: "LIVE", category: "badges", svg: badge("LIVE", "#ef4444", "#ffffff"), width: 512, height: 512 },
  { id: "badge-top", label: "TOP 10", category: "badges", svg: badge("TOP 10", "#6366f1", "#ffffff"), width: 512, height: 512 },
  { id: "badge-hot", label: "HOT", category: "badges", svg: badge("HOT", "#f43f5e", "#ffffff"), width: 512, height: 512 },
  { id: "badge-free", label: "FREE", category: "badges", svg: badge("FREE", "#10b981", "#052e16"), width: 512, height: 512 },
  { id: "badge-vip", label: "VIP", category: "badges", svg: badge("VIP", "#facc15", "#422006"), width: 512, height: 512 },
  { id: "badge-100", label: "100%", category: "badges", svg: badge("100%", "#0ea5e9", "#ffffff"), width: 512, height: 512 },
  // Arrows
  { id: "arrow", label: "Arrow", category: "arrows", svg: arrowShape(), width: 512, height: 512 },
  { id: "arrow-swirl", label: "Swirl", category: "arrows", svg: swirlArrow(), width: 512, height: 512 },
  { id: "arrow-down", label: "Down", category: "arrows", svg: downArrow(), width: 512, height: 512 },
  { id: "arrow-curved", label: "Curved", category: "arrows", svg: curvedArrow(), width: 512, height: 512 },
  // Buttons
  { id: "subscribe", label: "Subscribe", category: "ui", svg: pillButton("SUBSCRIBE", "#ef4444"), width: 512, height: 512 },
  { id: "like", label: "Like", category: "ui", svg: pillButton("LIKE", "#0ea5e9"), width: 512, height: 512 },
  { id: "follow", label: "Follow", category: "ui", svg: pillButton("FOLLOW", "#8b5cf6"), width: 512, height: 512 },
  { id: "share", label: "Share", category: "ui", svg: pillButton("SHARE", "#14b8a6"), width: 512, height: 512 },
  { id: "shop", label: "Shop Now", category: "ui", svg: pillButton("SHOP NOW", "#f59e0b"), width: 512, height: 512 },
  { id: "bubble", label: "Speech Box", category: "ui", svg: speechBubble(), width: 512, height: 512 },
  { id: "burst", label: "Star Burst", category: "ui", svg: starBurst(), width: 512, height: 512 },
  // Lower thirds
  { id: "lower-third", label: "Lower Third", category: "lowerThirds", svg: lowerThird("YOUR NAME", "@handle · title", "#5b21b6", "#22d3ee"), width: 700, height: 512 },
  { id: "lower-third-gold", label: "Gold Banner", category: "lowerThirds", svg: lowerThird("PLAYER NAME", "team · position", "#78350f", "#fbbf24"), width: 700, height: 512 },
  { id: "lower-third-blue", label: "Blue Banner", category: "lowerThirds", svg: lowerThird("GUEST NAME", "show · episode", "#1e3a8a", "#38bdf8"), width: 700, height: 512 },
];

/** Encodes sticker SVG markup as an image data URL. */
export function stickerImageSrc(sticker: Sticker): string | null {
  if (!sticker.svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sticker.svg)}`;
}
