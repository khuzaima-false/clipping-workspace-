import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://forgevyn.com"
).replace(/\/+$/, "");

const SITE_NAME = "Forgevyn Clipping";
const DESCRIPTION =
  "1080p video-clipping workspace for projects, channels, and campaigns.";

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
  title: "Forgevyn Clipping Workspace",
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  // Icons come from the file conventions in `src/app`:
  // favicon.ico, icon.png, and apple-icon.png (see `npm run brand:assets`).
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Forgevyn Clipping Workspace",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Forgevyn Clipping — 1080p video-clipping workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Forgevyn Clipping Workspace",
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
