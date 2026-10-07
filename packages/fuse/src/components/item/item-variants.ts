import { cn } from "../../styles/cn";
import {
  itemDefaultShellClass,
  itemShellClass,
  itemSmShellClass,
  itemXsShellClass,
} from "../../styles/inner-corner/item";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

export const itemVariants = tv({
  base: cn(
    itemShellClass,
    "group/item text-sm flex w-full flex-wrap items-center transition-colors duration-100 [a]:transition-colors [a]:hover:bg-muted",
    selfFocusRingClass
  ),
  variants: {
    variant: {
      default: "border-transparent",
      outline: "border-border",
      muted: "border-transparent bg-muted/50",
    },
    size: {
      default: [itemDefaultShellClass, "gap-3.5"],
      sm: [itemSmShellClass, "gap-2.5"],
      xs: [itemXsShellClass, "gap-2"],
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
