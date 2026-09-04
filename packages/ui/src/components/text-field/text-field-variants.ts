import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { cardVariants } from "../card/card-variants";
import { fieldFrameVariants } from "../field/field-frame";

const frame = fieldFrameVariants();

/**
 * PUBLIC slot recipe (text-field.md §4). Layout slots compose FieldFrame
 * recipe slots so the documented names stay stable while the frame owns the defaults.
 * No size axis — the inner Input pins the md field-box rung. The ref's unused textarea
 * slot is omitted (§8.3).
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
        base: cn(cardVariants().base(), "gap-0 px-6 py-4"),
        fieldGroup: "w-full border-none",
        input: "text-lg rounded-none border-none p-0",
        label: "text-muted-foreground",
        container: "flex flex-row items-center gap-3",
        description: "text-muted-foreground",
      },
      inline: {
        base: "group/inline-field",
        fieldGroup:
          "border-transparent bg-transparent group-focus-within/inline-field:bg-background group-hover/inline-field:border-input group-hover/inline-field:bg-background group-data-[invalid]/inline-field:border-error group-data-[invalid]/inline-field:bg-background focus-visible:border-ring",
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
