import { cn } from "../../styles/cn";
import { dialogShellClass } from "../../styles/inner-corner/dialog";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import {
  overlayFooterClass,
  overlayLayer,
  overlayModalFillClass,
  overlayModalPopupClass,
  overlayScrimClass,
  overlaySizeVariants,
  overlayTitleClass,
} from "../overlay/overlay-classes";

/**
 * The module-private recipe for the Dialog popup, with its width axis. It is not exported from
 * `@elmeragroup/fuse/dialog`, and the workspace-only recipe catalog re-exports it for the Figma
 * component sync. Dialog's modal fill and inner-corner shell come after the modal face, so the
 * fill replaces the face's popover fill and the shell's `rounded-xl` overrides the face's
 * `rounded-md`. The shell publishes the corner inside its padding.
 */
export const dialogContentVariants = tv({
  base: cn(
    overlayModalPopupClass,
    overlayModalFillClass,
    dialogShellClass,
    "text-sm fixed top-1/2 left-1/2 grid max-h-[calc(100%-2rem)] w-full max-w-(--overlay-width) -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto"
  ),
  variants: {
    // The 13-value overlay width axis, shared with Sheet.
    size: overlaySizeVariants.variants.size,
  },
  defaultVariants: {
    size: "md",
  },
});

/**
 * The module-private recipe for the Dialog parts around the popup. It is not exported from
 * `@elmeragroup/fuse/dialog`, and the workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 *
 * - `overlay` is the scrim over the viewport, fading in and out with the popup on the overlay
 *   layer.
 * - `header` stacks the title and description 8px apart.
 * - `footer` is the shared overlay footer: actions stacked, reversed, then in an end-aligned row
 *   from `sm`.
 * - `title` is the shared overlay title. `isFocusable` adds the self focus ring for a title that
 *   takes focus.
 * - `description` is muted 14px copy whose direct links underline and darken on hover.
 */
export const dialogVariants = tv({
  slots: {
    overlay: [
      overlayScrimClass,
      "fixed inset-0 isolate duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      overlayLayer,
    ],
    header: "flex flex-col gap-2",
    footer: overlayFooterClass,
    title: overlayTitleClass,
    description:
      "text-sm text-pretty text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
  },
  variants: {
    isFocusable: {
      true: { title: selfFocusRingClass },
    },
  },
  defaultVariants: {
    isFocusable: false,
  },
});
