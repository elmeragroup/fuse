/**
 * The renderers of the `item` and `item-link` sets: each cell as the real Fuse `Item` in a host as
 * wide as the kit's preview width, which the row's `w-full` fills.
 *
 * - An `item` cell holds the cell's media, the content column with the docs Basic demo's title and,
 *   where the cell is described, its description, and the actions holding the demo's plain
 *   `<span>Active</span>`. Icon media holds the demo's Lightning. Image media holds an `<img>` of the
 *   kit's portrait as a data URI, so the page draws the pixels Figma draws, where the docs demo
 *   holds a one-pixel GIF.
 * - An `item-link` cell renders the row through `render={<a href="#order" />}`, as the docs As a
 *   link demo does, around icon media and the demo's title. A disabled cell marks the `<a>`
 *   `aria-disabled="true"`, as the demo's unavailable row does. The page forces hover and focus as
 *   pseudo classes, which the row's `[a]:enabled-hover:` and `focus-visible:` read on a plain `<a>`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Lightning } from "../../../fuse/dist/icons.js";
import { Item } from "../../../fuse/dist/item.js";
import type { Cell } from "../components/component-spec.ts";
import {
  ITEM_ACTIONS_TEXT,
  ITEM_DESCRIPTION_TEXT,
  ITEM_LINK_TITLE_TEXT,
  ITEM_PREVIEW_WIDTH,
  ITEM_TITLE_TEXT,
  itemLinkLook,
  itemLook,
} from "../components/item-kit.ts";
import type { ItemLook } from "../components/item-kit.ts";
import { portraitPng } from "../components/portrait.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The row's media: the Lightning in icon media, or the portrait in image media. */
function media(look: ItemLook): ReactElement {
  return look.media === "image"
    ? createElement(
        Item.Media,
        { variant: "image" },
        createElement("img", {
          alt: "",
          src: `data:image/png;base64,${Buffer.from(portraitPng()).toString("base64")}`,
        })
      )
    : createElement(Item.Media, { variant: "icon" }, createElement(Lightning, { "aria-hidden": true }));
}

/** A host as wide as the preview width around a row. */
function host(row: ReactElement): ReactElement {
  return createElement("div", { style: { width: `${ITEM_PREVIEW_WIDTH}px` } }, row);
}

/** An `item` cell: the Basic demo's row at the cell's variant, size, media and description. */
export const item: CellRendering = {
  element: (cell: Cell) => {
    const look = itemLook(cell);
    return host(
      createElement(
        Item.Root,
        { variant: look.variant, size: look.size },
        media(look),
        createElement(
          Item.Content,
          null,
          createElement(Item.Title, null, ITEM_TITLE_TEXT),
          look.described ? createElement(Item.Description, null, ITEM_DESCRIPTION_TEXT) : null
        ),
        createElement(Item.Actions, null, createElement("span", null, ITEM_ACTIONS_TEXT))
      )
    );
  },
};

/** An `item-link` cell: the As a link demo's row at the cell's variant, unavailable where disabled. */
export const itemLink: CellRendering = {
  element: (cell: Cell) => {
    const look = itemLinkLook(cell);
    const disabled = cell.state === "disabled" ? { "aria-disabled": "true" } : {};
    return host(
      createElement(
        Item.Root,
        { variant: look.variant, render: createElement("a", { href: "#order", ...disabled }) },
        media(look),
        createElement(Item.Content, null, createElement(Item.Title, null, ITEM_LINK_TITLE_TEXT))
      )
    );
  },
};
