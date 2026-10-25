/// <reference lib="dom" />
/**
 * The client renderers of the Command sets, each an inline `Command.Root` mounted on the compare page
 * in a host that carries the palette surface's `text-popover-foreground`, as `command-kit.ts` draws it.
 *
 * - `commandItem`: a list that holds one row, `New customer`, with no trailing part, a
 *   `Command.Shortcut` of the `Kbd group` set's caps, or as a `Command.PageTrigger` in a Root with a
 *   stack, disabled through its `disabled` prop, measured as the row. The row sits in a `<div>` as wide
 *   as the set draws it, with no `data-slot`, which the markup check passes over. Base UI marks a
 *   highlighted row `data-highlighted`, which the page writes on the highlighted cell.
 * - `commandList`: the docs Groups demo's palette in a host as wide as the list, its rows' shortcuts
 *   Alt and their letters, measured as the list.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Command } from "../../../fuse/dist/command.js";
import { Kbd } from "../../../fuse/dist/kbd.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import {
  COMMAND_GROUPS,
  COMMAND_ITEM_TEXT,
  COMMAND_LIST_MODIFIER,
  COMMAND_LIST_WIDTH,
  COMMAND_ROW_CELL_WIDTH,
  COMMAND_SHORTCUT_KEYS,
} from "../components/command-text.ts";
import type { Cell } from "../components/component-spec.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/**
 * The palette surface's text color, which the rows inherit, in `en-US`, the locale the docs set:
 * Command reads its labels from `LocaleProvider`, which throws without one.
 */
function surface(width: number | undefined, palette: ReactElement): ReactElement {
  return createElement(LocaleProvider, {
    locale: "en-US",
    children: createElement(
      "div",
      {
        className: "text-popover-foreground",
        style: width === undefined ? undefined : { width: `${width}px` },
      },
      palette
    ),
  });
}

/** The page a caret row's `Command.PageTrigger` opens, which the cell never opens. */
const NEXT_PAGE = "next";

/** A row cell's row: plain, with the shortcut after its text, or a page trigger. */
function row(cell: Cell): ReactElement {
  const disabled = cell.state === "disabled";
  if (cell.trailing === "caret") {
    return createElement(
      Command.PageTrigger,
      { value: COMMAND_ITEM_TEXT, page: NEXT_PAGE, disabled },
      COMMAND_ITEM_TEXT
    );
  }
  return createElement(
    Command.Item,
    { value: COMMAND_ITEM_TEXT, disabled },
    COMMAND_ITEM_TEXT,
    cell.trailing === "shortcut"
      ? createElement(
          Command.Shortcut,
          null,
          ...COMMAND_SHORTCUT_KEYS.map((key) => createElement(Kbd, { key }, key))
        )
      : null
  );
}

/**
 * The docs demos' palette parts: the search input, then the list holding the cell's row in a host as
 * wide as the set draws a row.
 */
function palette(cell: Cell): readonly ReactElement[] {
  return [
    createElement(Command.Input, { key: "input", "aria-label": "Search actions" }),
    createElement(Command.List, {
      key: "list",
      children: (value: string) =>
        createElement("div", { key: value, style: { width: `${COMMAND_ROW_CELL_WIDTH}px` } }, row(cell)),
    }),
  ];
}

/** A row of an inline palette, with no trailing part, a shortcut or a caret, at rest, highlighted or disabled. */
export const commandItem: ClientCellRendering = {
  element: (cell: Cell) =>
    surface(
      undefined,
      cell.trailing === "caret"
        ? createElement(
            Command.Root,
            { defaultPages: ["home"] },
            createElement(
              Command.Page,
              { id: "home", label: "Commands", items: [COMMAND_ITEM_TEXT] },
              ...palette(cell)
            ),
            createElement(Command.Page, { id: NEXT_PAGE, label: "Next", items: [] })
          )
        : createElement(Command.Root, { items: [COMMAND_ITEM_TEXT] }, ...palette(cell))
    ),
  highlight: "data-highlighted",
};

/** The docs Groups demo's list, each row's shortcut Alt and its letter, measured as the list. */
export const commandList: ClientCellRendering = {
  element: () =>
    surface(
      COMMAND_LIST_WIDTH,
      createElement(
        Command.Root,
        { grouped: true, items: COMMAND_GROUPS },
        createElement(Command.Input, { "aria-label": "Search actions" }),
        createElement(Command.Empty),
        createElement(Command.List, {
          children: (group: (typeof COMMAND_GROUPS)[number]) =>
            createElement(
              Command.Group,
              { key: group.value, items: group.items },
              createElement(Command.Label, null, group.value),
              createElement(Command.Collection, {
                children: (action: (typeof group.items)[number]) =>
                  createElement(
                    Command.Item,
                    { key: action.label, value: action },
                    action.label,
                    createElement(
                      Command.Shortcut,
                      null,
                      createElement(Kbd, null, COMMAND_LIST_MODIFIER),
                      createElement(Kbd, null, action.key)
                    )
                  ),
              })
            ),
        })
      )
    ),
};
