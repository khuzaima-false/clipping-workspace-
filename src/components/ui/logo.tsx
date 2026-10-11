import mark from "@/lib/brand-mark.json";
import { cn } from "@/lib/utils";

export type LogoSize = "sm" | "md" | "lg";

export type LogoProps = {
  /** Visual scale of the mark and the wordmark. */
  size?: LogoSize;
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Extra classes for the icon only. */
  iconClassName?: string;
  /** Hide the "FORGEVYN CLIPPING" wordmark and render just the mark. */
  iconOnly?: boolean;
};

const SIZE_STYLES: Record<
  LogoSize,
  { wrapper: string; icon: string; brand: string; sub: string }
> = {
  sm: {
    wrapper: "gap-2",
    icon: "h-7 w-7",
    brand: "text-[11px]",
    sub: "text-[8px]",
  },
  md: {
    wrapper: "gap-2.5",
    icon: "h-9 w-9",
    brand: "text-sm",
    sub: "text-[10px]",
  },
  lg: {
    wrapper: "gap-3.5",
    icon: "h-14 w-14",
    brand: "text-2xl",
    sub: "text-sm",
  },
};

/** Shared gradient id — all instances reference the same definition. */
const GRADIENT_ID = "forgevyn-logo-gradient";

/**
 * Stylized clapperboard fused with a play/forward arrow (cut out of the
 * silhouette). The geometry lives in `src/lib/brand-mark.json` so it can be
 * shared with the asset-generation script.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox={mark.viewBox} fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient
          id={GRADIENT_ID}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0" stopColor={mark.gradientFrom} />
          <stop offset="1" stopColor={mark.gradientTo} />
        </linearGradient>
      </defs>
      <path
        d={mark.path}
        fill={`url(#${GRADIENT_ID})`}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Brand lockup: the gradient clapperboard mark next to a stacked
 * "FORGEVYN" / "CLIPPING" wordmark.
 *
 * The mark carries the brand gradient in both themes; the wordmark adapts —
 * dark text on light backgrounds, light text in dark mode — via Tailwind.
 */
export function Logo({
  size = "md",
  className,
  iconClassName,
  iconOnly = false,
}: LogoProps) {
  const styles = SIZE_STYLES[size];

  return (
    <span className={cn("inline-flex items-center", styles.wrapper, className)}>
      <LogoMark className={cn(styles.icon, "shrink-0", iconClassName)} />

      {!iconOnly && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-bold tracking-wide text-zinc-900 dark:text-zinc-100",
              styles.brand
            )}
          >
            FORGEVYN
          </span>
          <span
            className={cn(
              "mt-0.5 font-light tracking-[0.28em] text-zinc-500 dark:text-zinc-400",
              styles.sub
            )}
          >
            CLIPPING
          </span>
        </span>
      )}
    </span>
  );
}
