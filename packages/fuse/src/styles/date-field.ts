import { tv } from "tailwind-variants";

import { controlInsetMdClass } from "./control-inset";

/**
 * DateField's slotted recipe. Package-private: no entry re-exports it. Every RAC entry
 * keeps its recipe in `src/styles/`.
 *
 * `DateInput` hands the `input` slot to the shared `fieldGroupVariants` as `class`, and
 * that recipe pins the md control height, so this recipe has no `size` axis. The `input`
 * slot carries the md inset so the segment row lines up with Input at both densities. It
 * sets no `py-*` and no display, because the field group owns the box height and its flex
 * layout.
 */
export const dateFieldVariants = tv({
  slots: {
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- label/input stack gap is layout, not a control rung
    base: "flex flex-col gap-1",
    input: controlInsetMdClass,
    segment:
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- type-literal segments carry no inline padding
      "inline rounded-xs p-0.5 text-foreground caret-transparent outline outline-0 forced-color-adjust-none forced-colors:text-[ButtonText] type-literal:px-0",
  },
  variants: {
    /**
     * Who paints the field box. A lone field paints its own and floors it at 150px. Inside
     * a picker the FieldGroup paints it and the picker recipe sets the floor.
     */
    surface: {
      own: { input: "min-w-[150px]" },
      group: { input: "" },
    },
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
  defaultVariants: {
    surface: "own",
  },
});
