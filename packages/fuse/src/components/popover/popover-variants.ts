import { popoverShellClass } from "../../styles/inner-corner/popover";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayTimedPopupClass } from "../overlay/overlay-classes";

/**
 * The module-private recipe for the Popover popup and its header. It is not exported from
 * `@elmeragroup/fuse/popover`, and the workspace-only recipe catalog re-exports it for the Figma
 * component sync. The arrow keeps its classes in `popover.tsx`.
 *
 * - `content` is the shared timed popup on the Popover shell, which rounds, pads and publishes
 *   `--inner-corner`, with the shared focus ring. It is 288px wide and stacks its parts 16px apart.
 * - `header` stacks the title and description 4px apart at 14px.
 * - `title` is Medium weight and balances its lines.
 * - `description` is muted and avoids a short last line.
 */
export const popoverVariants = tv({
  slots: {
    content: [
      selfFocusRingClass,
      overlayTimedPopupClass,
      popoverShellClass,
      "text-sm flex w-72 flex-col gap-4",
    ],
    header: "text-sm flex flex-col gap-1",
    title: "font-medium text-balance",
    description: "text-pretty text-muted-foreground",
  },
});
