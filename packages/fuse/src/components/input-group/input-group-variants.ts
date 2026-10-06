import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import { fieldCornerClass, insetCornerClass, kbdInsetCornerClass } from "../../styles/corner-radius";

/**
 * Module-private recipe for the group's addon rail. `align` places
 * the rail inline (leading/trailing) or as a full-width block row; the Root
 * switches to a column and re-pads the input from the emitted `data-align`.
 * The kbd takes the inset corner, 5px inside `--radius` and never rounder than the field box
 * in external themes, and the one radius in the internal variant.
 */
export const inputGroupAddonVariants = tv({
  base: cn(
    "text-sm font-medium flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-muted-foreground select-none [&>svg:not([class*='size-'])]:size-4",
    kbdInsetCornerClass
  ),
  variants: {
    align: {
      "inline-start": "order-first pl-2 has-[>button]:-ml-1 has-[>kbd]:ml-[-0.15rem]",
      "inline-end": "order-last pr-2 has-[>button]:-mr-1 has-[>kbd]:mr-[-0.15rem]",
      "block-start":
        "order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
      "block-end":
        "order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
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
 * and icon edge never reach a field. An addon button sits inside the field box, so it pads and
 * rounds like the field chrome and never takes Button's `--radius-button`. The `sm` sizes take
 * the field corner, and the `xs` sizes take the kbd's inset corner.
 */
export const inputGroupButtonVariants = tv({
  base: cn("text-sm flex items-center gap-2 shadow-none", fieldCornerClass, controlMd.iconEdge()),
  variants: {
    size: {
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      xs: "h-6 gap-1 px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
      sm: controlMd.inset(),
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      "icon-xs": "size-6 p-0 has-[>svg]:p-0",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  compoundVariants: [{ size: ["xs", "icon-xs"], class: insetCornerClass }],
  defaultVariants: {
    size: "xs",
  },
});
