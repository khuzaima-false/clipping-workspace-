import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  "in-progress": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  ready: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  exported: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
};

export function StatusChip({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ring-1 ring-inset",
        STATUS_STYLES[status] ?? STATUS_STYLES.draft,
        className
      )}
    >
      {status.replace("-", " ")}
    </span>
  );
}
