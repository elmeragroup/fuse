/**
 * Radio group, as one component set on the Radio page: `RadioGroup` with a legend, a description
 * and three rows, the docs Basic demo's `Contract` options with `Fixed` selected, vertical and
 * horizontal, at rest, disabled and invalid: 6 cells. The root is the `Field.Root`, Base UI's
 * `<div data-slot="field">`, around FieldFrame's legend mode: a `Field.Set`, the `<fieldset
 * data-slot="field-set">`.
 *
 * - The heading row is FieldFrame's label row holding a `Field legend` instance at its `label`
 *   variant, `Contract`.
 * - The description, a `Field description` instance, sits under the legend, in a gapless frame with
 *   the legend row (W5-P5).
 * - The group primitive, `<div data-slot="radio-group">`, stacks the rows when vertical and lays them
 *   in a row when horizontal. Each row is a `Radio row` instance in the cell's state, the first
 *   checked. Chromium measured the three rows of a horizontal group end at 201px dense and 217px
 *   comfortable in its 384px on 2026-10-27, so they never wrap, and a real file drew them packed
 *   left with no wrap (W5-P6).
 * - The invalid cells add a `Field error` instance after the group, with the docs Pending demo's
 *   message.
 * - The description and the error, and the states Base UI stamps on the description, come from
 *   `field-frame-kit.ts`.
 * - `RadioItemGroup`, the stacked-card variant, is left out.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { frameDescriptionsManifest, frameErrorManifest } from "./field-frame-kit";
import { FIELD_LEGEND_MANIFEST } from "./field-text-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";
import { RADIO_ROW_MANIFEST } from "./radio-row-kit";

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

/**
 * A row's cell: a vertical group stretches its rows across its width and a horizontal one hugs
 * them, the first checked, in the group's state.
 */
function rowCell(index: number, outer: Cell): Cell {
  return {
    width: orientationFor(outer) === "vertical" ? "fill" : "hug",
    checked: index === 0 ? "on" : "off",
    state: outer.state ?? "rest",
  };
}

/** A row, a `Radio row` instance in the group's state, the first checked. */
function rowManifest(label: string, index: number): InstanceManifest {
  return {
    kind: "instance",
    key: `row-${index + 1}`,
    of: RADIO_ROW_MANIFEST,
    cell: (outer) => rowCell(index, outer),
    properties: () => ({ text: { Label: label } }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * The radio group's manifest, which the capture-backed build reads with `captures/radio-group.json`,
 * as `<RadioGroup label description orientation defaultValue>` around three `<Radio>` rows renders
 * it, disabled, or invalid with an error message: the fieldset around the legend row, the
 * descriptions, the group primitive and the error.
 */
export const RADIO_GROUP_MANIFEST: SetManifest = {
  key: "radio-group",
  name: "Radio group",
  slot: "field",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "orientation", values: ORIENTATIONS },
    { name: "state", values: ["rest", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "field-set",
      slot: "field-set",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "legend-row",
          slot: undefined,
          place: "field-set/0",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              kind: "instance",
              key: "legend",
              of: FIELD_LEGEND_MANIFEST,
              cell: () => ({ variant: "label" }),
              properties: () => ({ text: { Text: RADIO_GROUP_LEGEND } }),
              shownIn: always,
              exposed: true,
            },
          ],
        },
        // The descriptions sit under the legend, and the error after the group.
        ...frameDescriptionsManifest(RADIO_GROUP_DESCRIPTION),
        {
          key: "group",
          slot: "radio-group",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: RADIO_GROUP_OPTIONS.map(rowManifest),
        },
        frameErrorManifest(RADIO_GROUP_ERROR),
      ],
    },
  ],
  swapProperties: [],
};
