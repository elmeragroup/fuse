import { tv } from "tailwind-variants";

/**
 * PUBLIC recipe (badge.md §4). `CheckboxCard` borrows it for its tag chips, so it
 * ships from `@elmeragroup/ui/badge`.
 *
 * - `destructive` / `outline-destructive` keep their ref value names for consumer
 *   compat, but their classes resolve to the canonical `error` tokens (§8.1).
 * - The `info` arm's `color-mix(in oklch, var(--info) …)` arbitrary values are the
 *   sanctioned token-derived exception recorded in §4 / §8.3 — no raw palette appears.
 * - Badge is deliberately non-interactive: the ref's bare `:focus` ring is dropped (§8.5).
 * - `size` is a decorative pill axis, not a density rung (conventions.md §Density metrics):
 *   it pins no control box, so it does not read `--control-*`.
 */
export const badgeVariants = tv({
  base: "inline-flex items-center rounded-lg border font-medium transition-colors",
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/80",
      secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
      destructive: "border-transparent bg-error text-error-foreground shadow-xs hover:bg-error/80",
      success: "border-transparent bg-success text-success-foreground shadow-xs hover:bg-success/80",
      warning: "border-transparent bg-warning text-warning-foreground shadow-xs hover:bg-warning/80",
      info: "border-[color-mix(in_oklch,var(--info)_16%,transparent)] bg-[color-mix(in_oklch,var(--info)_8%,transparent)] text-info-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--info)_16%,transparent)]",
      outline: "text-foreground",
      "outline-secondary":
        "border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground",
      "outline-destructive": "border-error text-error hover:bg-error hover:text-error-foreground",
      "outline-success": "border-success text-success hover:bg-success hover:text-success-foreground",
      "outline-warning": "border-warning text-warning hover:bg-warning hover:text-warning-foreground",
      muted: "border-transparent bg-muted text-secondary-foreground shadow-xs hover:bg-muted/80",
      accent: "border-transparent bg-accent text-accent-foreground shadow-xs hover:bg-accent/80",
      card: "border-transparent bg-card text-card-foreground shadow-xs hover:bg-card/80",
    },
    size: {
      sm: "px-2 py-px text-xs [&>span]:text-xs [&>span]:font-medium",
      default: "px-2.5 py-0.5 text-xs [&>span]:text-xs [&>span]:font-medium",
      lg: "px-3 py-1 text-sm [&>span]:text-sm [&>span]:font-medium",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
