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

function subscribeButton(): string {
  return svgWrap(
    `<rect x="52" y="188" rx="22" width="408" height="136" fill="#ef4444"/>` +
      `<text x="256" y="280" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">SUBSCRIBE</text>`,
    512,
    512
  );
}

function likeButton(): string {
  return svgWrap(
    `<rect x="70" y="196" rx="28" width="372" height="120" fill="#0ea5e9"/>` +
      `<text x="256" y="276" font-family="Arial, Helvetica, sans-serif" font-size="60" font-weight="bold" fill="#ffffff" text-anchor="middle">LIKE</text>`,
    512,
    512
  );
}

function lowerThird(): string {
  return svgWrap(
    `<rect x="0" y="322" width="700" height="160" fill="#5b21b6" opacity="0.92"/>` +
      `<rect x="0" y="322" width="20" height="160" fill="#22d3ee"/>` +
      `<text x="44" y="404" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="bold" fill="#ffffff">YOUR NAME</text>` +
      `<text x="46" y="454" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#c7d2fe">@handle · title</text>`,
    700,
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

const EMOJIS: { emoji: string; label: string }[] = [
  { emoji: "🔥", label: "Fire" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "👍", label: "Thumbs Up" },
  { emoji: "🎉", label: "Party" },
  { emoji: "⭐", label: "Star" },
  { emoji: "✅", label: "Check" },
  { emoji: "😮", label: "Wow" },
  { emoji: "😎", label: "Cool" },
  { emoji: "💯", label: "Hundred" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "💰", label: "Money" },
];

export const STICKERS: Sticker[] = [
  ...EMOJIS.map((item) => ({
    id: `emoji-${item.label.toLowerCase().replace(/\s+/g, "-")}`,
    label: item.label,
    category: "emoji" as const,
    emoji: item.emoji,
    fontSize: 180,
  })),
  { id: "badge-new", label: "NEW", category: "badges", svg: badge("NEW", "#22c55e", "#052e16"), width: 512, height: 512 },
  { id: "badge-sale", label: "SALE", category: "badges", svg: badge("SALE", "#f97316", "#431407"), width: 512, height: 512 },
  { id: "badge-live", label: "LIVE", category: "badges", svg: badge("LIVE", "#ef4444", "#ffffff"), width: 512, height: 512 },
  { id: "badge-top", label: "TOP 10", category: "badges", svg: badge("TOP 10", "#6366f1", "#ffffff"), width: 512, height: 512 },
  { id: "arrow", label: "Arrow", category: "arrows", svg: arrowShape(), width: 512, height: 512 },
  { id: "arrow-swirl", label: "Swirl", category: "arrows", svg: swirlArrow(), width: 512, height: 512 },
  { id: "subscribe", label: "Subscribe", category: "ui", svg: subscribeButton(), width: 512, height: 512 },
  { id: "like", label: "Like", category: "ui", svg: likeButton(), width: 512, height: 512 },
  { id: "bubble", label: "Speech Box", category: "ui", svg: speechBubble(), width: 512, height: 512 },
  { id: "lower-third", label: "Lower Third", category: "lowerThirds", svg: lowerThird(), width: 700, height: 512 },
];

/** Encodes sticker SVG markup as an image data URL. */
export function stickerImageSrc(sticker: Sticker): string | null {
  if (!sticker.svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sticker.svg)}`;
}
