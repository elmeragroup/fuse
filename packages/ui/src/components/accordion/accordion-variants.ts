/**
 * PUBLIC slot recipe (accordion.md §4). Consumers borrow it from
 * `@elmeragroup/ui/accordion`. Context-passed `variant` / `radius` stay on Root;
 * parts call this with the published axes for their own slot.
 *
 * Height on `content` is the approved layout exception (accordion.md §8.8): a plain
 * transition against base-ui's `--accordion-panel-height`, not a control-box rung.
 */
import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";

export const accordionVariants = tv({
  slots: {
    base: "",
    item: "p-4",
    header: "flex",
    trigger: cn(
      "group/accordion-trigger font-medium flex flex-1 cursor-pointer items-center justify-between gap-2 hover:underline data-[panel-open]:pb-4",
      focusRing({ target: "self" }).root()
    ),
    icon: "size-4 shrink-0 text-foreground transition-transform duration-200 group-data-[panel-open]/accordion-trigger:rotate-180",
    content:
      "ease-in-out h-0 overflow-hidden transition-[height] duration-200 data-[open]:h-(--accordion-panel-height)",
    contentInner: "pt-1.5",
  },
  variants: {
    variant: {
      default: {
        item: "rounded-sm bg-muted",
        trigger: "transition-[padding-bottom]",
      },
      card: {
        base: "space-y-3",
        item: "rounded-lg border bg-card text-foreground",
        content: "rounded-lg bg-card text-foreground",
        icon: "text-foreground",
      },
      infodropdown: {
        base: "border-b border-border",
        trigger: "relative justify-start data-[panel-open]:pb-0",
        icon: "absolute right-0",
        content: "pl-7",
      },
    },
    radius: {
      none: {}, // Not dead: the default and a published `radius` value (accordion.md §4).
      lg: { item: "overflow-hidden rounded-lg" },
      xl: { item: "overflow-hidden rounded-xl" },
    },
  },
  defaultVariants: {
    variant: "default",
    radius: "none",
  },
});
