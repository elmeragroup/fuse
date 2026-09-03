import { tv } from "tailwind-variants";

import { focusRing } from "../../styles/utils";

/**
 * Private checkbox chrome for the interim tier — the RAC `GridList` selection cell is
 * its only consumer (date-picker.md §2). The public checkbox is the base-ui
 * `@elmeragroup/ui/checkbox` entry; this recipe is never exported.
 *
 * Reference `theme(colors.*)` lookups are retokenized onto role tokens, and the
 * reference's `destructive` vocabulary becomes `error` (conventions.md styling).
 * The box is a decorative glyph, not a control box, so it is outside the density
 * ladder and keeps its optical `size-4.5`. There is no `variant` axis: the one
 * consumer renders `<Checkbox slot="selection" />` with no variant (grid-list.md §8.7).
 */
export const checkboxVariants = tv({
  slots: {
    base: "group text-sm flex gap-2 text-inherit transition",
    box: `flex size-4.5 shrink-0 items-center justify-center rounded-xs border transition-colors ${focusRing({ target: "state" }).root()}`,
    icon: "size-4 text-primary-foreground forced-colors:text-[HighlightText]",
  },
  variants: {
    isSelected: {
      true: {
        box: "border-(--checkbox-color) bg-(--checkbox-color) [--checkbox-color:var(--primary)] forced-colors:[--checkbox-color:Highlight]!",
      },
      false: {
        box: "border-(--checkbox-color) bg-card [--checkbox-color:var(--border)] group-pressed:[--checkbox-color:var(--muted-foreground)]",
      },
    },
    isDisabled: {
      true: {
        base: "text-muted-foreground forced-colors:text-[GrayText]",
        box: "[--checkbox-color:var(--muted)] forced-colors:[--checkbox-color:GrayText]!",
        icon: "text-muted-foreground",
      },
      false: {
        base: "text-inherit",
      },
    },
    isInvalid: {
      true: {
        box: "[--checkbox-color:var(--error)] forced-colors:[--checkbox-color:Mark]!",
      },
      false: {},
    },
    isFocusVisible: {
      true: {
        box: focusRing({ target: "state", isFocusVisible: true }).root(),
      },
      false: {},
    },
  },
  defaultVariants: {
    isSelected: false,
    isDisabled: false,
    isInvalid: false,
    isFocusVisible: false,
  },
});
