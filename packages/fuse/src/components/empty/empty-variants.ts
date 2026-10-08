import { emptyBorderedShellClass, emptyShellClass } from "../../styles/inner-corner/empty";
/**
 * Module-private recipes. Not exported from the public entry —
 * there is no proven recipe-borrowing use.
 *
 * `variant` on Root is the frame; `variant` on Media is the icon/illustration box.
 * Neither axis is a density rung.
 */
import { tv } from "../../styles/tv";

export const emptyVariants = tv({
  base: [
    emptyShellClass,
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-center text-balance",
  ],
  variants: {
    variant: {
      default: "",
      outline: [emptyBorderedShellClass, "border border-border"],
      "outline-dashed": [emptyBorderedShellClass, "border border-dashed border-border"],
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
