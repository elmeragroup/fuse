/**
 * Render a cell with the real Fuse Button to static HTML. The page needs no hydration: CSS draws
 * every state, and the page forces hover and focus as pseudo classes.
 *
 * - `icon=start` places `<Plus data-icon="inline-start" />` before the label, and `icon=end`
 *   places `<ArrowRight data-icon="inline-end" />` after it, the icons the kit's swap
 *   properties default to.
 * - An icon button holds a bare `<Plus />` and is named by `aria-label`.
 * - `disabled` sets `disabled`, and `pending` sets `isPending`, which renders the spinner.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build, the same `dist/`
 * that holds the CSS the page loads. `figma:compare` checks that the build exists before it
 * imports this module.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "../../../fuse/dist/button.js";
import { ArrowRight, Plus } from "../../../fuse/dist/icons.js";
import type { ElmeraIconProps } from "../../../fuse/dist/icons.js";
import type { Cell, IconPlacement } from "./cells.ts";

/** The label every label cell shows, the kit's `Label` default. */
const CELL_LABEL = "Button";

/** An icon with the `data-icon` marker the Button recipe reads to move the padding on its side. */
function markedIcon(icon: typeof Plus, marker: "inline-start" | "inline-end"): ReactElement {
  // JSX passes `data-icon` through, and an object literal can only name it through a type that
  // lists it.
  const props: ElmeraIconProps & Readonly<Record<"data-icon", string>> = { "data-icon": marker };
  return createElement(icon, { ...props, key: marker });
}

function labelChildren(icon: IconPlacement): readonly (ReactElement | string)[] {
  switch (icon) {
    case "start":
      return [markedIcon(Plus, "inline-start"), CELL_LABEL];
    case "end":
      return [CELL_LABEL, markedIcon(ArrowRight, "inline-end")];
    case "none":
      return [CELL_LABEL];
  }
}

/**
 * The Button's HTML for a cell.
 *
 * @param cell - A parsed cell.
 * @returns The `<button>` element as an HTML string.
 */
export function renderCellHtml(cell: Cell): string {
  const state = { disabled: cell.state === "disabled", isPending: cell.state === "pending" };
  const element =
    cell.component === "icon-button"
      ? createElement(
          Button,
          { variant: cell.variant, size: cell.size, ...state, "aria-label": CELL_LABEL },
          createElement(Plus)
        )
      : createElement(
          Button,
          { variant: cell.variant, size: cell.size, ...state },
          ...labelChildren(cell.icon)
        );
  return renderToStaticMarkup(element);
}
