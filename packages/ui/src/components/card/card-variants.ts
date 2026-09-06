import { tv } from "tailwind-variants";

/**
 * PUBLIC slot recipe. `text-field`'s `card` variant and
 * `CheckboxCard` compose it, so it ships from `@elmeragroup/ui/card`.
 * One axis only — the external ref's surface/padding axes are decomposed away.
 */
export const cardVariants = tv({
  slots: {
    base: "shadow-xs flex flex-col rounded-lg border bg-card text-card-foreground",
    cardHeader:
      "@container/card-header grid auto-rows-min items-start gap-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
    cardTag: "text-sm font-semibold text-muted-foreground",
    cardTitle: "font-semibold leading-none",
    cardDescription: "text-muted-foreground",
    cardAction: "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
    cardContent: "",
    cardFooter: "flex items-center",
  },
  variants: {
    direction: {
      vertical: {
        cardHeader: "p-6",
        cardContent: "p-6 pt-0",
        cardFooter: "p-6 pt-0",
      },
      horizontal: {
        base: "flex-row items-center space-x-6 p-6",
        cardHeader: "flex items-start justify-start space-y-1.5",
        cardTitle: "text-xl",
      },
    },
  },
  defaultVariants: {
    direction: "vertical",
  },
});

/**
 * Module-private type-scale recipes for `Card.Title` / `Card.Description`.
 * Not exported from `@elmeragroup/ui/card` — there is no borrow
 * pattern. Kept off `cardVariants` because `direction="horizontal"` already
 * sets `cardTitle: "text-xl"`; a second `size` axis on that slot would fight
 * through twMerge. `size` is a type-scale axis, not a density control-box rung:
 * it does not read `--control-*`.
 */
export const cardTitleVariants = tv({
  variants: {
    size: {
      default: "text-base",
      sm: "text-sm",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
      "4xl": "text-4xl",
      "5xl": "text-5xl",
      "6xl": "text-6xl",
    },
  },
  defaultVariants: {
    size: "2xl",
  },
});

export const cardDescriptionVariants = tv({
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      default: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});
