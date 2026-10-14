import type { Metadata } from "next";
import localFont from "next/font/local";
import { SocialBar } from "@/components/ads/social-bar";
import "./globals.css";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://forgevyn.com"
).replace(/\/+$/, "");

const SITE_NAME = "Forgevyn Clipping";
const TITLE = "Forgevyn | Free Professional In-Browser Video Studio";
const DESCRIPTION =
  "A free, professional in-browser video studio: multi-track editing, chroma key, keyframe animations, transitions, captions and audio mixing — 100% client-side with zero server lag.";
const KEYWORDS = [
  "free online video editor",
  "in-browser video studio",
  "browser video editor",
  "multi-track video editor",
  "chroma key green screen",
  "keyframe animation editor",
  "video transitions",
  "auto captions generator",
  "video editor no upload",
  "CapCut alternative web",
];

/** Shared social card so OpenGraph and Twitter stay in sync. */
const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Forgevyn — free professional in-browser video studio",
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
  // Icons served from /public. Google Search favours square, 48px-multiple
  // PNGs, so expose explicit crawler-facing 48px and 192px variants.
  icons: {
    icon: [
      { url: "/icon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
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
      <head>
        <link rel="icon" type="image/png" sizes="48x48" href="/icon-48x48.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png" />
      </head>
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
        <SocialBar />
      </body>
    </html>
  );
}
