import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { cardVariants } from "../card/card-variants";

/**
 * PUBLIC slot recipe (text-field.md §4). PhoneNumberField borrows it, so it ships
 * from `@elmeragroup/ui/text-field`. No size axis — the inner Input pins the md
 * field-box rung. The ref's unused textarea slot is omitted (§8.3).
 */
export const textFieldVariants = tv({
  slots: {
    base: "group flex flex-col gap-1",
    fieldGroup: "w-auto",
    input: "",
    labelContainer: "flex items-center justify-between",
    label: "",
    container: "flex flex-col gap-1",
    description: "text-sm",
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
          "border-transparent bg-transparent group-focus-within/inline-field:border-ring group-focus-within/inline-field:bg-background group-hover/inline-field:border-input group-hover/inline-field:bg-background group-data-[invalid]/inline-field:border-error group-data-[invalid]/inline-field:bg-background",
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
