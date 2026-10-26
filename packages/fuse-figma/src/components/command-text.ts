/**
 * The docs Command demos' text and the kit's row width, which `command-kit.ts` draws and
 * `command-cell.ts` renders. It imports nothing, so the compare page's browser bundle can take it
 * without the kit's builder.
 */

/** The text every row cell shows, the default of its `Label` property: the docs Groups demo's first row. */
export const COMMAND_ITEM_TEXT = "New customer";

/** The caps of a row cell's shortcut: the `Kbd group` set's own combination, which the row's instance of that set shows. */
export const COMMAND_SHORTCUT_KEYS = ["Ctrl", "K"] as const;

/**
 * The width of a row cell: a sample, since a row fills its list. The renderer holds the row in a host
 * this wide.
 */
export const COMMAND_ROW_CELL_WIDTH = 320;

/**
 * The groups of the docs Groups demo, each with its label and rows, in its order, keyed as Base UI
 * reads grouped items: a `value` and its `items`. Each row's `key` is the letter its Alt shortcut
 * names.
 */
export const COMMAND_GROUPS = [
  {
    value: "Create",
    items: [
      { label: "New customer", key: "N" },
      { label: "New contract", key: "C" },
      { label: "Register meter reading", key: "R" },
    ],
  },
  {
    value: "Go to",
    items: [
      { label: "Customers", key: "U" },
      { label: "Invoices", key: "I" },
      { label: "Meter points", key: "M" },
    ],
  },
] as const;

/** The modifier of every row's shortcut in the docs Groups demo. */
export const COMMAND_LIST_MODIFIER = "Alt";

/** The width of the list: the palette's, `max-w-xl`, which the list fills. */
export const COMMAND_LIST_WIDTH = 576;
