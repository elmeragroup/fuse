/**
 * Module-private recipes (empty.md §4). Not exported from the public entry —
 * there is no proven recipe-borrowing use (§8.4).
 *
 * `variant` on Root is the frame; `variant` on Media is the icon/illustration box.
 * Neither axis is a density rung (empty.md §4; conventions.md § Density metrics).
 */
import { tv } from "tailwind-variants";

export const emptyVariants = tv({
  base: "md:p-12 flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg p-6 text-center text-balance",
  variants: {
    variant: {
      default: "",
      outline: "border border-border",
      "outline-dashed": "border border-dashed border-border",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const emptyMediaVariants = tv({
  base: "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "size-10 rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
