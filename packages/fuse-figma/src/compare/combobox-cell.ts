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
 * - `comboboxChip`, `comboboxChips` and `comboboxChipsWrapped`: the docs Multiple demo's closed chips
 *   field, holding `Apple` alone, its `Apple` and `Cherry`, or all four of its items in a 256px host,
 *   at the cell's size, in a disabled Combobox or in an invalid `Field.Root`, measured as the chip or
 *   as the field box. The box fills the host.
 *
 * Every cell renders `Combobox.Input` in a host as wide as the kit's Input group, which the group's
 * `w-auto` fills. Fuse anchors the popup to the whole Input group, not the `<input>` inside it, so
 * each popup is the group's width at both densities. The popup aligns to the group's start, so it
 * starts on the slot's pixel grid and inside the slot. Combobox reads its labels from
 * `LocaleProvider`, which throws without one, so every cell renders in `en-US`, the locale the docs
 * set.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement, Fragment } from "react";
import type { ReactElement } from "react";

import { Combobox } from "../../../fuse/dist/combobox.js";
import { Field } from "../../../fuse/dist/field.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import {
  COMBOBOX_CHIPS,
  COMBOBOX_CHIPS_PLACEHOLDER,
  COMBOBOX_CHIPS_WRAPPED_WIDTH,
  COMBOBOX_FRUITS,
  COMBOBOX_INPUT_GROUP_WIDTH,
  COMBOBOX_BASIC_ROWS,
  COMBOBOX_GROUPS,
  COMBOBOX_ITEM_TEXT,
} from "../components/combobox-text.ts";
import type { Cell } from "../components/component-spec.ts";
import { INPUT_GROUP_TEXT } from "../components/input-group-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/** A host as wide as the kit's Input group, which the group fills. */
const HOST = { style: { width: `${COMBOBOX_INPUT_GROUP_WIDTH}px` } };

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
      value: cell.selected === "true" ? COMBOBOX_ITEM_TEXT : null,
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

/** The docs Multiple demo's chips field, holding `chips`, at `size`, disabled or in an invalid Field. */
function chipsField(
  chips: readonly string[],
  size: "default" | "sm",
  state: string | undefined,
  width: number = COMBOBOX_INPUT_GROUP_WIDTH
): ReactElement {
  const field = createElement(
    Combobox.Root,
    { items: [...chips], multiple: true, defaultValue: [...chips], disabled: state === "disabled" },
    createElement(
      Combobox.Chips,
      { "aria-label": "Selected fruit", size },
      createElement(Combobox.Value, {
        children: (value: string[]) => value.map((item) => createElement(Combobox.Chip, { key: item }, item)),
      }),
      createElement(Combobox.ChipsInput, { "aria-label": "Fruit", placeholder: COMBOBOX_CHIPS_PLACEHOLDER })
    )
  );
  return createElement(LocaleProvider, {
    locale: "en-US",
    children: createElement(
      "div",
      { style: { width: `${String(width)}px` } },
      state === "invalid" ? createElement(Field.Root, { invalid: true }, field) : field
    ),
  });
}

/** One chip, `Apple`, in a chips field that holds it alone, at rest or disabled. */
export const comboboxChip: ClientCellRendering = {
  element: (cell: Cell) => chipsField([COMBOBOX_ITEM_TEXT], "default", cell.state),
};

/** The docs Multiple demo's chips field at the cell's size, at rest, disabled or in an invalid Field. */
export const comboboxChips: ClientCellRendering = {
  element: (cell: Cell) => chipsField(COMBOBOX_CHIPS, cell.size === "sm" ? "sm" : "default", cell.state),
};

/** The docs Multiple demo's chips field holding all four items, in a host narrow enough to wrap them. */
export const comboboxChipsWrapped: ClientCellRendering = {
  element: (cell: Cell) => chipsField(COMBOBOX_FRUITS, "default", cell.state, COMBOBOX_CHIPS_WRAPPED_WIDTH),
};
