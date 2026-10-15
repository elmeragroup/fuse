import { tv } from "../../styles/tv";

/**
 * PUBLIC recipe, exported from `@elmeragroup/fuse/badge` beside `Badge`.
 *
 * - `destructive` / `outline-destructive` / `soft-destructive` keep the ref's `destructive`
 *   name for consumer compat, but their classes resolve to the canonical `error` tokens.
 * - `info`, like `success` and `warning`, fills with the status role. Every status has a soft
 *   arm, named like the `outline-*` arms: `soft-destructive`, `soft-success`, `soft-warning`
 *   and `soft-info` use the paired soft status tokens on their tinted surfaces.
 * - Badge is deliberately non-interactive. The recipe drops the ref's bare `:focus` ring
 *   and its `hover:` fills, so no state suggests an affordance a <div> does not have.
 * - `size` is a decorative pill axis, not a density rung:
 *   it pins no control box, so it does not read `--control-*`.
 */
export const badgeVariants = tv({
  base: "font-medium inline-flex items-center rounded-lg border transition-colors",
  variants: {
    variant: {
      default: "shadow-xs border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      destructive: "shadow-xs border-transparent bg-error text-error-foreground",
      success: "shadow-xs border-transparent bg-success text-success-foreground",
      warning: "shadow-xs border-transparent bg-warning text-warning-foreground",
      info: "shadow-xs border-transparent bg-info text-info-foreground",
      "soft-destructive": "shadow-xs border-error/20 bg-error-soft text-error-soft-foreground",
      "soft-info": "shadow-xs border-info/20 bg-info-soft text-info-soft-foreground",
      "soft-success": "shadow-xs border-success/20 bg-success-soft text-success-soft-foreground",
      "soft-warning": "shadow-xs border-warning/20 bg-warning-soft text-warning-soft-foreground",
      outline: "text-foreground",
      "outline-secondary": "border-secondary text-foreground",
      "outline-destructive": "border-error text-error",
      "outline-success": "border-success text-success",
      "outline-warning": "border-warning text-warning",
      muted: "shadow-xs border-transparent bg-muted text-foreground",
      accent: "shadow-xs border-transparent bg-accent text-accent-foreground",
      card: "shadow-xs border-transparent bg-card text-card-foreground",
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
