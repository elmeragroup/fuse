import { tv } from "tailwind-variants";

/**
 * PUBLIC recipe. `CheckboxCard` borrows it for its tag chips, so it
 * ships from `@elmeragroup/ui/badge`.
 *
 * - `destructive` / `outline-destructive` keep their ref value names for consumer
 *   compat, but their classes resolve to the canonical `error` tokens.
 * - The `info` arm uses the paired soft status tokens on its tinted surface.
 * - Badge is deliberately non-interactive: the ref's bare `:focus` ring is dropped.
 * - `size` is a decorative pill axis, not a density rung:
 *   it pins no control box, so it does not read `--control-*`.
 */
export const badgeVariants = tv({
  base: "font-medium inline-flex items-center rounded-lg border transition-colors",
  variants: {
    variant: {
      default: "shadow-xs border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
      secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
      destructive: "shadow-xs border-transparent bg-error text-error-foreground hover:bg-error/80",
      success: "shadow-xs border-transparent bg-success text-success-foreground hover:bg-success/80",
      warning: "shadow-xs border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
      info: "shadow-xs border-info/20 bg-info-soft text-info-soft-foreground hover:border-info/40",
      outline: "text-foreground",
      "outline-secondary":
        "border-secondary text-foreground hover:bg-secondary hover:text-secondary-foreground",
      "outline-destructive": "border-error text-error hover:bg-error hover:text-error-foreground",
      "outline-success": "border-success text-success hover:bg-success hover:text-success-foreground",
      "outline-warning": "border-warning text-warning hover:bg-warning hover:text-warning-foreground",
      muted: "shadow-xs border-transparent bg-muted text-foreground hover:bg-muted/80",
      accent: "shadow-xs border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
      card: "shadow-xs border-transparent bg-card text-card-foreground hover:bg-card/80",
    },
    size: {
      sm: "text-xs [&>span]:text-xs [&>span]:font-medium px-2 py-px",
      default: "text-xs [&>span]:text-xs [&>span]:font-medium px-2.5 py-0.5",
      lg: "text-sm [&>span]:text-sm [&>span]:font-medium px-3 py-1",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
