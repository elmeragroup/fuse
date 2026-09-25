/**
 * Module-private slot recipe. Not exported from the public entry —
 * there is no proven recipe-borrowing use.
 *
 * `variant` is the status axis only. Item supplies `variant="outline"` / `size="sm"`
 * underneath; this recipe is not a density rung.
 */
import { tv } from "tailwind-variants";

export const alertVariants = tv({
  slots: {
    base: "relative",
    icon: "block size-5 shrink-0 text-foreground",
    description: "text-foreground",
    button: "",
  },
  variants: {
    variant: {
      default: {
        base: "bg-background text-foreground",
        icon: "text-foreground",
        // Replaces Button's `enabled-hover:bg-primary/80`, which tailwind-merge keeps beside a
        // plain `bg-*` because the modifier differs, and which puts `text-foreground` on a
        // primary fill. `foreground` on `muted` is a gated text-grade pair.
        button: "bg-background text-foreground enabled-hover:bg-muted",
      },
      destructive: {
        base: "border-error bg-error/5 text-error",
        icon: "text-error",
        button: "bg-error text-error-foreground hover:bg-error/90",
      },
      warning: {
        base: "border-warning bg-warning-soft text-warning-soft-foreground",
        icon: "text-warning",
        button: "bg-warning text-warning-foreground hover:bg-warning/90",
      },
      success: {
        base: "border-success bg-success/5 text-foreground",
        icon: "text-success",
        button: "bg-success text-success-foreground hover:bg-success/90",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
