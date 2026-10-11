import type { ReactNode } from "react";

// `output: "export"` pre-renders every route at build time, so dynamic segments
// must be enumerated. We emit a single `index` shell that Cloudflare Pages
// rewrites all /editor/<id> requests to (see `public/_redirects`); the client
// reads the real id from the URL. `generateStaticParams` lives here because it
// can only be exported from a Server Component and `page.tsx` is a Client
// Component.
export function generateStaticParams() {
  return [{ projectId: "index" }];
}

export default function EditorProjectLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
