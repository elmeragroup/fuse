/**
 * Number field, as two component sets on a page of their own: the stepper, and `NumberField` with
 * the docs Basic demo's label and description in five states.
 *
 * - `Number field stepper` is the increase stepper, Base UI's increment `<button>` that Fuse stamps
 *   `data-slot="number-field-increment"`, at rest, hovered, disabled and read-only: 4 cells. It
 *   holds a glyph, Plus, that its `Icon` swap property picks. A read-only field's stepper stays
 *   enabled, so it draws as at rest. Its height is the group's content height, which the elements
 *   around it in the capture set. In Number field the instance fills the group at each density.
 * - `Number field` holds the Field root: the heading row with a `Label` instance, then Base UI's
 *   NumberField root around the group, the field box that holds the value, the optional
 *   denomination and the two steppers, then the error in an invalid Field and the description. The
 *   value is the input's own text, `4`, which the `Value` text property sets. The denomination,
 *   `kWh`, sits behind the `Denomination` BOOLEAN, which starts off, as the Basic demo sets none.
 *   The input takes the field's states.
 * - Base UI's NumberField parts carry no `data-slot`, so the manifest names each part by its place,
 *   except the steppers, which Fuse stamps `number-field-decrement` and `number-field-increment`.
 */
import type { IconManifest, InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import { swapProperties } from "./component-spec";
import { frameLabelRowManifest, frameMessagesManifest, isInvalid } from "./field-frame-kit";
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

/** The stepper's glyph, a direct `<svg>`, which the `Icon` property swaps. */
const GLYPH_MANIFEST: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Plus",
  swapProperty: "Icon",
};

/**
 * The stepper's manifest, which the capture-backed build reads with
 * `captures/number-field-stepper.json`: the increase `<button>` and its glyph. Its height is the
 * group's content height, which the elements around it in the capture set. The decrease instance's
 * `Icon` swap to Minus holds in Number field's main and in an instance of it (W5-P8).
 */
export const NUMBER_FIELD_STEPPER_MANIFEST: SetManifest = {
  key: "number-field-stepper",
  name: "Number field stepper",
  slot: "number-field-stepper",
  elementSlot: () => "number-field-increment",
  axes: [{ name: "state", values: ["rest", "hover", "disabled", "readonly"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [GLYPH_MANIFEST],
  swapProperties: swapProperties([GLYPH_MANIFEST]),
};

/**
 * A stepper instance as the manifest names it, by the `data-slot` Fuse stamps on its `<button>`: the
 * decrease stepper with Minus or the increase stepper with Plus. An invalid field stamps
 * `data-invalid` on its steppers, so the invalid cells hold their own instances. A disabled field
 * disables its steppers, and a read-only one marks them read-only.
 */
function stepperManifest(direction: "decrease" | "increase", invalid: boolean): InstanceManifest {
  return {
    kind: "instance",
    key: invalid ? `${direction}-invalid` : direction,
    of: NUMBER_FIELD_STEPPER_MANIFEST,
    slot: `number-field-${direction === "decrease" ? "decrement" : "increment"}`,
    cell: (outer) => ({
      state: outer.state === "disabled" || outer.state === "readonly" ? outer.state : "rest",
    }),
    properties: () => ({ swap: { Icon: direction === "decrease" ? "Minus" : "Plus" } }),
    shownIn: (cell) => isInvalid(cell) === invalid,
  };
}

/** The group as the manifest names it: the input, the denomination and the steppers' row, by place. */
const GROUP_MANIFEST: PartManifest = {
  key: "group",
  slot: undefined,
  place: "field/1/0",
  shownIn: always,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "input",
      slot: undefined,
      place: "field/1/0/0",
      shownIn: always,
      label: {
        key: "text",
        name: "text",
        characters: String(NUMBER_FIELD_VALUE),
        textProperty: "Value",
        shownIn: always,
        textAttribute: () => "value",
      },
      iconsFor: () => [],
    },
    {
      key: "denomination",
      slot: undefined,
      place: "field/1/0/1",
      shownIn: always,
      optional: { name: NUMBER_FIELD_DENOMINATION_PROPERTY, defaultValue: false },
      label: {
        key: "text",
        name: "text",
        characters: NUMBER_FIELD_DENOMINATION,
        textProperty: "Unit",
        shownIn: always,
      },
      iconsFor: () => [],
    },
    {
      key: "steppers",
      slot: undefined,
      place: "field/1/0/2",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        stepperManifest("decrease", false),
        stepperManifest("decrease", true),
        stepperManifest("increase", false),
        stepperManifest("increase", true),
      ],
    },
  ],
};

/**
 * The Number field's manifest, which the capture-backed build reads with
 * `captures/number-field.json`: the label row, Base UI's NumberField root around the group, then the
 * error and the description. The input takes the states.
 */
export const NUMBER_FIELD_MANIFEST: SetManifest = {
  key: "number-field",
  name: "Number field",
  slot: "field",
  statePlace: "field/1/0/0",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [{ name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
  parts: [
    frameLabelRowManifest(NUMBER_FIELD_LABEL, "field/0"),
    {
      key: "number-field",
      slot: undefined,
      place: "field/1",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [GROUP_MANIFEST],
    },
    ...frameMessagesManifest(NUMBER_FIELD_ERROR, NUMBER_FIELD_DESCRIPTION),
  ],
};
