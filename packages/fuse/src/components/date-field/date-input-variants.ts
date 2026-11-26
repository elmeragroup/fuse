import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { fieldEntryClass, fieldReads, fieldSize } from "../../styles/field-size";
import { dateInputShellClass } from "../../styles/inner-corner/date-field";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { dateBoxFocusRingClass, withinFocusRingControlClass } from "../../styles/utils";

/**
 * A segment row's inline overflow, shared by DateField's box and a picker's rows. A row narrower
 * than its segments scrolls inline without a scrollbar, so a swipe, a trackpad or a focused segment
 * reaches the hidden ones; see `date-input-row-scroll.ts`. A disabled row has no focusable segment,
 * and a browser may make a scroller with nothing to focus a tab stop of its own, so it clips.
 */
export const dateRowScrollClass = cn(
  "no-scrollbar overflow-x-auto overflow-y-hidden data-disabled:overflow-x-hidden"
);

/**
 * DateInput's module-private recipe. No entry exports it.
 *
 * - `root` is the field box around the segments, the box React Aria's DateInput paints:
 *   the shared field chrome, the field height of its `size`, the md control inset and the text-entry
 *   type, floored at 150px wide. It rings through {@link dateBoxFocusRingClass} while a segment
 *   matches `:focus-visible`. A picker's rows drop this box, and the picker's group rings for them.
 *   Base UI-style `data-invalid` and `data-disabled` give it the data-target state face, and
 *   `data-readonly` the muted read-only fill. A press beside the segments focuses the last filled one.
 * - `segment` is one segment: a span the box's type sizes, highlighted while focused, muted and
 *   italic while it shows its placeholder, muted while disabled. A focusable segment is a target of
 *   its own, so its `segmentKind` variant floors it at 24 CSS pixels on each side, the fixed WCAG
 *   2.5.8 floor, and centers its text. The floor does not scale with the host root. A consumer's
 *   `min-w-*` or `min-h-*` class replaces it. A focusable segment does not shrink, so a row too
 *   narrow for the segments scrolls inline through {@link dateRowScrollClass}. A literal is not a
 *   target and takes none of the floor. It keeps zero inline padding and its block padding.
 */
export const dateInputVariants = tv({
  slots: {
    root: cn(
      fieldBoxChromeClass,
      fieldReads.height(),
      fieldEntryClass,
      dateInputShellClass,
      "flex w-full min-w-[150px] cursor-text items-center whitespace-nowrap",
      dateRowScrollClass,
      dataStateFaceClass,
      dateBoxFocusRingClass,
      "data-readonly:bg-muted"
    ),
    // A visually hidden input: the ISO value it submits and the validity a form reads stay out of
    // sight and out of the tab order.
    hiddenInput: "pointer-events-none sr-only",
    segment: cn(
      "inline rounded-inner p-0.5 text-foreground tabular-nums caret-transparent",
      withinFocusRingControlClass,
      // A literal keeps its spaces: as a flex item it would lose the one closing ", " before a time.
      "data-[type=literal]:px-0 data-[type=literal]:whitespace-pre",
      "data-placeholder:text-muted-foreground data-placeholder:italic",
      "data-disabled:text-muted-foreground forced-colors:data-disabled:text-[GrayText]",
      // Only a focused segment opts out of forced colors, so Chromium paints no Canvas backplate
      // behind its HighlightText. The browser forces every other segment's text to the palette's.
      "focus:bg-primary focus:text-primary-foreground focus:forced-color-adjust-none forced-colors:focus:bg-[Highlight] forced-colors:focus:text-[HighlightText]"
    ),
  },
  variants: {
    size: {
      default: { root: fieldSize({ size: "default" }).box() },
      sm: { root: fieldSize({ size: "sm" }).box() },
    },
    // A variant, not a `data-[type=literal]` selector, so a literal carries none of these classes
    // and `cn` lets a consumer's sizing class replace them. `inline-flex` keeps both minimums when
    // a wrapper takes the segment out of the box's flex row, and centers a line shorter than 24px,
    // so the text lines up with a literal's, which the row centers.
    segmentKind: {
      literal: {},
      focusable: {
        segment: "inline-flex min-h-[24px] min-w-[24px] shrink-0 items-center justify-center",
      },
    },
  },
  defaultVariants: {
    size: "default",
  },
});
