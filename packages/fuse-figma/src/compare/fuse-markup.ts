/**
 * Render a cell with the real Fuse Button to static HTML. The page needs no hydration: CSS draws
 * every state, and the page forces hover and focus as pseudo classes.
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
import type { CellChild, CellMarkup } from "./cell-markup.ts";

const ICONS = { Plus, ArrowRight } as const;

function renderChild(child: CellChild, index: number): ReactElement | string {
  if (child.kind === "label") {
    return child.text;
  }
  const icon = ICONS[child.icon];
  if (child.dataIcon === undefined) {
    return createElement(icon, { key: index });
  }
  // `data-icon` is the marker the Button recipe reads, which JSX passes through and an object
  // literal can only name through a type that lists it.
  const props: ElmeraIconProps & Readonly<Record<"data-icon", string>> = { "data-icon": child.dataIcon };
  return createElement(icon, { ...props, key: index });
}

/**
 * The Button's HTML for a cell.
 *
 * @param markup - The cell's props and children.
 * @returns The `<button>` element as an HTML string.
 */
export function renderCellHtml(markup: CellMarkup): string {
  const children = markup.children.map(renderChild);
  const { props } = markup;
  const element =
    props.kind === "icon"
      ? createElement(
          Button,
          {
            variant: props.variant,
            size: props.size,
            disabled: props.disabled,
            isPending: props.isPending,
            "aria-label": props.ariaLabel,
          },
          ...children
        )
      : createElement(
          Button,
          { variant: props.variant, size: props.size, disabled: props.disabled, isPending: props.isPending },
          ...children
        );
  return renderToStaticMarkup(element);
}
