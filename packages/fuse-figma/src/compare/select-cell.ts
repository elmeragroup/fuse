/// <reference lib="dom" />
/**
 * The client renderers of the Select sets, each an open `Select.Root` mounted on the compare page with
 * its popup in the cell's slot, as `select-kit.ts` draws it.
 *
 * - `selectItem`: a popup that holds one row, `Apple`, the value or not, disabled through its
 *   `disabled` prop, measured as the row. Fuse styles a highlighted row with `focus:`, so the page
 *   forces `:focus` on the highlighted cell.
 * - `selectPopup`: the docs Basic demo's rows or its Groups demo's groups, nothing selected, measured
 *   as the popup.
 * - `selectOpen`: the trigger at a size, holding the Basic demo's placeholder, and the popup with the
 *   Basic demo's rows, measured as the trigger and the popup together.
 *
 * Each trigger is narrower than the popup's 144px minimum. A row or a popup measures alone, so its
 * popup aligns to the trigger's start, which starts it on the slot's pixel grid and inside the slot.
 * The open composite keeps Select's centered popup and centers the trigger in a 144px host instead,
 * so the popup starts at the slot's start. No Select is modal, so no open popup marks another cell
 * hidden, and none aligns its selected row over the trigger, which the kit does not draw.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Select } from "../../../fuse/dist/select.js";
import type { Cell } from "../components/component-spec.ts";
import { SELECT_BASIC_ROWS, SELECT_GROUPS, SELECT_ITEM_TEXT } from "../components/select-kit.ts";
import { SELECT_TRIGGER_TEXT, sizeFor } from "../components/select-trigger-kit.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/** A row's value, its label in lowercase, as the docs demos key their items. */
const valueOf = (label: string): string => label.toLowerCase();

/** The items a root lists, by value, for `Select.Value` to show a selected row's label. */
const itemsOf = (labels: readonly string[]) =>
  Object.fromEntries(labels.map((label) => [valueOf(label), label]));

/** An open, non-modal Select whose popup portals into `container`. */
function openSelect(
  container: HTMLElement,
  options: {
    readonly labels: readonly string[];
    readonly value: string | null;
    readonly size: "default" | "sm";
    readonly align: "start" | "center";
  },
  rows: readonly ReactElement[]
): ReactElement {
  return createElement(
    Select.Root,
    { defaultOpen: true, modal: false, items: itemsOf(options.labels), defaultValue: options.value },
    createElement(
      Select.Trigger,
      { size: options.size },
      createElement(Select.Value, { placeholder: SELECT_TRIGGER_TEXT })
    ),
    createElement(Select.Content, { container, align: options.align, alignItemWithTrigger: false }, ...rows)
  );
}

function row(label: string, disabled = false): ReactElement {
  return createElement(Select.Item, { key: label, value: valueOf(label), disabled }, label);
}

/** A row of an open Select, the value or not, at rest, highlighted or disabled. */
export const selectItem: ClientCellRendering = {
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openSelect(
      container,
      {
        labels: [SELECT_ITEM_TEXT],
        value: cell.selected === "on" ? valueOf(SELECT_ITEM_TEXT) : null,
        size: "default",
        align: "start",
      },
      [row(SELECT_ITEM_TEXT, cell.state === "disabled")]
    ),
  highlight: "focus",
};

/** The rows of the docs Basic demo, or the groups of its Groups demo with a separator between them. */
function popupRows(cell: Cell): readonly ReactElement[] {
  if (cell.content === "flat") {
    return SELECT_BASIC_ROWS.map((label) => row(label));
  }
  const groups = SELECT_GROUPS.map(({ label, rows }) =>
    createElement(
      Select.Group,
      { key: label },
      createElement(Select.Label, null, label),
      ...rows.map((each) => row(each))
    )
  );
  return groups.flatMap((group, index) =>
    index === 0 ? [group] : [createElement(Select.Separator, { key: `separator-${index}` }), group]
  );
}

/** Every row label a popup cell lists. */
function labelsOf(cell: Cell): readonly string[] {
  return cell.content === "flat" ? SELECT_BASIC_ROWS : SELECT_GROUPS.flatMap(({ rows }) => rows);
}

/** An open Select's popup, with nothing selected. */
export const selectPopup: ClientCellRendering = {
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    openSelect(
      container,
      { labels: labelsOf(cell), value: null, size: "default", align: "start" },
      popupRows(cell)
    ),
};

/** A host as wide as the popup, which centers the trigger in it, so the centered popup starts at its start. */
const HOST = "flex w-36 justify-center";

/** An open Select at a size, its trigger and its popup. */
export const selectOpen: ClientCellRendering = {
  hostClasses: HOST.split(" "),
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(
      "div",
      { className: HOST },
      openSelect(
        container,
        { labels: SELECT_BASIC_ROWS, value: null, size: sizeFor(cell), align: "center" },
        popupRows({ content: "flat" })
      )
    ),
  union: ["select-trigger", "select-content"],
};
