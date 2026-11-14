import { tv } from "../../styles/tv";

/**
 * The public recipe, exported from `@elmeragroup/fuse/badge` beside `Badge`.
 *
 * - `destructive`, `outline-destructive` and `soft-destructive` keep the reference's
 *   `destructive` name for consumer compatibility, and their classes use the `error` tokens.
 * - Every status (destructive, success, warning, info) has a filled arm, an `outline-*` arm that
 *   draws the status colour as border and text, and a `soft-*` arm that uses the paired soft
 *   status tokens on their tinted surface.
 * - Badge is not interactive. The recipe drops the reference's bare `:focus` ring and its
 *   `hover:` fills, so no state suggests an action a `<span>` does not have.
 * - `size` sets a decorative pill, not a control, so it reads no `--control-*` metric.
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
      "soft-success": "shadow-xs border-success/20 bg-success-soft text-success-soft-foreground",
      "soft-warning": "shadow-xs border-warning/20 bg-warning-soft text-warning-soft-foreground",
      "soft-info": "shadow-xs border-info/20 bg-info-soft text-info-soft-foreground",
      outline: "text-foreground",
      "outline-secondary": "border-secondary text-foreground",
      "outline-destructive": "border-error text-error",
      "outline-success": "border-success text-success",
      "outline-warning": "border-warning text-warning",
      "outline-info": "border-info text-info",
      muted: "shadow-xs border-transparent bg-muted text-foreground",
      accent: "shadow-xs border-transparent bg-accent text-accent-foreground",
      // oxlint-disable-next-line fuse/container-surface -- a badge is a chip that borrows the card colour; nothing rests on it
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
