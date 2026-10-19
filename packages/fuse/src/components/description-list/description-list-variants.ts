import { tv } from "../../styles/tv";

/**
 * Module-private recipe for `DescriptionList.Content`, not exported from
 * `@elmeragroup/fuse/description-list`. The list's layouts. Each publishes the term colour as the private `--description-list-term`, so
 * a nested list resets it and a consumer colour class on a term still wins in both layouts. The
 * term and details style the rest of the inline layout from the list's `data-layout`.
 * An inline list sets the label type on itself, which its cells inherit. Its columns are
 * `minmax(0,1fr)` for the terms and `fit-content(60%)` for the details, and consecutive inline
 * lists are spaced by the large surface gap.
 */
export const descriptionListContentVariants = tv({
  base: "grid",
  variants: {
    layout: {
      responsive:
        "text-base/6 sm:grid-cols-[min(50%,calc(var(--spacing)*80))_auto] sm:text-sm/6 grid-cols-1 [--description-list-term:var(--muted-foreground)]",
      inline: [
        "grid-cols-[minmax(0,1fr)_fit-content(60%)] gap-x-(--surface-gap-md) gap-y-(--surface-gap-sm)",
        "text-(length:--label-text) leading-(--label-leading) [--description-list-term:currentColor]",
        "[&+&]:mt-(--surface-gap-lg)",
      ],
    },
  },
  defaultVariants: {
    layout: "responsive",
  },
});
