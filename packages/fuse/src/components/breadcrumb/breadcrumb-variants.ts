import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * The module-private recipe for Breadcrumb's parts. It is not exported from
 * `@elmeragroup/fuse/breadcrumb`, and the workspace-only recipe catalog re-exports it for the Figma
 * component sync. Every part is `fixed` in `density-roles.ts`, so no slot reads a density metric.
 *
 * - `list` sets the trail's type and its muted text color, which the links, the separators and the
 *   ellipsis inherit. It wraps the trail onto more lines where the trail runs out of room, and its
 *   gap widens from `sm:`.
 * - `item` lays out one entry of the trail in a row.
 * - `link` turns `foreground` on hover and draws the shared focus ring on itself.
 * - `page` draws the current page in `foreground` at the normal weight.
 * - `separator` sizes the `<svg>` it holds to 14px, the default CaretRight or a consumer's icon.
 * - `ellipsis` centers its 16px dots in a 20px box.
 */
export const breadcrumbVariants = tv({
  slots: {
    list: "text-sm sm:gap-2.5 flex flex-wrap items-center gap-1.5 wrap-break-word text-muted-foreground",
    item: "inline-flex items-center gap-1.5",
    link: cn("transition-colors hover:text-foreground", selfFocusRingClass),
    page: "font-normal text-foreground",
    separator: "[&>svg]:size-3.5",
    ellipsis: "flex size-5 items-center justify-center [&>svg]:size-4",
  },
});
