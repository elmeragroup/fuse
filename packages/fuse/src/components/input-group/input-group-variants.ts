import { cn } from "../../styles/cn";
import { controlMetrics } from "../../styles/control-size";
import { controlMd } from "../../styles/control-size-md";
import { inputGroupRootClass } from "../../styles/field-box";
import { fieldSize } from "../../styles/field-size";
import {
  addonBlockShellClass,
  addonEndShellClass,
  addonStartShellClass,
} from "../../styles/inner-corner/input-group";
import { tv } from "../../styles/tv";

/** The field-size reads of the parts inside the group. */
const fieldReads = fieldSize();

/**
 * Module-private recipe for the group's root, the field box: {@link inputGroupRootClass} plus the
 * field size it writes (`field-size.ts`). `size` is `"default"`, the md control size, or `"sm"`,
 * the sm control size; the group's input, addon text and `icon-sm` buttons read it.
 */
export const inputGroupRootVariants = tv({
  base: inputGroupRootClass,
  variants: {
    size: {
      default: fieldSize({ size: "default" }).box(),
      sm: fieldSize({ size: "sm" }).box(),
    },
  },
  defaultVariants: {
    size: "default",
  },
});

/**
 * Module-private recipe for the group's addon rail. `align` places
 * the rail inline (leading/trailing) or as a full-width block row; the Root
 * switches to a column and re-pads the input from the emitted `data-align`.
 * An inline rail holding a button drops its block padding, so a 24px addon
 * button fits the dense field box at both sizes without overflowing it.
 * Each rail is an inner-corner shell: its inline padding and the corner it publishes for its
 * buttons and kbd come from its inner-corner shell in `styles/inner-corner/input-group.ts`.
 */
export const inputGroupAddonVariants = tv({
  // The addon's text is the field's own text, the type of the group's field size.
  base: cn(
    fieldReads.type(),
    "font-medium flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-muted-foreground select-none [&>svg:not([class*='size-'])]:size-4"
  ),
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

/** The xs control rung's parts, which the compact addon buttons read. */
const xsButton = controlMetrics({ size: "xs" });

/**
 * Module-private recipe for the compact addon-button axis. A button inside a field reads a
 * control rung below the field's own box, so it fits inside it: `xs` and `icon-xs` take the xs
 * height (floored at the 24px target) or square, with the xs gap and icon inset, and `icon-sm`
 * the group's inner square, `--field-inner` (`field-size.ts`): the sm square in a default
 * group, and the xs square floored at 24px in an sm one. The axis reads only the existing rungs
 * and never adds a `--control-*` metric of its own. InputGroup.Button applies the values as
 * extra classes over Button's default size, the md label. `sm` keeps that label but takes the
 * group's field height, so it is the md height in a default group and the sm height in an sm one.
 * Every size swaps Button's own icon edge back to the
 * md control icon edge, and `sm` also swaps Button's inset
 * back to the md control inset, the field's own padding, so Button's wider comfortable inset
 * and icon edge never reach a field. An addon button sits inside the field box, so it pads like
 * the field chrome and rounds with its addon's inner corner, never Button's `--radius-button`.
 */
export const inputGroupButtonVariants = tv({
  base: cn("text-sm flex items-center gap-2 rounded-inner shadow-none", controlMd.iconEdge()),
  variants: {
    size: {
      xs: [xsButton.height(), xsButton.gap(), xsButton.iconInset(), "[&>svg:not([class*='size-'])]:size-3.5"],
      sm: [fieldReads.height(), controlMd.inset()],
      "icon-xs": [xsButton.square(), "p-0 has-[>svg]:p-0"],
      "icon-sm": [fieldReads.inner(), "p-0 has-[>svg]:p-0"],
    },
  },
  defaultVariants: {
    size: "xs",
  },
});
