import { tv } from "tailwind-variants";

/**
 * SearchField's slotted recipe (search-field.md §4). Package-private — no entry re-exports
 * it, and the interim tier has no public recipe surface. It lives here rather than beside
 * the component because every RAC entry keeps its recipe in `src/styles/`
 * (range-calendar.md §8.2's locked ruling).
 *
 * The field box itself is not this recipe's business: `FieldGroup` runs the shared
 * `fieldGroupVariants`, which is what pins the `md` control rung for the whole field
 * family (conventions.md ruling 2). So there is no `size` axis here, no `--control-*`
 * variable is read, and no box metric is restated.
 */
export const searchFieldVariants = tv({
  slots: {
    base: "group flex min-w-12 flex-col gap-1",
    icon: "ml-2 size-4 text-foreground group-aria-disabled:text-muted-foreground forced-colors:text-[ButtonText] forced-colors:group-aria-disabled:text-[GrayText]",
    input: "[&::-webkit-search-cancel-button]:hidden",
    button: "mr-1 w-6 px-0 group-data-[empty]:invisible",
    buttonIcon: "size-4 text-foreground",
  },
});
