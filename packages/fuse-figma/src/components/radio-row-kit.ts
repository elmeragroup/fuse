/**
 * Radio row, as one component set on the Radio page: `Radio`, the labelled row, hugging or filling,
 * off and on in Radio's four states, 16 cells. The root is Base UI's `<div data-slot="field-item">`
 * with the row recipe's `root`, a flex row.
 *
 * - A horizontal group lays its rows out at their own width, so a `width=hug` row hugs its label. A
 *   vertical group stretches each row across its width, so a `width=fill` row is 384px, the kit's
 *   field width, with its label packed at its start. Radio group shows both, since an instance cannot
 *   change its inner root's packing.
 *
 * - The row holds `Field.Label`, a `<label>` that lays out the radio and the content 8px apart in
 *   14px type, centred across. The whole label is the click target.
 * - The radio is a `Radio` instance in the cell's checked value and state, which takes the set's
 *   states: Base UI stamps them on the radio, and the content reads its `data-disabled` through
 *   `peer-data-disabled:`, so a disabled row dims the text to 50% while the radio dims itself.
 * - The content is a `<span>` that holds the text, a TEXT property, `Label`, that starts as the docs
 *   Basic demo's first option, `Fixed`.
 * - Base UI renders a visually hidden `<input type="radio">` beside the radio, which draws no layer.
 * - The row sits in a `RadioGroup`, which renders a `Field.Root`, a `Field.Set` and the group
 *   primitive around it, horizontal around a hugging row and vertical around a filling one. An invalid group's root passes its `data-invalid:text-error` to the text.
 * - The label's `has-disabled:cursor-not-allowed` sets the pointer, which Figma does not draw.
 */
import {
  fieldVariants,
  radioRowVariants,
  selectionGroupOrientationVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import { BASE_UI_CHECKED_FACTS } from "./component-spec";
import type {
  AncestorDefinition,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import { FIELD_ROOT, FIELD_ROOT_SR_ONLY, FIELD_ROOT_STRETCH } from "./field-box-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";
import { RADIO } from "./radio-kit";

/** The widths a row takes, as a horizontal group hugs its rows and a vertical one stretches them. */
const WIDTHS = ["hug", "fill"] as const;

/**
 * Whether a cell's row fills its group's width, as a vertical group stretches it.
 *
 * @param cell - A `radio-row` cell.
 * @returns True at `width=fill`.
 */
export function fillsRow(cell: Cell): boolean {
  return cell.width === "fill";
}

/**
 * The elements a `RadioGroup` puts around a row, outermost first: the `Field.Root`, the `Field.Set`
 * and the group primitive, horizontal around a hugging row and vertical around a filling one. An
 * invalid group's root passes its `data-invalid:text-error` down to the row's text.
 *
 * @param cell - A `radio-row` cell.
 * @returns The ancestors.
 */
export function radioGroupAround(cell: Cell): readonly AncestorDefinition[] {
  return [
    FIELD_ROOT,
    {
      slot: "field-set",
      classes: fieldVariants().set(),
      undrawn:
        "the fieldset stacks the group's legend, description, rows and error, which the row set does not draw",
    },
    {
      slot: "radio-group",
      classes: selectionGroupOrientationVariants({
        orientation: fillsRow(cell) ? "vertical" : "horizontal",
      }).group(),
      undrawn: "the group primitive lays out the rows, which the row set draws one at a time",
    },
  ];
}

/** The text every cell shows, the default of the `Label` property: the docs Basic demo's first option. */
export const RADIO_ROW_TEXT = "Fixed";

const slots = radioRowVariants();

/** The radio, a `Radio` instance in the cell's checked value and state. */
const RADIO_PART: InstanceDefinition = {
  kind: "instance",
  key: "radio",
  of: RADIO,
  cell: (outer) => ({ checked: outer.checked ?? "off", state: outer.state ?? "rest" }),
  shownIn: always,
};

/** The content, the `<span>` that holds the row's text and dims from the radio's `data-disabled`. */
const CONTENT: PartDefinition = {
  key: "content",
  slot: undefined,
  element: { tag: "span", attributes: {} },
  shownIn: always,
  classesFor: () => slots.content(),
  label: { key: "text", name: "text", characters: RADIO_ROW_TEXT, textProperty: "Label", shownIn: always },
  iconsFor: () => [],
};

/** `Field.Label`, the `<label>` around the radio and the content. */
const LABEL: PartDefinition = {
  key: "label",
  slot: undefined,
  element: { tag: "label", attributes: {} },
  shownIn: always,
  classesFor: () => slots.label(),
  label: undefined,
  iconsFor: () => [],
  parts: [RADIO_PART, CONTENT],
};

/** A row, as `<Radio value>Fixed</Radio>` in a `RadioGroup`, disabled or in an invalid group. */
export const RADIO_ROW: ComponentDefinition = {
  key: "radio-row",
  name: "Radio row",
  slot: "field-item",
  // The radio takes the states, as Base UI stamps them on its `<span>`.
  rootKind: "base-ui-span",
  statePart: "radio-group-item",
  axes: [
    { name: "width", values: WIDTHS },
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: () => slots.root(),
  ancestorsFor: radioGroupAround,
  // A vertical group stretches a row across its width, here the kit's field width; a horizontal one
  // gives it none, so it hugs.
  previewWidthFor: (cell) => (fillsRow(cell) ? FIELD_BOX_PREVIEW_WIDTH : undefined),
  states: {
    // The content reads the radio's `data-disabled`, and the label its hidden input's `:disabled`.
    disabled: ["peer-data-disabled", "has-disabled"],
  },
  facts: new Map([
    ...BASE_UI_CHECKED_FACTS,
    // The fieldset around the row holds the radio group, and the group holds rows, no selection cards.
    ["has-[>[data-slot=radio-group]]", always],
    ["has-[>[data-slot=checkbox-group]]", () => false],
    ["has-[>[data-selection-item]]", () => false],
  ]),
  omittedStates: new Set(),
  omittedCompositions: new Map([
    FIELD_ROOT_SR_ONLY,
    [FIELD_ROOT_STRETCH, "the Field stretches the row across its own width, which the set does not draw"],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [LABEL],
  swapProperties: [],
};
