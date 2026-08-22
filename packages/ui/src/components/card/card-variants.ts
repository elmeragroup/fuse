import { tv } from "tailwind-variants";

/**
 * PUBLIC slot recipe (card.md §4). `text-field`'s `card` variant and
 * `CheckboxCard` compose it, so it ships from `@elmeragroup/ui/card`.
 * One axis only — the external ref's surface/padding axes are decomposed away (§8.5).
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
        base: "",
        cardHeader: "p-6",
        cardTitle: "",
        cardDescription: "",
        cardContent: "p-6 pt-0",
        cardFooter: "p-6 pt-0",
      },
      horizontal: {
        base: "flex-row items-center space-x-6 p-6",
        cardHeader: "flex items-start justify-start space-y-1.5",
        cardTitle: "text-xl",
        cardDescription: "",
        cardContent: "",
        cardFooter: "",
      },
    },
  },
  defaultVariants: {
    direction: "vertical",
  },
});
