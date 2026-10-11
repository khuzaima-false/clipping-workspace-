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

/** Shared social card so OpenGraph and Twitter stay in sync. */
const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Forgevyn — AI video clipper for TikTok, YouTube Shorts, and Instagram Reels",
};

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
  // Explicit icon tags (also emitted automatically by the `src/app` file
  // conventions: favicon.ico, icon.png, apple-icon.png).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/logo.png", type: "image/png", sizes: "512x512" }],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/** Structured data so Google can associate the brand logo with the site. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Forgevyn",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
        width: 512,
        height: 512,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Forgevyn",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
