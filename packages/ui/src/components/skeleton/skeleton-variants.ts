import { tv } from "tailwind-variants";

/**
 * Module-private recipe for the placeholder's silhouette. Not
 * exported from `@elmeragroup/ui/skeleton` — there is no proven recipe-borrowing
 * use. `silhouette` owns the radius so the docs demos never restyle the component.
 */
export const skeletonVariants = tv({
  base: "animate-pulse bg-muted",
  variants: {
    silhouette: {
      rounded: "rounded-md",
      circle: "rounded-full",
    },
  },
  defaultVariants: {
    silhouette: "rounded",
  },
});
