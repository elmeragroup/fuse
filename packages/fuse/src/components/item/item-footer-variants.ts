import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";

// The two switchable modes share one 150 ms ease-out transition of the row size, the top
// padding, the fade and the slide, the duration and curve of `panelHeightTransition`, so a
// reveal expands and fades in and a hide collapses and fades out. `minmax(0,0fr)` to
// `minmax(0,1fr)` interpolates without measuring, so the footer stays a server part, and a
// mode change mid-tween reverses from the current value. `@starting-style` covers only the fade
// and the slide, so a footer that renders visible does not grow on first paint. The central
// reduced-motion rule keeps only the fade.
const itemFooterMotionClass = cn(
  "ease-out transition-[grid-template-rows,padding-top,opacity,translate] duration-150"
);

// The content overflows its row while the row is shorter than it, so the content element clips
// in both switchable modes. It is the footer's grid item, and a stretched grid item's margin box
// fills its cell, so `-m-1 p-1` grows its clip edge, the padding box, 0.25rem past the cell on
// every side while its content box stays the cell, and the footer's own box is unchanged. That
// room is 4px at the default 16px root. The shared focus ring, a flush 2px ring, paints whole on
// content at any edge. The focused invalid face reaches 4px, so it paints whole at the default
// root, and a smaller root clips a fraction of its halo.
const itemFooterClipClass = cn("-m-1 overflow-clip p-1");

/**
 * The `Item.Footer` recipe: `root` is the footer's grid and `content` the element inside it that
 * holds the footer's children, by the footer's `mode`. Package-private: not on the
 * `@elmeragroup/fuse/item` facade. The workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 */
export const itemFooterVariants = tv({
  slots: {
    root: "grid",
    content: "flex min-h-0 flex-col gap-3",
  },
  variants: {
    mode: {
      default: { root: "grid-rows-[minmax(0,1fr)] pt-3 opacity-100" },
      visible: {
        root: cn(
          "translate-y-0 grid-rows-[minmax(0,1fr)] pt-3 opacity-100",
          itemFooterMotionClass,
          "starting:-translate-y-1.5 starting:opacity-0"
        ),
        content: itemFooterClipClass,
      },
      // The collapsed row is 0px but its content keeps its height, so the clip keeps it out of
      // the page and any scroll container.
      hidden: {
        root: cn(
          "pointer-events-none -translate-y-1.5 grid-rows-[minmax(0,0fr)] pt-0 opacity-0",
          itemFooterMotionClass
        ),
        content: itemFooterClipClass,
      },
    },
  },
  defaultVariants: {
    mode: "default",
  },
});
