import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { readOnlyFillCancelClass } from "../../styles/field-box";
import { cardVariants } from "../card/card-variants";
import { fieldFrameVariants } from "../field/field-frame";

const frame = fieldFrameVariants();

/**
 * PUBLIC slot recipe. Layout slots compose FieldFrame
 * recipe slots so the documented names stay stable while the frame owns the defaults.
 * No size axis — the inner Input pins the md field-box rung. The ref's unused textarea
 * slot is omitted.
 */
export const textFieldVariants = tv({
  slots: {
    base: frame.root(),
    fieldGroup: "w-auto",
    input: "",
    labelContainer: frame.labelRow(),
    label: "",
    container: frame.content(),
    description: frame.description(),
    iconContainer: "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 [&>svg]:size-4",
  },
  variants: {
    variant: {
      card: {
        // The card is the field box, so it takes the read-only fill and the borderless input
        // inside it cancels its own, which would paint a band across the card.
        base: cn(cardVariants().base(), "gap-0 px-6 py-4 has-[input[readonly]:not(:disabled)]:bg-muted"),
        fieldGroup: "w-full border-none",
        input: cn("text-lg rounded-none border-none p-0", readOnlyFillCancelClass),
        label: "text-muted-foreground",
        container: "flex flex-row items-center gap-3",
        description: "text-muted-foreground",
      },
      inline: {
        base: "group/inline-field",
        // The input is the whole control, so the wrapper's hover repaints it only while it is
        // enabled: a disabled inline field keeps its resting border and fill (the state face).
        // The gate negates fuse.css's one `disabled-state` predicate. `not-disabled-state:`
        // adds no specificity and sorts with the `not-*` variants ahead of `focus-visible:`,
        // so `focus-visible:border-ring` still wins on a hovered, focused field. A read-only
        // inline field keeps the field box's read-only fill at rest, as a disabled one keeps its
        // disabled fill, so it never passes for plain text; the fill's `[readonly]` selector
        // outranks the hover and focus-within reveals.
        fieldGroup:
          "border-transparent bg-transparent group-focus-within/inline-field:bg-background group-hover/inline-field:not-disabled-state:border-input group-hover/inline-field:not-disabled-state:bg-background group-data-[invalid]/inline-field:border-error group-data-[invalid]/inline-field:bg-background focus-visible:border-ring",
      },
    },
    hidden: {
      true: {
        base: "hidden",
      },
    },
    isIconActive: {
      true: {
        fieldGroup: "relative",
        input: "truncate overflow-hidden pr-10 whitespace-nowrap",
      },
    },
  },
  defaultVariants: {
    hidden: false,
    isIconActive: false,
  },
});
