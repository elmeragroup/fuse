import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { fieldEntryClass, fieldReads, fieldSize } from "../../styles/field-size";
import { dateInputShellClass } from "../../styles/inner-corner/date-field";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import {
  dataWithinInvalidFocusRingClass,
  withinFocusRingClass,
  withinFocusRingControlClass,
} from "../../styles/utils";

/**
 * DateInput's module-private recipe. No entry exports it.
 *
 * - `root` is the field box around the segments, the box React Aria's DateInput paints:
 *   the shared field chrome, the field height of its `size`, the md control inset and the text-entry
 *   type, floored at 150px wide. Its segments are direct children marked `data-focus-ring-control`,
 *   so the box rings while one has keyboard focus. Base UI-style `data-invalid` and `data-disabled`
 *   give it the data-target state face, and `data-readonly` the muted read-only fill. The whole
 *   box is the pointer target, which keeps the 24px target-size floor: a press beside the segments
 *   focuses the last filled one.
 * - `segment` is one segment: a span the box's type sizes, highlighted while focused, muted and
 *   italic while it shows its placeholder, muted while disabled. A literal takes no padding.
 */
export const dateInputVariants = tv({
  slots: {
    root: cn(
      fieldBoxChromeClass,
      fieldReads.height(),
      fieldEntryClass,
      dateInputShellClass,
      "flex w-full min-w-[150px] cursor-text items-center overflow-hidden whitespace-nowrap",
      dataStateFaceClass,
      withinFocusRingClass,
      dataWithinInvalidFocusRingClass,
      "data-readonly:bg-muted"
    ),
    // A visually hidden input: the ISO value it submits and the validity a form reads stay out of
    // sight and out of the tab order.
    hiddenInput: "pointer-events-none sr-only",
    segment: cn(
      "inline rounded-inner p-0.5 text-foreground tabular-nums caret-transparent forced-color-adjust-none",
      withinFocusRingControlClass,
      // A literal keeps its spaces: as a flex item it would lose the one closing ", " before a time.
      "data-[type=literal]:px-0 data-[type=literal]:whitespace-pre",
      "data-placeholder:text-muted-foreground data-placeholder:italic",
      "data-disabled:text-muted-foreground forced-colors:data-disabled:text-[GrayText]",
      "focus:bg-primary focus:text-primary-foreground forced-colors:focus:bg-[Highlight] forced-colors:focus:text-[HighlightText]"
    ),
  },
  variants: {
    size: {
      default: { root: fieldSize({ size: "default" }).box() },
      sm: { root: fieldSize({ size: "sm" }).box() },
    },
  },
  defaultVariants: {
    size: "default",
  },
});
