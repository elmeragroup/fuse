import { tv } from "tailwind-variants";

import { controlInsetMdClass } from "./control-inset";

/**
 * DateField's slotted recipe (date-field.md §4). Package-private — no entry re-exports
 * it, and the interim tier has no public recipe surface. It lives here rather than beside
 * the component because every RAC entry keeps its recipe in `src/styles/`
 * (range-calendar.md §8.2's locked ruling).
 *
 * The field box height is not this recipe's business: `DateInput` runs the shared
 * `fieldGroupVariants` with the `input` slot handed in as `class`, which pins
 * `h-(--control-h-md)` for the whole field family (conventions.md ruling 2). There is no
 * `size` axis. The `input` slot itself is `controlInsetMdClass` plus the segment-row
 * geometry so the segmented row matches Input at both densities; `py-*` stays off the
 * height-pinned box.
 *
 * Every axis lives on `segment`, driven by RAC's `DateSegment` render props.
 */
export const dateFieldVariants = tv({
  slots: {
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- date-field.md §4: label/input stack gap is layout, not a control rung
    base: "flex flex-col gap-1",
    input: `block min-w-[150px] ${controlInsetMdClass}`,
    segment:
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- date-field.md §4: type-literal segments carry no inline padding
      "inline rounded-xs p-0.5 text-foreground caret-transparent outline outline-0 forced-color-adjust-none forced-colors:text-[ButtonText] type-literal:px-0",
  },
  variants: {
    isPlaceholder: {
      true: {
        segment: "text-muted-foreground italic",
      },
    },
    isDisabled: {
      true: {
        segment: "text-muted-foreground forced-colors:text-[GrayText]",
      },
    },
    isFocused: {
      true: {
        segment:
          "bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
      },
    },
  },
});
