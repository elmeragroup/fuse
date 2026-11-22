/**
 * Combobox's chips field, as two component sets on the Combobox page: one chip, and the field box that
 * holds the docs Multiple demo's chips and its input on one line.
 *
 * - `Combobox chip` is `Combobox.Chip`, `Apple` at rest and in a disabled Combobox: 2 cells. Its label
 *   is the chip's own text, and its remove button, `Combobox.ChipRemove` rendering Button's ghost
 *   `icon-inline` square with X, is an `Icon button` instance, disabled where the Combobox is. In the
 *   chip, `text-xs` makes the square 16px, which the instance holds as its own fixed size.
 * - `Combobox chips` is `Combobox.Chips` holding the demo's `Apple` and `Cherry` chips, as `Combobox
 *   chip` instances, and `Combobox.ChipsInput`, at both sizes, at rest, focused, disabled and in an
 *   invalid Field: 8 cells. The input takes the states, and the box reads them from it.
 * - The box wraps its row, and the input's `flex-1` grows from its 64px minimum, which breaks the line
 *   where the chips leave it less room. Two chips leave it room on one line, so the set draws that
 *   line, and the row's `flex-wrap` and `row-gap` stay unmapped. The chip and the chips sets sample a
 *   384px host, the field boxes' preview width, which the box fills. A field whose chips wrap onto a
 *   second line is a #922 line.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import { COMBOBOX_CHIPS, COMBOBOX_CHIPS_PLACEHOLDER, COMBOBOX_ITEM_TEXT } from "./combobox-text";
import type { Cell } from "./component-spec";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";

/** The chip's state where the field around it is in `outer`'s: disabled with it, at rest otherwise. */
function chipState(outer: Cell): Cell {
  return { state: outer.state === "disabled" ? "disabled" : "rest" };
}

/** The chip's remove button: Button's ghost `icon-inline` square with X, an `Icon button` instance. */
const REMOVE: InstanceManifest = {
  kind: "instance",
  key: "remove",
  of: ICON_BUTTON_MANIFEST,
  slot: "combobox-chip-remove",
  cell: (outer) => ({ variant: "ghost", size: "icon-inline", ...chipState(outer) }),
  properties: () => ({ swap: { Icon: "X" } }),
  shownIn: always,
  after: "label",
};

/**
 * The chip's manifest, which the capture-backed build reads with `captures/combobox-chip.json`:
 * `<Combobox.Chip>Apple</Combobox.Chip>`, alone in a chips field, in a Combobox at rest or disabled.
 */
export const COMBOBOX_CHIP_MANIFEST: SetManifest = {
  key: "combobox-chip",
  name: "Combobox chip",
  api: { page: "combobox", parts: ["Combobox.Chip"] },
  slot: "combobox-chip",
  axes: [{ name: "state", values: ["rest", "disabled"] }],
  columnAxis: "state",
  label: {
    key: "label",
    name: "label",
    characters: COMBOBOX_ITEM_TEXT,
    textProperty: "Label",
    shownIn: always,
  },
  iconsFor: () => [],
  parts: [REMOVE],
  swapProperties: [],
};

/** A chip of the field, an instance of the chip's set in the field's state, its label exposed. */
function chip(label: string): InstanceManifest {
  return {
    kind: "instance",
    key: `chip-${label.toLowerCase()}`,
    of: COMBOBOX_CHIP_MANIFEST,
    cell: chipState,
    properties: () => ({ text: { Label: label } }),
    shownIn: always,
    exposed: true,
  };
}

/** The chips input, its placeholder behind the `Text` property. */
const INPUT: PartManifest = {
  key: "input",
  slot: "combobox-chip-input",
  shownIn: always,
  label: {
    key: "text",
    name: "text",
    characters: COMBOBOX_CHIPS_PLACEHOLDER,
    textProperty: "Text",
    shownIn: always,
    textAttribute: () => "placeholder",
  },
  iconsFor: () => [],
};

/**
 * The chips field's manifest, which the capture-backed build reads with `captures/combobox-chips.json`:
 * the docs Multiple demo's `<Combobox.Chips size>` around its chips and `Combobox.ChipsInput`, in a
 * Combobox that is disabled or sits in an invalid `Field.Root`. The input takes the states.
 */
export const COMBOBOX_CHIPS_MANIFEST: SetManifest = {
  key: "combobox-chips",
  name: "Combobox chips",
  api: { page: "combobox", parts: ["Combobox.Chips"] },
  slot: "combobox-chips",
  statePart: "combobox-chip-input",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "size", values: ["default", "sm"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [...COMBOBOX_CHIPS.map(chip), INPUT],
  swapProperties: [],
};
