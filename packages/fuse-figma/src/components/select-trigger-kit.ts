/**
 * Select's trigger, as one component set: hugging its value or filling its container, both sizes in
 * four states, holding the placeholder or a value, closed and open, 64 cells. The root is Base UI's
 * `<button data-slot="select-trigger">`, a native control. The popup and its rows wait for the
 * overlay sets.
 *
 * - `width=hug` hugs the value and the caret. `width=fill` fills the 384px preview width the kit
 *   gives a field box, as SelectField passes the trigger `w-full`. A composite that fills its
 *   trigger, such as Select field, shows this variant, since an instance cannot change its inner
 *   root's packing or its parts' sizing. The set gained the axis after its first release, so a
 *   hugging cell keeps the key it had, and the plugin renames the variant in place (W5-P2).
 * - The value is `Select.Value`'s `<span data-slot="select-value">`, a part that holds the text, one
 *   TEXT property, `Value`, that starts as the docs Basic demo's placeholder in every cell.
 * - `content=placeholder` renders the trigger with nothing selected, and `content=value` with a
 *   selection.
 * - The caret is a fixed CaretDown at the trigger's end. `open=on` renders the trigger with its popup
 *   open, where the caret turns half a turn.
 * - Only an invalid cell renders the trigger in a Field, the one source Base UI reads its validity
 *   from.
 */
import type { IconManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { HUG_OR_FILL } from "./field-box-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";

/** The text every cell shows, the default of the `Value` property: the docs Basic demo's placeholder. */
export const SELECT_TRIGGER_TEXT = "Pick a fruit";

/** The sizes `selectTriggerVariants` declares, its default first. */
const SIZES = ["default", "sm"] as const;

/** A trigger size, as `Select.Trigger` takes it. */
type SelectTriggerSize = (typeof SIZES)[number];

/**
 * A cell's size.
 *
 * @param cell - A `select-trigger` cell.
 * @returns The size its `size` names.
 * @throws When the cell names no size the set declares, a defect in the caller's cell.
 */
export function sizeFor(cell: Cell): SelectTriggerSize {
  const size = SIZES.find((candidate) => candidate === cell.size);
  if (size === undefined) {
    throw new Error(`Select trigger has no size ${cell.size ?? ""}`);
  }
  return size;
}

/**
 * Whether a cell shows the trigger with its popup open.
 *
 * @param cell - A `select-trigger` cell.
 * @returns True at `open=on`.
 */
export function showsOpen(cell: Cell): boolean {
  return cell.open === "on";
}

/** The caret `Select.Icon` renders at the trigger's end, CaretDown, fixed, so no swap property picks it. */
const CARET: IconManifest = {
  key: "caret",
  name: "Caret",
  side: "end",
  direct: true,
  dataIcon: undefined,
  icon: "CaretDown",
  swapProperty: undefined,
};

/**
 * The trigger's manifest, which the capture-backed build reads with `captures/select-trigger.json`,
 * as `<Select.Trigger size><Select.Value placeholder /></Select.Trigger>` renders it in a
 * `Select.Root` that is disabled, holds a value or has its popup open, or inside an invalid
 * `Field.Root`.
 */
export const SELECT_TRIGGER_MANIFEST: SetManifest = {
  key: "select-trigger",
  name: "Select trigger",
  slot: "select-trigger",
  // The width a filling trigger takes. A hugging trigger reads none of it.
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  // The width axis came after the set's first release, so a hugging cell keeps the key it had then
  // (W5-P2).
  addedAxes: new Set(["width"]),
  axes: [
    { name: "width", values: HUG_OR_FILL },
    { name: "size", values: SIZES },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
    { name: "content", values: ["placeholder", "value"] },
    { name: "open", values: ["off", "on"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [CARET],
  parts: [
    {
      key: "value",
      slot: "select-value",
      shownIn: always,
      label: {
        key: "value",
        name: "value",
        characters: SELECT_TRIGGER_TEXT,
        textProperty: "Value",
        shownIn: always,
      },
      iconsFor: () => [],
    },
  ],
  swapProperties: [],
};
