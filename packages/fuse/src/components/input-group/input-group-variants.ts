import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import {
  addonBlockShellClass,
  addonEndShellClass,
  addonStartShellClass,
} from "../../styles/inner-corner/input-group";
import { tv } from "../../styles/tv";

/**
 * Module-private recipe for the group's addon rail. `align` places
 * the rail inline (leading/trailing) or as a full-width block row; the Root
 * switches to a column and re-pads the input from the emitted `data-align`.
 * An inline rail holding a button drops its block padding, so a 24px addon
 * button fits the dense md field box without overflowing it.
 * Each rail is an inner-corner shell: its inline padding and the corner it publishes for its
 * buttons and kbd come from its inner-corner shell in `styles/inner-corner/input-group.ts`.
 */
export const inputGroupAddonVariants = tv({
  base: "text-sm font-medium flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-muted-foreground select-none [&>svg:not([class*='size-'])]:size-4",
  variants: {
    align: {
      "inline-start": [addonStartShellClass, "order-first has-[>button]:py-0"],
      "inline-end": [addonEndShellClass, "order-last has-[>button]:py-0"],
      "block-start": [
        addonBlockShellClass,
        "order-first w-full justify-start pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
      ],
      "block-end": [
        addonBlockShellClass,
        "order-last w-full justify-start pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
      ],
    },
  },
  defaultVariants: {
    align: "inline-start",
  },
});

/**
 * Module-private recipe for the compact addon-button axis. These
 * four values are addon chrome inside the group, NOT the four-rung control box
 * (`xs`/`sm`/`md`/`lg`), so they are an explicit shell-local exemption from the
 * density ladder and must never grow a
 * fifth `--control-*` rung. InputGroup.Button applies the values as extra classes over
 * Button's default size, the md label. Every size swaps Button's own icon edge back to the
 * md control icon edge, and `sm`, which keeps that label's box, also swaps Button's inset
 * back to the md control inset, the field's own padding, so Button's wider comfortable inset
 * and icon edge never reach a field. An addon button sits inside the field box, so it pads like
 * the field chrome and rounds with its addon's inner corner, never Button's `--radius-button`.
 */
export const inputGroupButtonVariants = tv({
  base: cn("text-sm flex items-center gap-2 rounded-inner shadow-none", controlMd.iconEdge()),
  variants: {
    size: {
      // The xs boxes are 1.5rem, floored at the fixed 24px target for a host root below 16px.
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      xs: "h-[max(1.5rem,24px)] gap-1 px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
      sm: controlMd.inset(),
      "icon-xs": "size-[max(1.5rem,24px)] p-0 has-[>svg]:p-0",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  defaultVariants: {
    size: "xs",
  },
});
