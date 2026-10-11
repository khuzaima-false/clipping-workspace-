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
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div className="glass-card flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl p-10 text-center">
        <span className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-violet-900/30">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {title} workspace coming soon
          </p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
            This section is part of the MVP shell and will be populated with real
            data once Supabase is connected.
          </p>
        </div>
      </div>
    </div>
  );
}
