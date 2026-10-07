import { cn } from "./cn";
import { searchBoxShellClass, searchClearShellClass } from "./inner-corner/search-field";
import { tv } from "./tv";

/**
 * SearchField's slotted recipe. Package-private — no entry re-exports
 * it, and the interim tier has no public recipe surface. It lives here rather than beside
 * the component because every RAC entry keeps its recipe in `src/styles/`
 *
 * The field box itself is not this recipe's business: `FieldGroup` runs the shared
 * `fieldGroupVariants`, which is what pins the `md` control rung for the whole field
 * family. So there is no `size` axis here, no `--control-*`
 * variable is read, and no box metric is restated.
 */
export const searchFieldVariants = tv({
  slots: {
    // An invalid field paints its label in the error colour, as `Field.Root` does; every
    // other part sets its own colour.
    base: "group flex min-w-12 flex-col gap-1 data-invalid:text-error",
    icon: "ml-2 size-4 text-foreground group-aria-disabled:text-muted-foreground forced-colors:text-[ButtonText] forced-colors:group-aria-disabled:text-[GrayText]",
    input: "[&::-webkit-search-cancel-button]:hidden",
    /** The field box, which publishes the corner its clear button rounds with. */
    group: searchBoxShellClass,
    // The clear button sits inside the field box, so it takes the box's inner corner instead
    // of Button's `--radius-button`.
    button: cn("w-6 px-0 group-data-[empty]:invisible", searchClearShellClass),
    buttonIcon: "size-4 text-foreground",
  },
});
