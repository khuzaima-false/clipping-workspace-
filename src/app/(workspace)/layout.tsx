import { AppShell } from "@/components/shell/app-shell";
import { PREVIEW_MEDIA_CONTAINER_ID } from "@/lib/preview-media";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      {children}
      {/* Keep this in the rendered tree: `hidden` / display:none can suspend
          Chromium's media audio pipeline for otherwise active elements. */}
      <div
        id={PREVIEW_MEDIA_CONTAINER_ID}
        aria-hidden="true"
        className="pointer-events-none fixed -left-px -top-px h-px w-px overflow-hidden opacity-0"
      />
    </AppShell>
  );
}
