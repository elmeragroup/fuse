import { toolbarShellClass } from "../../styles/inner-corner/toolbar";
import { tv } from "../../styles/tv";
import { overlayPopupFillClass } from "../overlay/overlay-classes";
import { separatorClass } from "../separator/separator-class";

/**
 * The module-private recipe for the Toolbar parts that carry a look. It is not exported from
 * `@elmeragroup/fuse/toolbar`, and the workspace-only recipe catalog re-exports it for the Figma
 * component sync. Buttons, links and inputs take the look of the control they render.
 *
 * - `root` is the bar: the Toolbar shell, which rounds, pads and publishes `--inner-corner`, on a
 *   bordered popover fill, its items 4px apart in a row, or a column when vertical.
 * - `group` lays its items out 4px apart in a row, or a column in a vertical toolbar.
 * - `separator` is Separator's hairline across the toolbar, 4px short of the items' edges at each
 *   end.
 */
export const toolbarVariants = tv({
  slots: {
    root: [
      toolbarShellClass,
      overlayPopupFillClass,
      "flex w-fit items-center gap-1 border-border data-vertical:flex-col",
    ],
    group: "flex items-center gap-1 data-vertical:flex-col",
    separator: [
      separatorClass,
      "data-horizontal:mx-1 data-horizontal:w-auto data-horizontal:self-stretch data-vertical:my-1",
    ],
  },
});
