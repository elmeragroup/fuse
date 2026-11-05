import { cn } from "../../styles/cn";
import { labelTypeClass } from "../../styles/label-type";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * The Carousel recipe, one slot per styled part. Package-private: the facade exports the parts,
 * not the recipe.
 *
 * The viewport is a native scroll-snap container, so the browser's own scroller runs every swipe,
 * wheel turn and keyboard scroll. `mandatory` snapping with `scroll-snap-stop: always` on each
 * slide stops a flick at the next slide. `overscroll-behavior` contains the axis, so a swipe past
 * the last slide does not navigate the page back or scroll it sideways, and `touch-action` stays
 * at its default, so a vertical swipe over a horizontal carousel still scrolls the page.
 * `scroll-behavior: smooth` animates a control's page change, and the central reduced-motion rule
 * in `fuse.css` sets it to `auto`. The scrollbar is hidden: the controls and the swipe replace it.
 *
 * A slide is the viewport's width or height by default. A consumer class such as `basis-1/2`
 * shows more at once, and each slide stays a snap position, so the pages follow the layout. A
 * margin on each slide spaces them.
 */
export const carouselVariants = tv({
  slots: {
    // A stack, so the viewport and a controls row below it space out without classes.
    root: "relative flex min-w-0 flex-col gap-(--surface-gap-md)",
    viewport: cn("no-scrollbar flex min-h-0 min-w-0 snap-mandatory scroll-smooth", selfFocusRingClass),
    slide: "min-h-0 min-w-0 shrink-0 grow-0 basis-full snap-start snap-always",
    controls: "flex flex-wrap items-center justify-center gap-(--surface-gap-lg)",
    // The outline button rests on the card surface, as the design draws it over a tinted page.
    edge: "bg-card",
    // Mirrored in a right-to-left carousel, where Previous points right.
    edgeIcon: "",
    indicators: "flex flex-wrap items-center justify-center gap-1",
    // The button is the 24px target and draws the shared ring around the mark, which its
    // `::after` paints: an 8px dot, and a 28px pill for the current page. With the 4px gap the
    // dots' centres sit 28px apart, and the targets never overlap. The pill's width follows the
    // current page with a transition the central reduced-motion rule removes.
    indicator: cn(
      "m-0 inline-flex h-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent px-2 py-0 aria-disabled:cursor-default",
      // The round ring would leave the target's corners to its neighbour's hit test, so the
      // square `::before` of `hit-area-0` keeps the whole 24px box the button's.
      "hit-area-0",
      "after:ease-out after:block after:h-2 after:w-2 after:rounded-full after:bg-muted-foreground after:transition-[width,background-color] after:duration-200 after:content-['']",
      "data-current:after:w-7 data-current:after:bg-foreground enabled-hover:after:bg-foreground/70",
      selfFocusRingClass
    ),
    // An indicator with its own content, such as a thumbnail, keeps the ring, the reset and the
    // 24px target floor, so small content still gets a whole target at both densities.
    indicatorContent: cn(
      "m-0 inline-flex min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-inherit aria-disabled:cursor-default",
      selfFocusRingClass
    ),
    // The page count beside the controls reads the label text, as a field's description does.
    status: cn(labelTypeClass, "text-muted-foreground tabular-nums"),
  },
  variants: {
    orientation: {
      horizontal: {
        viewport: "snap-x overflow-x-auto overflow-y-hidden overscroll-x-contain",
        edgeIcon: "rtl:-scale-x-100",
      },
      vertical: {
        viewport: "snap-y flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain",
      },
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});
