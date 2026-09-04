/**
 * Module-private slotted recipe (number-field.md §4). Not exported from the
 * public entry. Increment/Decrement share the `stepper` slot; the group chrome
 * lives on the field-box sibling recipes.
 */
import { tv } from "tailwind-variants";

export const numberFieldVariants = tv({
  slots: {
    stepper:
      "flex flex-1 cursor-default items-center justify-center bg-background px-0.5 text-foreground transition-colors hover:bg-muted disabled:bg-muted disabled:opacity-50",
  },
  // Required shape: elmera/enforce-variant-standard makes every recipe declare both
  // objects. NumberField has no axes — the field box pins the md rung.
  variants: {},
  defaultVariants: {},
});
