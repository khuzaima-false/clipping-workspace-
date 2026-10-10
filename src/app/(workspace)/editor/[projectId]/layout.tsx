import type { ReactNode } from "react";

// `output: "export"` pre-renders every route at build time, so dynamic segments
// must be enumerated. The editor is a client-rendered route that loads the
// project by ID from Supabase, so we emit a single placeholder path to satisfy
// the static export. `generateStaticParams` lives here because it can only be
// exported from a Server Component and `page.tsx` is a Client Component.
export function generateStaticParams() {
  return [{ projectId: "example" }];
}

export default function EditorProjectLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
