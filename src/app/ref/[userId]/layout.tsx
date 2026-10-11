import type { ReactNode } from "react";

// `output: "export"` requires dynamic segments to be enumerated. We emit a
// single `index` shell that Cloudflare Pages rewrites all /ref/<id> requests to
// (see `public/_redirects`); the client reads the real referrer id from the URL.
// `generateStaticParams` lives here because `page.tsx` is a Client Component.
export function generateStaticParams() {
  return [{ userId: "index" }];
}

export default function ReferralLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
