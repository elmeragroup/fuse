/**
 * Checkbox, as one component set: unchecked, checked and indeterminate, in four states, with no
 * label: 12 cells. `checked` and `indeterminate` are its props, and the set holds no cell with both,
 * which draws as indeterminate.
 *
 * - The root is Base UI's checkbox `<span data-slot="checkbox">`.
 * - The indicator, `<span data-slot="checkbox-indicator">`, is a part below the root. Base UI
 *   mounts it only while the box is checked or indeterminate, so the unchecked cells have no layer
 *   inside the box. It holds `Check` when checked and `Minus` when indeterminate. The state picks the icon, so the set
 *   has no swap property.
 * - Invalid renders the checkbox in an invalid Field.
 */
import type { IconManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";

const checked = (cell: Cell): boolean => cell.checked === "true";
const mixed = (cell: Cell): boolean => cell.indeterminate === "true";

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
  api: { page: "checkbox", parts: ["Checkbox"] },
  slot: "checkbox",
  axes: [
    { name: "checked", values: ["false", "true"] },
    { name: "indeterminate", values: ["false", "true"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  impossible: [
    {
      where: { checked: "true", indeterminate: "true" },
      fact: 'Base UI\'s Checkbox.Root reads `indeterminate` first: it sets `aria-checked="mixed"` and drops `data-checked` while indeterminate (`getCheckboxStateAttributesMapping`), so a checked indeterminate box draws as an unchecked indeterminate one.',
    },
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
