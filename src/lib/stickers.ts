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

/** Parameterised arrow: solid block, chevron outline or thin stroke, rotated. */
function arrowSticker(
  color: string,
  rotate: number,
  variant: "solid" | "chevron" | "thin" = "solid"
): string {
  let inner: string;
  if (variant === "chevron") {
    inner = `<path d="M132 104 L360 256 L132 408" fill="none" stroke="${color}" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (variant === "thin") {
    inner = `<path d="M70 256 L430 256 M330 150 L440 256 L330 362" fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    inner = `<path d="M40 216 L300 216 L300 132 L488 256 L300 380 L300 296 L40 296 Z" fill="${color}" stroke="#111827" stroke-width="12" stroke-linejoin="round"/>`;
  }
  return svgWrap(`<g transform="rotate(${rotate} 256 256)">${inner}</g>`, 512, 512);
}

/** Outlined pill button (transparent fill). */
function outlineButton(label: string, color: string): string {
  return svgWrap(
    `<rect x="52" y="188" rx="22" width="408" height="136" fill="none" stroke="${color}" stroke-width="10"/>` +
      `<text x="256" y="278" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="bold" fill="${color}" text-anchor="middle">${label}</text>`,
    512,
    512
  );
}

/** Flat rounded badge with a label — used for the status/notification badges. */
function flatBadge(label: string, bg: string, fg: string): string {
  return svgWrap(
    `<rect x="46" y="196" rx="18" width="420" height="120" fill="${bg}"/>` +
      `<text x="256" y="276" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="bold" fill="${fg}" text-anchor="middle">${label}</text>`,
    512,
    512
  );
}

const EMOJIS: string[] = [
  "🔥", "😂", "❤️", "👍", "🎉", "⭐", "✅", "😮",
  "😎", "💯", "🚀", "💰", "😭", "🙌", "👀", "🤯",
  "💪", "✨", "🎯", "⚡", "🏆", "🎬", "📣", "💥",
  // Expanded emoji set
  "😍", "🤔", "🙏", "👏", "🤝", "🫡", "😱", "🤩",
  "😴", "🥳", "😤", "🤯", "🫠", "🤡", "👻", "💀",
  "🧠", "🫶", "👊", "✌️", "🤞", "🖐️", "☝️", "👇",
  "📌", "📈", "📉", "💡", "🔔", "🔊", "🎵", "🎮",
  "🍿", "🍕", "☕", "🏀", "⚽", "🏏", "🎾", "🥇",
  "🥈", "🥉", "🎁", "🛒", "💳", "📱", "💻", "🕹️",
  "🌍", "🌙", "☀️", "🔥", "❄️", "🌈", "💧", "🩸",
];

const emojiStickers: Sticker[] = EMOJIS.map((emoji, index) => ({
  id: `emoji-${index}`,
  label: emoji,
  category: "emoji",
  emoji,
  fontSize: 180,
}));

type BadgeSpec = [id: string, label: string, bg: string, fg: string];

const BADGE_SPECS: BadgeSpec[] = [
  ["badge-new", "NEW", "#22c55e", "#052e16"],
  ["badge-sale", "SALE", "#f97316", "#431407"],
  ["badge-live", "LIVE", "#ef4444", "#ffffff"],
  ["badge-top", "TOP 10", "#6366f1", "#ffffff"],
  ["badge-hot", "HOT", "#f43f5e", "#ffffff"],
  ["badge-free", "FREE", "#10b981", "#052e16"],
  ["badge-vip", "VIP", "#facc15", "#422006"],
  ["badge-100", "100%", "#0ea5e9", "#ffffff"],
  // Expanded badge set
  ["badge-trending", "TRENDING", "#db2777", "#ffffff"],
  ["badge-best", "BEST", "#0891b2", "#ffffff"],
  ["badge-winner", "WINNER", "#eab308", "#422006"],
  ["badge-giveaway", "GIVEAWAY", "#7c3aed", "#ffffff"],
  ["badge-sub", "SUBSCRIBED", "#dc2626", "#ffffff"],
  ["badge-member", "MEMBER", "#16a34a", "#ffffff"],
  ["badge-pro", "PRO", "#4338ca", "#ffffff"],
  ["badge-live-now", "LIVE NOW", "#e11d48", "#ffffff"],
  ["badge-247", "24/7", "#0f766e", "#ffffff"],
  ["badge-must", "MUST WATCH", "#c026d3", "#ffffff"],
  ["badge-limited", "LIMITED", "#b45309", "#ffffff"],
  ["badge-half", "50% OFF", "#ea580c", "#ffffff"],
  ["badge-1m", "1M", "#2563eb", "#ffffff"],
  ["badge-og", "OG", "#52525b", "#ffffff"],
  ["badge-beta", "BETA", "#0284c7", "#ffffff"],
  ["badge-updated", "UPDATED", "#65a30d", "#ffffff"],
  ["badge-soldout", "SOLD OUT", "#7f1d1d", "#ffffff"],
  ["badge-fan", "FAN FAVOURITE", "#be123c", "#ffffff"],
  ["badge-breaking", "BREAKING", "#b91c1c", "#ffffff"],
  ["badge-exclusive", "EXCLUSIVE", "#6d28d9", "#ffffff"],
  ["badge-part1", "PART 1", "#334155", "#ffffff"],
];

const ARROW_SPECS: [string, string, string, number, "solid" | "chevron" | "thin"][] = [
  ["arrow", "Arrow", "#facc15", 0, "solid"],
  ["arrow-swirl", "Swirl", "#22d3ee", 0, "chevron"],
  ["arrow-down", "Down", "#f472b6", 90, "solid"],
  ["arrow-curved", "Curved", "#a855f7", 0, "chevron"],
  // Expanded arrow set
  ["arrow-left", "Left", "#facc15", 180, "solid"],
  ["arrow-up", "Up", "#22d3ee", -90, "solid"],
  ["arrow-right-neon", "Neon Right", "#a3e635", 0, "solid"],
  ["arrow-left-neon", "Neon Left", "#22d3ee", 180, "solid"],
  ["arrow-chevron", "Chevron", "#f97316", 0, "chevron"],
  ["arrow-chevron-down", "Chevron Down", "#f97316", 90, "chevron"],
  ["arrow-thin", "Thin Right", "#e5e7eb", 0, "thin"],
  ["arrow-thin-left", "Thin Left", "#e5e7eb", 180, "thin"],
  ["arrow-diag", "Diagonal", "#f472b6", 45, "solid"],
  ["arrow-diag-down", "Diagonal Down", "#38bdf8", 135, "solid"],
  ["arrow-red", "Red Right", "#ef4444", 0, "solid"],
  ["arrow-green", "Green Right", "#22c55e", 0, "solid"],
  ["arrow-gold", "Gold Right", "#fbbf24", 0, "chevron"],
  ["arrow-white", "White Right", "#ffffff", 0, "solid"],
];

const BUTTON_SPECS: [string, string, string][] = [
  ["subscribe", "Subscribe", "SUBSCRIBE"],
  ["like", "Like", "LIKE"],
  ["follow", "Follow", "FOLLOW"],
  ["share", "Share", "SHARE"],
  ["shop", "Shop Now", "SHOP NOW"],
  ["bubble", "Speech Box", "WOW!"],
  ["burst", "Star Burst", "NEW"],
  // Expanded button set
  ["comment", "Comment", "COMMENT"],
  ["donate", "Donate", "DONATE"],
  ["join", "Join", "JOIN"],
  ["watch", "Watch", "WATCH NOW"],
  ["download", "Download", "DOWNLOAD"],
  ["signup", "Sign Up", "SIGN UP"],
  ["buy", "Buy Now", "BUY NOW"],
  ["getstarted", "Get Started", "GET STARTED"],
  ["linkbio", "Link in Bio", "LINK IN BIO"],
  ["taphere", "Tap Here", "TAP HERE"],
  ["swipeup", "Swipe Up", "SWIPE UP"],
  ["dm", "DM Us", "DM US"],
  ["booknow", "Book Now", "BOOK NOW"],
  ["support", "Support", "SUPPORT"],
  ["tipjar", "Tip Jar", "TIP JAR"],
];

const BUTTON_BG: Record<string, string> = {
  subscribe: "#ef4444",
  like: "#0ea5e9",
  follow: "#8b5cf6",
  share: "#14b8a6",
  shop: "#f59e0b",
  comment: "#0f766e",
  donate: "#db2777",
  join: "#16a34a",
  watch: "#2563eb",
  download: "#0891b2",
  signup: "#7c3aed",
  buy: "#ea580c",
  getstarted: "#4338ca",
  linkbio: "#be123c",
  taphere: "#c026d3",
  swipeup: "#e11d48",
  dm: "#0284c7",
  booknow: "#b45309",
  support: "#65a30d",
  tipjar: "#a16207",
};

const LOWER_THIRD_SPECS: [string, string, string, string, string, string][] = [
  ["lower-third", "Lower Third", "YOUR NAME", "@handle · title", "#5b21b6", "#22d3ee"],
  ["lower-third-gold", "Gold Banner", "PLAYER NAME", "team · position", "#78350f", "#fbbf24"],
  ["lower-third-blue", "Blue Banner", "GUEST NAME", "show · episode", "#1e3a8a", "#38bdf8"],
  // Expanded lower-third set
  ["lower-third-host", "Host", "HOST NAME", "show · episode", "#831843", "#f472b6"],
  ["lower-third-coach", "Coach", "COACH NAME", "team · role", "#14532d", "#4ade80"],
  ["lower-third-captain", "Captain", "TEAM CAPTAIN", "club · number", "#7c2d12", "#fb923c"],
  ["lower-third-sponsor", "Sponsor", "SPONSOR", "presented by", "#1f2937", "#facc15"],
  ["lower-third-episode", "Episode", "EPISODE 01", "series · season", "#312e81", "#818cf8"],
  ["lower-third-chapter", "Chapter", "CHAPTER 1", "act · scene", "#0c4a6e", "#38bdf8"],
  ["lower-third-nowplaying", "Now Playing", "NOW PLAYING", "artist · track", "#4c1d95", "#c084fc"],
  ["lower-third-comingup", "Coming Up", "COMING UP", "next on stream", "#7f1d1d", "#f87171"],
  ["lower-third-thanks", "Thanks", "THANK YOU", "for watching", "#064e3b", "#34d399"],
  ["lower-third-topic", "Topic", "TODAY'S TOPIC", "discussion point", "#1e40af", "#60a5fa"],
  ["lower-third-location", "Location", "LOCATION", "city · country", "#374151", "#9ca3af"],
  ["lower-third-quote", "Quote", "BIG QUOTE", "— attribution", "#111827", "#f59e0b"],
];

/** Picks the hand-drawn arrow art for legacy ids, else the parameterised one. */
function arrowSvg(
  id: string,
  color: string,
  rotate: number,
  variant: "solid" | "chevron" | "thin"
): string {
  switch (id) {
    case "arrow":
      return arrowShape();
    case "arrow-down":
      return downArrow();
    case "arrow-swirl":
      return swirlArrow();
    case "arrow-curved":
      return curvedArrow();
    default:
      return arrowSticker(color, rotate, variant);
  }
}

export const STICKERS: Sticker[] = [
  ...emojiStickers,
  // Badges
  ...BADGE_SPECS.map(([id, label, bg, fg]) => ({
    id,
    label,
    category: "badges" as const,
    svg: id === "badge-new" || id === "badge-100"
      ? badge(label, bg, fg)
      : flatBadge(label, bg, fg),
    width: 512,
    height: 512,
  })),
  // Arrows
  ...ARROW_SPECS.map(([id, label, color, rotate, variant]) => ({
    id,
    label,
    category: "arrows" as const,
    svg: arrowSvg(id, color, rotate, variant),
    width: 512,
    height: 512,
  })),
  // Buttons
  ...BUTTON_SPECS.map(([id, label, text]) => ({
    id,
    label,
    category: "ui" as const,
    svg:
      id === "bubble"
        ? speechBubble()
        : id === "burst"
          ? starBurst()
          : id === "tipjar" || id === "support"
            ? outlineButton(text, BUTTON_BG[id] ?? "#facc15")
            : pillButton(text, BUTTON_BG[id] ?? "#8b5cf6"),
    width: 512,
    height: 512,
  })),
  // Lower thirds
  ...LOWER_THIRD_SPECS.map(([id, label, title, subtitle, bar, accent]) => ({
    id,
    label,
    category: "lowerThirds" as const,
    svg: lowerThird(title, subtitle, bar, accent),
    width: 700,
    height: 512,
  })),
];

/** Encodes sticker SVG markup as an image data URL. */
export function stickerImageSrc(sticker: Sticker): string | null {
  if (!sticker.svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sticker.svg)}`;
}
