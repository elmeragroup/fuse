import { tv } from "tailwind-variants";

/**
 * DateField's slotted recipe (date-field.md §4). Package-private — no entry re-exports
 * it, and the interim tier has no public recipe surface. It lives here rather than beside
 * the component because every RAC entry keeps its recipe in `src/styles/`
 * (range-calendar.md §8.2's locked ruling).
 *
 * The field box itself is not this recipe's business: `DateInput` runs the shared
 * `fieldGroupVariants` with the `input` slot handed in as `class`, which is what pins the
 * `md` control rung for the whole field family (conventions.md ruling 2). So there is no
 * `size` axis here, no `--control-*` variable is read, and no box metric is restated.
 *
 * Every axis lives on `segment`, driven by RAC's `DateSegment` render props.
 */
export const dateFieldVariants = tv({
  slots: {
    base: "flex flex-col gap-1",
    input: "text-sm block min-w-[150px] px-2 py-1.5",
    segment:
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
