import { cn } from "../../styles/cn";
import {
  accordionCardItemLgShellClass,
  accordionCardItemShellClass,
  accordionCardItemXlShellClass,
  accordionItemLgShellClass,
  accordionItemShellClass,
  accordionItemXlShellClass,
} from "../../styles/inner-corner/accordion";
import { panelHeightTransition } from "../../styles/panel-height";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
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
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

export const accordionVariants = tv({
  slots: {
    base: "",
    // Every item pads with the medium surface tier; the shells add it with the corner they publish.
    item: "p-(--surface-pad-md)",
    header: "flex",
    // Fuse ships no preflight, so `text-inherit` and `bg-transparent` replace the native button's
    // ButtonText and ButtonFace: the label takes its item's text colour over its item's fill.
    trigger: cn(
      "group/accordion-trigger font-medium flex flex-1 cursor-pointer items-center justify-between gap-2 bg-transparent text-inherit enabled-hover:underline",
      selfFocusRingClass,
      nativeStateFaceClass,
      dataStateFaceClass
    ),
    indicator: "flex shrink-0 items-center",
    // The caret takes its item's text colour, so it follows the default fill's soft foreground.
    icon: "size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/accordion-trigger:rotate-180",
    content: cn(panelHeightTransition, "h-(--accordion-panel-height)"),
    // An open panel sits the large surface gap below its trigger, plus the 6px before its text.
    // The gap lives in the panel, so it opens and closes with the panel's height.
    contentInner: "pt-[calc(var(--surface-gap-lg)+--spacing(1.5))]",
  },
  variants: {
    variant: {
      default: {
        // Each item rounds all four corners, so stacked items sit apart, as card items do, instead
        // of touching and leaving a notch where two rounded corners meet.
        base: "space-y-3",
        // The brand's soft tint, the role Material's `secondary-container` maps to. `muted` is
        // the hover and read-only grey, so a panel in it reads as disabled on a tinted page.
        // The neutral ring falls under 3:1 on the tint, so focus takes the soft foreground,
        // as Alert's soft fills do. The rebind covers the whole item, so a control in the panel
        // also draws its ring in the soft foreground over the same tint.
        item: [
          accordionItemShellClass,
          "bg-primary-soft text-primary-soft-foreground [--ring:var(--primary-soft-foreground)]",
        ],
      },
      card: {
        base: "space-y-3",
        item: [accordionCardItemShellClass, "border-card-border bg-card text-foreground"],
        // The panel sits inside the item's padding, so it rounds with the item's inner corner.
        content: "rounded-inner bg-card text-foreground",
        icon: "text-foreground",
      },
      infodropdown: {
        base: "border-b border-border",
        trigger: "relative justify-start",
        indicator: "absolute right-0",
        icon: "absolute right-0 text-foreground",
        content: "pl-7",
        contentInner: "pt-1.5",
      },
    },
    hasIndicator: {
      true: {},
      false: { trigger: "justify-start" },
    },
    radius: {
      none: {}, // Not dead: the default and a published `radius` value.
      lg: { item: [accordionItemLgShellClass, "overflow-hidden"] },
      xl: { item: [accordionItemXlShellClass, "overflow-hidden"] },
    },
  },
  // A bordered card item publishes its corner less the border too.
  compoundVariants: [
    { variant: "card", radius: "lg", class: { item: accordionCardItemLgShellClass } },
    { variant: "card", radius: "xl", class: { item: accordionCardItemXlShellClass } },
  ],
  defaultVariants: {
    variant: "default",
    radius: "none",
    hasIndicator: true,
  },
});
