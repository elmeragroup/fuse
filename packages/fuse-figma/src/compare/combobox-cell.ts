/// <reference lib="dom" />
/**
 * The client renderers of the Combobox sets, each an open `Combobox.Root` mounted on the compare page
 * with its popup in the cell's slot, as `combobox-kit.ts` draws it.
 *
 * - `comboboxItem`: a popup whose list holds one row, `Apple`, the value or not, disabled through its
 *   `disabled` prop, measured as the row. Base UI marks a highlighted row `data-highlighted`, which
 *   the page writes on the highlighted cell.
 * - `comboboxEmpty`: a popup whose input matches no row, measured as the empty message.
 * - `comboboxPopup`: the docs Basic demo's rows, its Groups demo's groups, or a list no row matches,
 *   nothing selected, measured as the popup.
 * - `comboboxOpen`: the input and the popup with the Basic demo's rows, measured together.
 *
 * Every cell renders `Combobox.Input` in a host as wide as the kit's anchor, which the input's
 * `w-auto` fills, so each popup is the anchor's width plus 28px, as the kit draws it. The popup
 * aligns to the input's start, so it starts on the slot's pixel grid and inside the slot. Combobox
 * reads its labels from `LocaleProvider`, which throws without one, so every cell renders in
 * `en-US`, the locale the docs set.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement, Fragment } from "react";
import type { ReactElement } from "react";

import { Combobox } from "../../../fuse/dist/combobox.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import {
  COMBOBOX_ANCHOR_WIDTH,
  COMBOBOX_BASIC_ROWS,
  COMBOBOX_GROUPS,
  COMBOBOX_ITEM_TEXT,
} from "../components/combobox-text.ts";
import type { Cell } from "../components/component-spec.ts";
import { INPUT_GROUP_TEXT } from "../components/input-group-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/** A host as wide as the kit's anchor, which the input fills. */
const HOST = { style: { width: `${COMBOBOX_ANCHOR_WIDTH}px` } };

/** What an open Combobox lists: its items, the value it holds, and the popup's children. */
type Listing = {
  readonly items: readonly unknown[];
  readonly value: string | null;
  readonly children: readonly ReactElement[];
};

/** An open Combobox, its input in the host and its popup portalled into `container`. */
function openCombobox(container: HTMLElement, listing: Listing): ReactElement {
  return createElement(LocaleProvider, {
    locale: "en-US",
    children: createElement(
      "div",
      HOST,
      createElement(
        Combobox.Root,
        { defaultOpen: true, items: listing.items, defaultValue: listing.value },
        createElement(Combobox.Input, { "aria-label": "Fruit", placeholder: INPUT_GROUP_TEXT }),
        createElement(Combobox.Content, { container }, ...listing.children)
      )
    ),
  });
}

function row(label: string, disabled = false): ReactElement {
  return createElement(Combobox.Item, { key: label, value: label, disabled }, label);
}

/** The docs demos' popup children: the empty message, then the list. */
function popupChildren(list: ReactElement): readonly ReactElement[] {
  return [createElement(Combobox.Empty, { key: "empty" }), list];
}

/** The list of the root's items as rows, as the docs Basic demo renders them. */
function flatList(disabled = false): ReactElement {
  return createElement(
    Combobox.List,
    { key: "list" },
    createElement(Combobox.Collection, { children: (label: string) => row(label, disabled) })
  );
}

/** The list of the docs Groups demo's groups, a separator between them. */
function groupedList(): ReactElement {
  return createElement(
    Combobox.List,
    { key: "list" },
    createElement(Combobox.Collection, {
      children: (group: (typeof COMBOBOX_GROUPS)[number], index: number) =>
        createElement(
          Fragment,
          { key: group.value },
          index > 0 ? createElement(Combobox.Separator) : null,
          createElement(
            Combobox.Group,
            { items: [...group.items] },
            createElement(Combobox.Label, null, group.value),
            createElement(Combobox.Collection, { children: (label: string) => row(label) })
          )
        ),
    })
  );
}

/** A row of an open Combobox, the value or not, at rest, highlighted or disabled. */
export const comboboxItem: ClientCellRendering = {
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openCombobox(container, {
      items: [COMBOBOX_ITEM_TEXT],
      value: cell.selected === "on" ? COMBOBOX_ITEM_TEXT : null,
      children: popupChildren(flatList(cell.state === "disabled")),
    }),
  highlight: "data-highlighted",
};

/** The empty message of an open Combobox whose list holds no row. */
export const comboboxEmpty: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openCombobox(container, { items: [], value: null, children: popupChildren(flatList()) }),
};

/** What a popup cell lists: the Basic demo's rows, the Groups demo's groups, or nothing. */
function listingOf(cell: Cell): Listing {
  switch (cell.content) {
    case "grouped":
      return { items: COMBOBOX_GROUPS, value: null, children: popupChildren(groupedList()) };
    case "empty":
      return { items: [], value: null, children: popupChildren(flatList()) };
    default:
      return { items: COMBOBOX_BASIC_ROWS, value: null, children: popupChildren(flatList()) };
  }
}

/** An open Combobox's popup, with nothing selected. */
export const comboboxPopup: ClientCellRendering = {
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openCombobox(container, listingOf(cell)),
};

/** An open Combobox, its input and its popup with the Basic demo's rows. */
export const comboboxOpen: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openCombobox(container, listingOf({ content: "flat" })),
  union: ["input-group", "combobox-content"],
};
