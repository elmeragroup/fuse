/**
 * Radio group, as one component set on the Radio page: `RadioGroup` with a legend, a description
 * and three rows, the docs Basic demo's `Contract` options with `Fixed` selected, vertical and
 * horizontal, at rest, disabled and invalid: 6 cells. The root is the `Field.Root`, Base UI's
 * `<div data-slot="field">`, around FieldFrame's legend mode: a `Field.Set`, the `<fieldset
 * data-slot="field-set">`, whose parts sit `surface-gap-md` apart, closer than its own gap, since it
 * holds a radio group.
 *
 * - The heading row is FieldFrame's label row holding a `Field legend` instance at its `label`
 *   variant, `Contract`. A described legend gives up its bottom margin.
 * - The description, a `Field description` instance, sits under the legend, its negative top margin
 *   cancelling the fieldset's gap above it.
 * - The group primitive, `<div data-slot="radio-group">`, stacks the rows `surface-gap-sm` apart when
 *   vertical and lays them in a row `surface-gap-lg` apart when horizontal. Each row is a `Radio row`
 *   instance in the cell's state, the first checked.
 * - The invalid cells add a `Field error` instance after the group, with the docs Pending demo's
 *   message. An invalid Field passes its `data-invalid:text-error` to the legend.
 * - The description and the error, and the states Base UI stamps on the description, come from
 *   `field-frame-kit.ts`.
 * - `RadioItemGroup`, the stacked-card variant, is left out.
 */
import {
  fieldFrameVariants,
  fieldVariants,
  selectionGroupOrientationVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import {
  FIELD_FRAME_DISABLED,
  FIELD_FRAME_OMISSIONS,
  frameDescriptions,
  frameError,
} from "./field-frame-kit";
import { FIELD_LEGEND } from "./field-text-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";
import { RADIO_ROW } from "./radio-row-kit";

/** The legend: the docs Basic demo's. */
export const RADIO_GROUP_LEGEND = "Contract";

/** The rows' labels, the first selected: the docs Basic demo's options. */
export const RADIO_GROUP_OPTIONS = ["Fixed", "Spot", "Hourly"] as const;

/** The description: the docs Pending demo's, which fits either orientation. */
export const RADIO_GROUP_DESCRIPTION = "Plans load before a selection can be made.";

/** The error the invalid cells show: the docs Pending demo's message. */
export const RADIO_GROUP_ERROR = "Pick a contract.";

/** The orientations, `RadioGroup`'s default first. */
const ORIENTATIONS = ["vertical", "horizontal"] as const;

/** An orientation, as `RadioGroup` takes it. */
type Orientation = (typeof ORIENTATIONS)[number];

/**
 * A cell's orientation.
 *
 * @param cell - A `radio-group` cell.
 * @returns The orientation its `orientation` names.
 * @throws When the cell names no orientation the set declares, a defect in the caller's cell.
 */
export function orientationFor(cell: Cell): Orientation {
  const orientation = ORIENTATIONS.find((candidate) => candidate === cell.orientation);
  if (orientation === undefined) {
    throw new Error(`Radio group has no orientation ${cell.orientation ?? ""}`);
  }
  return orientation;
}

/** FieldFrame's slots for a described legend. */
const legendFrame = fieldFrameVariants({ legendDescription: true });

/** The legend row: FieldFrame's label row around a `Field legend` instance. */
const LEGEND_ROW: PartDefinition = {
  key: "legend-row",
  slot: undefined,
  element: { tag: "div", attributes: { class: fieldFrameVariants().labelRow() } },
  shownIn: always,
  classesFor: () => fieldFrameVariants().labelRow(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "legend",
      of: FIELD_LEGEND,
      cell: () => ({ variant: "label" }),
      classesFor: () => legendFrame.label(),
      properties: () => ({ text: { Text: RADIO_GROUP_LEGEND } }),
      shownIn: always,
      exposed: true,
    },
  ],
};

/** A row, a `Radio row` instance in the group's state, the first checked. */
function row(label: string, index: number): InstanceDefinition {
  return {
    kind: "instance",
    key: `row-${index + 1}`,
    of: RADIO_ROW,
    // A vertical group stretches its rows across its width, and a horizontal one hugs them.
    cell: (outer) => ({
      width: orientationFor(outer) === "vertical" ? "fill" : "hug",
      checked: index === 0 ? "on" : "off",
      state: outer.state ?? "rest",
    }),
    properties: () => ({ text: { Label: label } }),
    shownIn: always,
    exposed: true,
  };
}

/** The group primitive, which lays the rows out by the cell's orientation. */
const GROUP: PartDefinition = {
  key: "group",
  slot: "radio-group",
  shownIn: always,
  classesFor: (cell) => selectionGroupOrientationVariants({ orientation: orientationFor(cell) }).group(),
  fitsOneLine:
    "Chromium measured the three rows of a horizontal group end at 201px dense and 217px comfortable in its 384px on 2026-10-27, so they never wrap",
  label: undefined,
  iconsFor: () => [],
  parts: RADIO_GROUP_OPTIONS.map(row),
};

/** The `Field.Set` that FieldFrame's legend mode wraps its parts in. */
const FIELD_SET: PartDefinition = {
  key: "field-set",
  slot: "field-set",
  shownIn: always,
  classesFor: () => fieldVariants().set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    LEGEND_ROW,
    ...frameDescriptions(RADIO_GROUP_DESCRIPTION, legendFrame.description()),
    GROUP,
    frameError(RADIO_GROUP_ERROR),
  ],
};

/**
 * A radio group, as `<RadioGroup label description orientation defaultValue>` around three
 * `<Radio>` rows, disabled, or invalid with an error message.
 */
export const RADIO_GROUP: ComponentDefinition = {
  key: "radio-group",
  name: "Radio group",
  slot: "field",
  // The radios take the states, and Base UI mirrors them on the Field root as data attributes.
  rootKind: "base-ui-field-part",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "orientation", values: ORIENTATIONS },
    { name: "state", values: ["rest", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: () => fieldVariants().root(),
  states: { disabled: FIELD_FRAME_DISABLED },
  facts: new Map([
    // The Field root is vertical in every cell, whatever the group's own orientation.
    ["data-vertical", always],
    ["data-horizontal", () => false],
    // The fieldset holds the radio group, which holds rows, no selection cards.
    ["has-[>[data-slot=radio-group]]", always],
    ["has-[>[data-slot=checkbox-group]]", () => false],
    ["has-[>[data-selection-item]]", () => false],
  ]),
  omittedStates: new Set(),
  omittedCompositions: FIELD_FRAME_OMISSIONS,
  label: undefined,
  iconsFor: () => [],
  parts: [FIELD_SET],
  swapProperties: [],
};
