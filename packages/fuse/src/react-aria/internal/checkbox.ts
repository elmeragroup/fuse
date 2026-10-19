import { cn } from "../../styles/cn";
import { checkboxCornerClass } from "../../styles/corner-radius";
import { racInvalidStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import {
  stateFocusRingClass,
  stateFocusRingVisibleClass,
  stateInvalidFocusRingVisibleClass,
} from "../../styles/utils";

/**
 * Private checkbox chrome for the interim tier — the RAC `GridList` selection cell is
 * its only consumer. The public checkbox is the base-ui
 * `@elmeragroup/fuse/checkbox` entry; this recipe is never exported.
 *
 * Reference `theme(colors.*)` lookups are retokenized onto role tokens, and the
 * reference's `destructive` vocabulary becomes `error`.
 * The box is a decorative glyph, not a control box, so it is outside the density
 * ladder and keeps its optical `size-4.5`. It rounds with the public Checkbox's corner,
 * `rounded-md` capped at 4px in every theme. There is no `variant` axis: the one
 * consumer renders `<Checkbox slot="selection" />` with no variant.
 *
 * The invalid box takes the rac-target invalid state face on top of the error fill, and the
 * focused invalid face, a solid error line inside the halo, when it is also keyboard-focused. A
 * disabled box is a part of its disabled row, so like the row it keeps the muted colours
 * instead of the whole-control dim.
 */
export const checkboxVariants = tv({
  slots: {
    base: "group text-sm flex gap-2 text-inherit transition",
    box: `flex size-4.5 shrink-0 items-center justify-center ${checkboxCornerClass} border transition-colors ${stateFocusRingClass}`,
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
        box: cn(
          racInvalidStateFaceClass,
          "[--checkbox-color:var(--error)] forced-colors:[--checkbox-color:Mark]!"
        ),
      },
      false: {},
    },
    isFocusVisible: {
      true: {
        box: stateFocusRingVisibleClass,
      },
      false: {},
    },
  },
  compoundVariants: [
    {
      isInvalid: true,
      isFocusVisible: true,
      class: { box: stateInvalidFocusRingVisibleClass },
    },
  ],
  defaultVariants: {
    isSelected: false,
    isDisabled: false,
    isInvalid: false,
    isFocusVisible: false,
  },
});
