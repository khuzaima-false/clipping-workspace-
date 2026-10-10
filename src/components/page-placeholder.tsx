import type { LucideIcon } from "lucide-react";

type PagePlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-medium text-zinc-300">
          {title} workspace coming soon
        </p>
        <p className="max-w-sm text-xs text-zinc-600">
          This section is part of the MVP shell and will be populated with real
          data once Supabase is connected.
        </p>
      </div>
    </div>
  );
}
