import { cn } from "../../styles/cn";
import {
  itemDefaultShellClass,
  itemShellClass,
  itemSmShellClass,
  rowShellClass,
} from "../../styles/inner-corner/item";
import { nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass, withinFocusRingClass, withinFocusRingControlClass } from "../../styles/utils";

/**
 * Keeps a `hidden` part hidden. Fuse ships no preflight, so a slot's own `display` utility beats
 * the user agent's `[hidden]` rule. `hidden="until-found"` stays with the browser.
 */
const hiddenGuardClass = cn("[&[hidden]:not([hidden=until-found])]:hidden");

/**
 * The Attachment recipe. `root` takes Item's shell, so a part that rounds with `rounded-inner`
 * sits concentric inside it. Each size also writes the shell's block and inline padding to
 * `--attachment-inset-y` and `--attachment-inset-x`, which a vertical tile's floating actions read.
 * The other parts are separate components that never see the root's props, so they style off
 * the root's `data-size`, `data-orientation` and `data-state` through the `attachment` group.
 *
 * `variant` is the media's axis and changes only the `media` slot. Package-private: the facade
 * exports the parts, not the recipe.
 */
export const attachmentVariants = tv({
  slots: {
    root: cn(
      itemShellClass,
      // A border box, so a width such as `w-full` or a tile's width includes the padding and
      // border in a host without Tailwind's preflight too.
      "group/attachment relative box-border flex max-w-full min-w-0 shrink-0 border-border bg-card text-card-foreground transition-colors duration-100",
      "data-[state=error]:border-error/30 data-[state=idle]:border-dashed",
      // Only a root holding an enabled trigger fills on hover.
      "has-enabled-trigger:enabled-hover:bg-muted",
      hiddenGuardClass
    ),
    media: cn(
      "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-inner bg-muted text-foreground",
      // The size widths and the xs glyph apply to a row only, so they never compete with a
      // tile's full-width media and its larger glyph.
      "group-data-[orientation=vertical]/attachment:w-full group-data-[orientation=horizontal]/attachment:group-data-[size=sm]/attachment:w-8 group-data-[orientation=horizontal]/attachment:group-data-[size=xs]/attachment:w-7",
      "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[orientation=horizontal]/attachment:group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
      // A Loader pads itself for a page; inside the media its glyph is the whole content.
      "*:data-[slot=loader]:p-0",
      "group-data-[state=error]/attachment:bg-error/10 group-data-[state=error]/attachment:text-error",
      // An AspectRatio child sets the height, so the square gives way.
      "has-data-[slot=attachment-aspect-ratio]:aspect-auto",
      hiddenGuardClass
    ),
    aspectRatio: "w-full",
    content: cn("flex max-w-full min-w-0 flex-1 flex-col gap-0.5", hiddenGuardClass),
    title: cn(
      "leading-tight font-medium block max-w-full min-w-0 truncate group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer",
      hiddenGuardClass
    ),
    description: cn(
      "text-xs leading-tight block max-w-full min-w-0 truncate text-muted-foreground group-data-[state=error]/attachment:text-error",
      hiddenGuardClass
    ),
    // The actions stack above the trigger. On a vertical tile they float 0.25rem inside the
    // media's top end corner; `end-*` is logical, so right-to-left text mirrors them.
    actions: cn(
      "relative z-20 flex shrink-0 items-center gap-1",
      "group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:end-[calc(var(--attachment-inset-x)+--spacing(1))] group-data-[orientation=vertical]/attachment:top-[calc(var(--attachment-inset-y)+--spacing(1))]",
      hiddenGuardClass
    ),
    // The trigger covers the root's border box, so its focus ring traces the root's outer edge.
    // Fuse ships no preflight, so it resets a native button's face, padding and type itself, as
    // `Card.SectionButton` does, and takes the state face's disabled cursor.
    trigger: cn(
      "absolute -inset-px z-10 box-border cursor-pointer rounded-[inherit] border-0 bg-transparent p-0 text-inherit",
      "font-[family-name:inherit] text-[length:inherit] leading-[inherit] font-[weight:inherit]",
      selfFocusRingClass,
      nativeStateFaceClass
    ),
    group: cn("relative flex min-w-0 flex-col rounded-md", withinFocusRingClass, hiddenGuardClass),
    // The viewport fades an edge only while content lies past it: Base UI marks a viewport whose
    // content overflows and writes each edge's overflow distance to it, so a fade grows to 2.5rem
    // as that edge's content does. A linear gradient has no logical direction, so right-to-left
    // text runs it from the right.
    groupViewport: cn(
      "min-w-0 snap-x snap-mandatory scroll-px-1 overscroll-x-contain rounded-[inherit]",
      "[--attachment-fade:to_right] rtl:[--attachment-fade:to_left]",
      "data-has-overflow-x:[mask-image:linear-gradient(var(--attachment-fade),transparent_0,black_min(2.5rem,var(--scroll-area-overflow-x-start,0px)),black_calc(100%_-_min(2.5rem,var(--scroll-area-overflow-x-end,0px))),transparent_100%)]",
      withinFocusRingControlClass
    ),
    // The list pads 0.25rem so a tile's focus ring paints inside the viewport's clip.
    groupList: cn(
      "flex w-max gap-(--surface-gap-sm) p-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
      hiddenGuardClass
    ),
  },
  variants: {
    size: {
      default: {
        root: [
          itemDefaultShellClass,
          "text-sm gap-(--surface-gap-md) [--attachment-inset-x:var(--surface-pad-md)] [--attachment-inset-y:var(--surface-pad-md)]",
        ],
      },
      sm: {
        root: [
          itemSmShellClass,
          "text-xs gap-(--surface-gap-sm) [--attachment-inset-x:var(--surface-pad-md)] [--attachment-inset-y:var(--row-px)]",
        ],
      },
      xs: {
        root: [
          rowShellClass,
          "text-xs gap-(--surface-gap-sm) [--attachment-inset-x:var(--row-px)] [--attachment-inset-y:var(--row-py)]",
        ],
      },
    },
    orientation: {
      horizontal: { root: "min-w-40 items-center" },
      // A tile's media is 8.5rem wide at every size and density, so two `icon-xs` actions,
      // 32px each when comfortable, cover no more than half of it. The tile adds its inline
      // padding and its 1px borders around that, which the root's border box includes.
      vertical: { root: "w-[calc(8.5rem+2*var(--attachment-inset-x)+2px)] flex-col" },
    },
    variant: {
      icon: {},
      // An image dims while it is not settled, and fills the frame it sits in.
      image: {
        media:
          "outline-black/10 opacity-60 outline outline-1 -outline-offset-1 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:size-full *:[img]:object-cover",
      },
    },
  },
  defaultVariants: {
    size: "default",
    orientation: "horizontal",
    variant: "icon",
  },
});
