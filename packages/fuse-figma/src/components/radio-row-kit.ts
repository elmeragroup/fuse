/**
 * Radio row, as one component set on the Radio page: `Radio`, the labelled row, hugging or filling,
 * off and on in Radio's four states, 16 cells. The root is Base UI's `<div data-slot="field-item">`.
 *
 * - A horizontal group lays its rows out at their own width, so a `width=hug` row hugs its label. A
 *   vertical group stretches each row across its width, so a `width=fill` row is 384px, the kit's
 *   field width, with its label packed at its start. Radio group shows both, since an instance cannot
 *   change its inner root's packing.
 * - The row holds `Field.Label`, a `<label>` around the radio and the content. The whole label is the
 *   click target.
 * - The radio is a `Radio` instance in the cell's checked value and state, which takes the set's
 *   states.
 * - The content is a `<span>` that holds the text, a TEXT property, `Label`, that starts as the docs
 *   Basic demo's first option, `Fixed`.
 * - Base UI renders a visually hidden `<input type="radio">` beside the radio, which draws no layer.
 * - The row sits in a `RadioGroup`, which renders a `Field.Root`, a `Field.Set` and the group
 *   primitive around it, horizontal around a hugging row and vertical around a filling one.
 */
import type { LabelManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { HUG_OR_FILL } from "./field-box-kit";
import { always } from "./popup-facts";
import { RADIO_MANIFEST } from "./radio-kit";

/** The text every cell shows, the default of the `Label` property: the docs Basic demo's first option. */
export const RADIO_ROW_TEXT = "Fixed";

/** The radio's cell: the row's checked value and state. */
function radioCell(outer: Cell): Cell {
  return { checked: outer.checked ?? "off", state: outer.state ?? "rest" };
}

/** The row's text, which the `Label` property sets. */
const TEXT: LabelManifest = {
  key: "text",
  name: "text",
  characters: RADIO_ROW_TEXT,
  textProperty: "Label",
  shownIn: always,
};

/**
 * The row's manifest, which the capture-backed build reads with `captures/radio-row.json`, as
 * `<Radio value>Fixed</Radio>` in a `RadioGroup` renders it, disabled or in an invalid group: the
 * `<label>` at the row's first place, holding the radio and the content `<span>`. A filling row's
 * host is the field width its renderer gives it, which the capture measures.
 */
export const RADIO_ROW_MANIFEST: SetManifest = {
  key: "radio-row",
  name: "Radio row",
  slot: "field-item",
  statePart: "radio-group-item",
  axes: [
    // A horizontal group hugs its rows, and a vertical one stretches them.
    { name: "width", values: HUG_OR_FILL },
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "label",
      slot: undefined,
      place: "field-item/0",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        { kind: "instance", key: "radio", of: RADIO_MANIFEST, cell: radioCell, shownIn: always },
        {
          key: "content",
          slot: undefined,
          place: "field-item/0/2",
          shownIn: always,
          label: TEXT,
          iconsFor: () => [],
        },
      ],
    },
  ],
  swapProperties: [],
};
