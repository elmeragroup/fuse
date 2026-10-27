/**
 * Number field, as two component sets on a page of their own: the stepper, and `NumberField` with
 * the docs Basic demo's label and description in five states.
 *
 * - `Number field stepper` is the increase stepper, Base UI's `<button aria-label="Increase">` with
 *   the stepper slot of `numberFieldVariants`, at rest, hovered, disabled and read-only: 4 cells. It is a
 *   full-height column `--control-h-xs` wide, floored at 24px, with a 1px `input` start border on a
 *   `background` fill, holding a 16px glyph, Plus, that its `Icon` swap property picks. Hover fills
 *   it `muted`; a stepper disabled at a bound fills `muted` and mutes its glyph. A read-only field's
 *   stepper stays enabled, so it draws as at rest. It has no pressed face, so the set draws none. `h-full` takes the height of the group around it, 34px in a dense
 *   field, the height the set draws; in Number field the instance fills the group at each density.
 * - `Number field` holds the Field root with FieldFrame's part spacing: the heading row with a `Label`
 *   instance, then Base UI's NumberField root around the group, the field box at the md control
 *   height, which holds the value, the optional denomination and the two steppers, then the error in
 *   an invalid Field and the description. The value is the input's own text, `4`, which the `Value`
 *   text property sets. The denomination, `kWh` in 14px `muted-foreground`, sits behind the
 *   `Denomination` BOOLEAN, which starts off, as the Basic demo sets none.
 * - The group takes the field's states from its input, a direct child it reads through `has-`
 *   variants, so focus rings it, invalid draws the `error` border and ring, and a disabled field dims
 *   it to 50%. A disabled or read-only group fills `muted`.
 * - Base UI's NumberField parts carry no `data-slot`, so each part is named by its element.
 */
import { cn, fieldFrameVariants, fieldVariants, numberFieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import type {
  Cell,
  ComponentDefinition,
  ElementSelector,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import { swapProperties } from "./component-spec";
import { userAgentDisplay } from "./element-defaults";
import {
  FIELD_FRAME_DISABLED,
  FIELD_FRAME_OMISSIONS,
  frameDescriptions,
  frameError,
  frameLabelRow,
} from "./field-frame-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";

/** The label: the docs Basic demo's. */
export const NUMBER_FIELD_LABEL = "Quantity";

/** The description: the docs Basic demo's. */
export const NUMBER_FIELD_DESCRIPTION = "Whole packs.";

/** The error the invalid cells show: the docs Error demo's message. */
export const NUMBER_FIELD_ERROR = "Enter a quantity of 1 or more.";

/** The value every cell shows: the docs States demo's. */
export const NUMBER_FIELD_VALUE = 4;

/** The denomination: the docs Denomination demo's. */
export const NUMBER_FIELD_DENOMINATION = "kWh";

/** The BOOLEAN property that shows the denomination. */
export const NUMBER_FIELD_DENOMINATION_PROPERTY = "Denomination";

const frame = fieldFrameVariants();

/**
 * A stepper's height in its field: the md control height less the group's 1px borders, 34px dense and
 * 42px comfortable, which `field-box-content-h` holds.
 */
const STEPPER_PREVIEW_HEIGHT = { css: "calc(var(--control-h-md) - 2px)", pixels: 34 } as const;

const slots = (cell: Cell) =>
  numberFieldVariants({ isMuted: cell.state === "disabled" || cell.state === "readonly" });

/** The stepper's glyph, a direct 16px `<svg>`, which the `Icon` property swaps. */
const GLYPH: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Plus",
  swapProperty: "Icon",
  classes: "size-4",
};

/**
 * The increase stepper, as `<NumberField>` renders it, at rest, hovered or disabled at its bound.
 *
 * In Figma, the left stroke alone counts in layout and adds no width: a stepper instance stays 24 or
 * 32 wide, fills the field box's height and centres its glyph in the 23px or 31px content box, at x 4.5
 * or 8.5, as CSS's border box does (W5-P7). The decrease instance's `Icon` swap to Minus holds in
 * Number field's main and in an instance of it (W5-P8).
 */
export const NUMBER_FIELD_STEPPER: ComponentDefinition = {
  key: "number-field-stepper",
  name: "Number field stepper",
  slot: "number-field-stepper",
  element: { tag: "button", attributes: { "aria-label": "Increase" } },
  rootKind: "native-control",
  previewHeight: STEPPER_PREVIEW_HEIGHT,
  axes: [{ name: "state", values: ["rest", "hover", "disabled", "readonly"] }],
  columnAxis: "state",
  classesFor: () => numberFieldVariants().stepper(),
  // Base UI marks a stepper `aria-disabled` while it is disabled, and in a read-only field it marks it
  // `aria-disabled` and `data-readonly` and leaves it enabled, so it draws as at rest.
  states: { disabled: ["aria-disabled"], readonly: ["aria-disabled", "data-readonly"] },
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [GLYPH],
  swapProperties: swapProperties([GLYPH]),
};

/**
 * A stepper instance, the decrease stepper with Minus or the increase stepper with Plus. An invalid
 * field stamps `data-invalid` on its steppers, which no stepper cell shows and no stepper class reads,
 * and facts read the inner cell, so the invalid cells hold their own instances whose fact holds it.
 */
function stepper(direction: "decrease" | "increase", invalid: boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: invalid ? `${direction}-invalid` : direction,
    of: NUMBER_FIELD_STEPPER,
    element: {
      tag: "button",
      attributes: { "aria-label": direction === "decrease" ? "Decrease" : "Increase" },
    },
    // A disabled field disables its steppers, and a read-only one marks them read-only.
    cell: (outer) => ({
      state: outer.state === "disabled" || outer.state === "readonly" ? outer.state : "rest",
    }),
    properties: () => ({ swap: { Icon: direction === "decrease" ? "Minus" : "Plus" } }),
    facts: new Map([["data-invalid", () => invalid]]),
    shownIn: (cell) => (cell.state === "invalid") === invalid,
  };
}

/** The visible input, the one `<input>` Base UI marks as its focus ring's control. */
const INPUT_ELEMENT: ElementSelector = { tag: "input", attributes: { "data-focus-ring-control": true } };

/** The input, which holds the value as its own text on one line. */
const INPUT: PartDefinition = {
  key: "input",
  slot: undefined,
  element: INPUT_ELEMENT,
  shownIn: always,
  classesFor: (cell) => slots(cell).input(),
  label: {
    key: "text",
    name: "text",
    characters: String(NUMBER_FIELD_VALUE),
    textProperty: "Value",
    shownIn: always,
    placement: { horizontal: "start", vertical: "center", lines: "single" },
    textAttribute: () => "value",
  },
  iconsFor: () => [],
};

/** The denomination, the unit suffix after the value. */
const DENOMINATION: PartDefinition = {
  key: "denomination",
  slot: undefined,
  element: { tag: "div", attributes: { class: numberFieldVariants().denomination() } },
  shownIn: always,
  optional: { name: NUMBER_FIELD_DENOMINATION_PROPERTY, defaultValue: false },
  classesFor: (cell) => slots(cell).denomination(),
  label: {
    key: "text",
    name: "text",
    characters: NUMBER_FIELD_DENOMINATION,
    textProperty: "Unit",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The full-height row that holds the two steppers. */
const STEPPERS: PartDefinition = {
  key: "steppers",
  slot: undefined,
  element: { tag: "div", attributes: { class: numberFieldVariants().steppers() } },
  shownIn: always,
  classesFor: (cell) => slots(cell).steppers(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    stepper("decrease", false),
    stepper("decrease", true),
    stepper("increase", false),
    stepper("increase", true),
  ],
};

/** The group, the field box around the input, the denomination and the steppers. */
const GROUP: PartDefinition = {
  key: "group",
  slot: undefined,
  element: { tag: "div", attributes: { role: "group" } },
  shownIn: always,
  classesFor: (cell) => slots(cell).group(),
  label: undefined,
  iconsFor: () => [],
  parts: [INPUT, DENOMINATION, STEPPERS],
};

/** Base UI's NumberField root, a bare `<div>` around the group. */
const NUMBER_ROOT: PartDefinition = {
  key: "number-field",
  slot: undefined,
  shownIn: always,
  classesFor: () => "",
  elementDefaults: userAgentDisplay("div"),
  label: undefined,
  iconsFor: () => [],
  parts: [GROUP],
};

/** A number field, as `<NumberField label description defaultValue denomination?>`, read-only, disabled or invalid. */
export const NUMBER_FIELD: ComponentDefinition = {
  key: "number-field",
  name: "Number field",
  slot: "field",
  // The input takes the states, and Base UI mirrors them on the Field root as data attributes.
  rootKind: "native-control",
  statePartElement: INPUT_ELEMENT,
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [{ name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] }],
  columnAxis: "state",
  classesFor: () => cn(fieldVariants().root(), frame.root()),
  states: {
    disabled: FIELD_FRAME_DISABLED,
    // Base UI marks a read-only field's input `readonly` and `data-readonly`.
    readonly: ["[&[readonly]:not(:disabled)]", "data-readonly"],
  },
  // The group reads its input's states through `has-` variants, as Input group's root does.
  facts: new Map([
    ["has-[[data-focus-ring-control]:focus-visible]", (cell: Cell) => cell.state === "focus"],
    ["has-[>[data-focus-ring-control]:disabled]", (cell: Cell) => cell.state === "disabled"],
    ["has-[>[data-focus-ring-control][aria-invalid=true]]", (cell: Cell) => cell.state === "invalid"],
  ]),
  // A disabled input is natively disabled and never `aria-disabled`, the recipe's invalid focus ring
  // needs invalid and focus at once, which no cell draws, and `entry-floor:` raises the text for a
  // coarse pointer, where the kit draws a desktop.
  omittedStates: new Set([
    "aria-disabled",
    "entry-floor",
    "has-[>[data-focus-ring-control][aria-disabled=true]]",
    "has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]",
  ]),
  omittedCompositions: FIELD_FRAME_OMISSIONS,
  label: undefined,
  iconsFor: () => [],
  parts: [
    frameLabelRow(NUMBER_FIELD_LABEL, frame.labelRow()),
    NUMBER_ROOT,
    frameError(NUMBER_FIELD_ERROR),
    ...frameDescriptions(NUMBER_FIELD_DESCRIPTION),
  ],
  swapProperties: [],
};
