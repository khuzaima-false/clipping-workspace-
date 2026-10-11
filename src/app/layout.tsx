import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://forgevyn.com"
).replace(/\/+$/, "");

const SITE_NAME = "Forgevyn Clipping";
const TITLE = "Forgevyn | AI Video Clipper & Short-Form Video Generator";
const DESCRIPTION =
  "Turn long podcasts, streams, and YouTube videos into viral TikToks, YouTube Shorts, and Instagram Reels with AI captions and smart framing.";
const KEYWORDS = [
  "AI video clipping tool",
  "long video to short clips",
  "AI short form editor",
  "YouTube Shorts maker",
  "TikTok clip generator",
  "auto AI subtitles",
  "podcast to clips",
  "OpusClip alternative",
];

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: SITE_NAME,
  // Icons come from the file conventions in `src/app`:
  // favicon.ico, icon.png, and apple-icon.png (see `npm run brand:assets`).
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Forgevyn — AI video clipper for TikTok, YouTube Shorts, and Instagram Reels",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
