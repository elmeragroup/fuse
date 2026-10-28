import { tv } from "../../styles/tv";
import { overlayTitleLineClass } from "../overlay/overlay-classes";

/**
 * The module-private recipe for the classes AlertDialog adds to the Dialog parts it renders. It
 * is not exported from `@elmeragroup/fuse/alert-dialog`, and the workspace-only recipe catalog
 * re-exports it for the Figma component sync.
 *
 * - `header` turns Dialog's header into a row: the title, then the icon at the far end, 16px
 *   apart and aligned to the top.
 * - `title` balances the title's lines.
 * - `titleLine` holds the icon on the title's first line, as Alert centres its media on its title.
 * - `icon` is the 20px fallback icon, in `error` for the destructive variant.
 */
export const alertDialogVariants = tv({
  slots: {
    header: "flex-row items-start justify-between gap-4",
    title: "text-balance",
    titleLine: overlayTitleLineClass,
    icon: "size-5 shrink-0",
  },
  variants: {
    variant: {
      destructive: { icon: "text-error" },
      neutral: {},
    },
  },
  defaultVariants: {
    variant: "destructive",
  },
});
