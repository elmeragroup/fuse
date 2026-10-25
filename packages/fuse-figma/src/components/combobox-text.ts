/**
 * The docs Combobox demos' text and the kit's anchor width, which `combobox-kit.ts` draws and
 * `combobox-cell.ts` renders. It imports only the import-free `kit-lengths.ts`, so the compare page's
 * browser bundle can take it without the kit's builder.
 */

import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";

/** The text every row cell shows, the default of its `Label` property: the docs Basic demo's first row. */
export const COMBOBOX_ITEM_TEXT = "Apple";

/** The rows of the docs Basic demo, in its order. */
export const COMBOBOX_BASIC_ROWS = ["Apple", "Banana", "Orange", "Pear"] as const;

/**
 * The groups of the docs Groups demo, each with its label and rows, in its order, keyed as Base UI
 * reads grouped items: a `value` and its `items`.
 */
export const COMBOBOX_GROUPS = [
  { value: "Citrus", items: ["Lemon", "Lime", "Orange"] },
  { value: "Berries", items: ["Blueberry", "Strawberry"] },
] as const;

/** The message `Combobox.Empty` shows in `en-US`, the default of the `Text` property. */
export const COMBOBOX_EMPTY_TEXT = "No results.";

/**
 * The input's width, which Base UI publishes on the popup as `--anchor-width`: the Input group set's
 * preview width, which the open composite's input takes.
 */
export const COMBOBOX_ANCHOR_WIDTH = FIELD_BOX_PREVIEW_WIDTH;
