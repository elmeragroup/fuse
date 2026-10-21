import { cn } from "../../styles/cn";
import {
  itemDefaultShellClass,
  itemShellClass,
  itemSmShellClass,
  itemXsShellClass,
} from "../../styles/inner-corner/item";
import { nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * PUBLIC row recipe, shipped from `@elmeragroup/fuse/item`. A link row takes the hover fill
 * behind the `enabled-hover` gate. The state face takes the `native` target with its `aria`
 * arms: a button row reads `:disabled`, and a link row, which takes no `disabled`, reads
 * `aria-disabled="true"`.
 */
export const itemVariants = tv({
  base: cn(
    itemShellClass,
    "group/item text-sm flex w-full flex-wrap items-center transition-colors duration-100 [a]:transition-colors [a]:enabled-hover:bg-muted",
    selfFocusRingClass,
    nativeStateFaceClass
  ),
  variants: {
    variant: {
      default: "border-transparent",
      outline: "border-border",
      muted: "border-transparent bg-muted/50",
    },
    size: {
      default: [itemDefaultShellClass, "gap-(--surface-gap-md)"],
      sm: [itemSmShellClass, "gap-(--surface-gap-sm)"],
      xs: [itemXsShellClass, "gap-(--surface-gap-sm)"],
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
