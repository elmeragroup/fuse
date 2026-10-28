import { cn } from "./cn";
import { fieldEntryClass } from "./field-size";
import { dateInputShellClass } from "./inner-corner/date-field";
import { tv } from "./tv";

/**
 * DateField's slotted recipe. Package-private: no entry re-exports it. Every RAC entry
 * keeps its recipe in `src/styles/`.
 *
 * `DateInput` hands the `input` slot to the shared `fieldGroupVariants` as `class`, and
 * that recipe's `size` axis writes the field size, so this recipe has no `size` axis. The
 * `input` slot reads the field inset and text-entry type of the box it sits in, its own or a
 * picker's, so the segment row lines up with Input at both sizes and densities. It sets no
 * `py-*` and no display, because the field group owns the box height and its flex layout.
 */
export const dateFieldVariants = tv({
  slots: {
    // An invalid field paints its label in the error colour, as `Field.Root` does; every
    // other part sets its own colour.
    base: "flex flex-col gap-1 data-invalid:text-error",
    input: cn(fieldEntryClass, dateInputShellClass),
    segment: cn(
      "inline rounded-inner p-0.5 text-foreground caret-transparent outline outline-0 forced-color-adjust-none forced-colors:text-[ButtonText] type-literal:px-0"
    ),
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
