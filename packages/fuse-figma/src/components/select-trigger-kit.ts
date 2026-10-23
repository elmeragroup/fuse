/**
 * Select's trigger, as one component set: both sizes in four states, holding the placeholder or a
 * value, closed and open, 32 cells. The root is Base UI's `<button data-slot="select-trigger">`, a
 * native control, with the `trigger` slot of `selectTriggerVariants`. The popup and its rows wait
 * for the overlay sets.
 *
 * - The box draws the field box chrome: the field corner `radius-field-box`, a 1px `input` border,
 *   a `card` fill and `shadow-xs`, at the size's control height, inset and gap. It hugs the value and
 *   the caret and spaces them to its ends.
 * - The value is `Select.Value`'s `<span data-slot="select-value">`, a part that holds the text, one
 *   TEXT property, `Value`, that starts as the docs Basic demo's placeholder in every cell. The
 *   trigger's `*:data-[slot=select-value]:` classes make it a clipping flex row, whose `display: flex`
 *   replaces the `-webkit-box` of the `line-clamp-1` before it, so no line clamp applies. The trigger
 *   hugs the value, which then has no room to grow into or to cut its text off in.
 * - `content=placeholder` holds `data-placeholder`, which Base UI stamps on the trigger while nothing
 *   is selected, so the text paints `muted-foreground`. A value inherits the page's `foreground`, or
 *   the `error` an invalid Field root passes down through its `data-invalid:text-error`.
 * - The caret is CaretDown at 16px in `muted-foreground`. `open=on` holds `data-popup-open`, which
 *   Base UI stamps on the trigger while the popup is open, so the caret's
 *   `group-data-[popup-open]/select-trigger:rotate-180` turns it half a turn.
 * - Invalid draws the `error` border and ring of a trigger inside an invalid Field. Disabled dims to
 *   50% on the card fill. A disabled trigger is natively disabled, and Base UI never marks it
 *   `aria-disabled`, so no cell shows the state faces' `aria-disabled:` arms.
 */
import { selectTriggerVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, IconSlot, PartDefinition } from "./component-spec";
import { FIELD_ROOT, FIELD_ROOT_SR_ONLY, FIELD_ROOT_STRETCH, showsPlaceholder } from "./field-box-kit";

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

/** The recipe's slots at a cell's size. */
function slotsFor(cell: Cell) {
  return selectTriggerVariants({ size: sizeFor(cell) });
}

const always = (): boolean => true;

/** The value, `Select.Value`, which holds the placeholder or the selected item's label. */
const VALUE: PartDefinition = {
  key: "value",
  slot: "select-value",
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).value(),
  label: {
    key: "value",
    name: "value",
    characters: SELECT_TRIGGER_TEXT,
    textProperty: "Value",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The caret `Select.Icon` renders, CaretDown with its own classes, fixed, so no swap property picks it. */
function caret(cell: Cell): IconSlot {
  return {
    key: "caret",
    name: "Caret",
    side: "end",
    direct: true,
    dataIcon: undefined,
    icon: "CaretDown",
    swapProperty: undefined,
    classes: slotsFor(cell).caret(),
  };
}

/**
 * A trigger, as `<Select.Trigger size><Select.Value placeholder /></Select.Trigger>` in a
 * `Select.Root` that is disabled, holds a value or has its popup open, or inside an invalid
 * `Field.Root`.
 */
export const SELECT_TRIGGER: ComponentDefinition = {
  key: "select-trigger",
  name: "Select trigger",
  slot: "select-trigger",
  rootKind: "native-control",
  axes: [
    { name: "size", values: SIZES },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
    { name: "content", values: ["placeholder", "value"] },
    { name: "open", values: ["off", "on"] },
  ],
  columnAxis: "state",
  classesFor: (cell) => slotsFor(cell).trigger(),
  // Only an invalid cell puts the trigger in a Field root, the one source Base UI reads the trigger's
  // validity from.
  ancestorsFor: (cell) => (cell.state === "invalid" ? [FIELD_ROOT] : []),
  states: {},
  facts: new Map([
    ["data-placeholder", showsPlaceholder],
    ["group-data-[popup-open]/select-trigger", showsOpen],
    // Base UI stamps both of these on the trigger while the popup is open. No class of the trigger
    // reads them. The caret reads the first through its group variant above.
    ["data-popup-open", showsOpen],
    ["data-pressed", showsOpen],
  ]),
  omittedStates: new Set(["aria-disabled"]),
  omittedCompositions: new Map([
    FIELD_ROOT_SR_ONLY,
    [
      FIELD_ROOT_STRETCH,
      "the Field stretches the trigger across its own width, which the set does not draw, and the trigger hugs its value as it does outside a Field",
    ],
  ]),
  label: undefined,
  iconsFor: (cell) => [caret(cell)],
  parts: [VALUE],
  swapProperties: [],
};
