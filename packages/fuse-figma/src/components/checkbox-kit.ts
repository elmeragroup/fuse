/**
 * Checkbox, as one component set: off, on and mixed, in four states, with no label: 12 cells.
 *
 * - The root is Base UI's checkbox `<span data-slot="checkbox">`.
 * - The indicator, `<span data-slot="checkbox-indicator">`, is a part below the root. Base UI
 *   mounts it only while the box is checked or mixed, so the off cells have no layer inside the
 *   box. It holds `Check` when checked and `Minus` when mixed. The state picks the icon, so the set
 *   has no swap property.
 * - Invalid renders the checkbox in an invalid Field.
 */
import type { IconManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";

const checked = (cell: Cell): boolean => cell.checked === "on";
const mixed = (cell: Cell): boolean => cell.checked === "mixed";

/** The glyph the indicator holds, a child of it. Checkbox renders `Check` or `Minus` itself. */
function glyph(icon: "Check" | "Minus"): IconManifest {
  return {
    key: "icon",
    name: "Icon",
    side: "start",
    direct: true,
    dataIcon: undefined,
    icon,
    swapProperty: undefined,
  };
}

const CHECK = glyph("Check");
const MINUS = glyph("Minus");

/**
 * The checkbox's manifest, which the capture-backed build reads with `captures/checkbox.json`, as
 * `<Checkbox aria-label="Accept" />` with `defaultChecked` or `indeterminate` renders it.
 */
export const CHECKBOX_MANIFEST: SetManifest = {
  key: "checkbox",
  name: "Checkbox",
  slot: "checkbox",
  axes: [
    { name: "checked", values: ["off", "on", "mixed"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "indicator",
      slot: "checkbox-indicator",
      shownIn: (cell) => checked(cell) || mixed(cell),
      label: undefined,
      iconsFor: (cell) => [mixed(cell) ? MINUS : CHECK],
    },
  ],
  swapProperties: [],
};
