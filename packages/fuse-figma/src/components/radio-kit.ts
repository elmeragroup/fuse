/**
 * Radio, as one component set: off and on, in four states, with no label: 8 cells.
 *
 * - The root is Base UI's radio `<span data-slot="radio-group-item">`, which renders checked only
 *   inside a `RadioGroup`.
 * - The indicator, `<span data-slot="radio-group-indicator">`, is a part below the root that holds
 *   the dot. Base UI mounts it only while the radio is checked, so the off cells have no layer inside
 *   the circle.
 * - The dot has no `data-slot`, so the manifest finds it by its place, and its layer takes its key as
 *   its name.
 * - Invalid renders the radio in an invalid `RadioGroup`.
 */
import type { SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";

const checked = (cell: Cell): boolean => cell.checked === "on";

/**
 * The radio's manifest, which the capture-backed build reads with `captures/radio.json`, as
 * `<RadioGroupItem value="a" aria-label="Option" />` inside a `RadioGroup` renders it: the
 * indicator, and the dot at its first place, which carries no `data-slot`.
 */
export const RADIO_MANIFEST: SetManifest = {
  key: "radio",
  name: "Radio",
  slot: "radio-group-item",
  axes: [
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "indicator",
      slot: "radio-group-indicator",
      shownIn: checked,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "dot",
          slot: undefined,
          place: "radio-group-indicator/0",
          shownIn: () => true,
          label: undefined,
          iconsFor: () => [],
        },
      ],
    },
  ],
  swapProperties: [],
};
