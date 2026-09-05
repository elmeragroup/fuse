import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";

export const itemVariants = tv({
  base: cn(
    "group/item text-sm flex w-full flex-wrap items-center rounded-md border transition-colors duration-100 [a]:transition-colors [a]:hover:bg-muted",
    selfFocusRingClass
  ),
  variants: {
    variant: {
      default: "border-transparent",
      outline: "border-border",
      muted: "border-transparent bg-muted/50",
    },
    size: {
      default: "gap-3.5 px-4 py-3.5",
      sm: "gap-2.5 px-3 py-2.5",
      xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
