/**
 * PUBLIC slot recipe. Consumers borrow it from
 * `@elmeragroup/fuse/accordion`. Context-passed `variant` / `radius` stay on Root;
 * parts call this with the published axes for their own slot.
 *
 * Height on `content` is the approved layout exception, owned once by the shared
 * `panelHeightTransition` constant (`styles/panel-height.ts`) against base-ui's
 * `--accordion-panel-height` — not a control-box rung.
 *
 * The trigger is a native button that Base UI also marks `data-disabled`, and a consumer may
 * announce it `aria-disabled`, so it composes the `native` and `data` state faces (both
 * carry the `aria-disabled` arm) and gates its hover underline behind `enabled-hover:`.
 *
 * `hasIndicator` packs the trigger's children at the start when `Accordion.Trigger` renders
 * no trailing indicator, so a leading icon sits beside the label instead of across the row.
 *
 * `icon` styles and places the default caret, and consumers borrow it for their own carets.
 * `indicator` repeats the icon's placement on the wrapper of a custom indicator, so either
 * one sits in the same spot. `infodropdown` packs the trigger at the start, so both slots pin
 * to the right edge there.
 */
import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { panelHeightTransition } from "../../styles/panel-height";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";

export const accordionVariants = tv({
  slots: {
    base: "",
    item: "p-4",
    header: "flex",
    trigger: cn(
      "group/accordion-trigger font-medium flex flex-1 cursor-pointer items-center justify-between gap-2 data-[panel-open]:pb-4 enabled-hover:underline",
      selfFocusRingClass,
      nativeStateFaceClass,
      dataStateFaceClass
    ),
    indicator: "flex shrink-0 items-center",
    icon: "size-4 shrink-0 text-foreground transition-transform duration-200 group-data-[panel-open]/accordion-trigger:rotate-180",
    content: cn(panelHeightTransition, "h-(--accordion-panel-height)"),
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
        indicator: "absolute right-0",
        icon: "absolute right-0",
        content: "pl-7",
      },
    },
    hasIndicator: {
      true: {},
      false: { trigger: "justify-start" },
    },
    radius: {
      none: {}, // Not dead: the default and a published `radius` value.
      lg: { item: "overflow-hidden rounded-lg" },
      xl: { item: "overflow-hidden rounded-xl" },
    },
  },
  defaultVariants: {
    variant: "default",
    radius: "none",
    hasIndicator: true,
  },
});
