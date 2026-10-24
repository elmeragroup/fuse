/**
 * Kbd, as two component sets on one page.
 *
 * - `Kbd` is a key cap that holds a label or one icon: 2 cells. The recipe declares no axes, so the
 *   set's one property is what the cap holds, `content`, which is also its column axis. The cap is
 *   the recipe's `cap` slot, a 20px `<kbd data-slot="kbd">` with a muted fill and a border hairline.
 *   It reads no density metric. The text cap holds the `Label` text, `K` by default, as the docs
 *   demos place `Ctrl`, `K` or `Enter`. The icon cap holds one icon at the cap's 12px icon size,
 *   picked by `Icon`. `tabular-nums` has no Figma form, so the label keeps the font's default
 *   numerals.
 * - `Kbd group` is the docs Combination demo's first combination, `Ctrl` and `K`: 1 cell. The
 *   group's `group` slot lays the caps out in a row 4px apart, each an instance of the text cap.
 *   Its `*:data-[slot=kbd]:rounded-[inherit]` gives each cap the group's `rounded-sm`, the cap's own
 *   corner, so each instance draws its variant as it is.
 */
import { kbdVariants } from "@elmeragroup/fuse/recipe-catalog";

import { swapProperties } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot, InstanceDefinition } from "./component-spec";

const { cap, group } = kbdVariants();
const CAP = cap();

/** Backspace, a roster icon that reads as a key. The roster has no Command icon. */
const ICON: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Backspace",
  swapProperty: "Icon",
};

const holdsIcon = (cell: Cell): boolean => cell.content === "icon";

/**
 * The label of the text cap, the default of the `Label` text property. The compare renderer
 * renders the same text.
 */
export const KBD_LABEL = "K";

/** A key cap, as `<Kbd>K</Kbd>`, or around one icon, as `<Kbd><Backspace /></Kbd>`. */
export const KBD: ComponentDefinition = {
  key: "kbd",
  name: "Kbd",
  slot: "kbd",
  axes: [{ name: "content", values: ["text", "icon"] }],
  columnAxis: "content",
  classesFor: () => CAP,
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: {
    key: "label",
    name: "label",
    characters: KBD_LABEL,
    textProperty: "Label",
    shownIn: (cell) => !holdsIcon(cell),
  },
  iconsFor: (cell) => (holdsIcon(cell) ? [ICON] : []),
  swapProperties: swapProperties([ICON]),
};

/**
 * The modifier of the group's combination, the first cap of the docs Combination demo. The second
 * cap shows the text cap's own label, {@link KBD_LABEL}. The compare renderer renders both.
 */
export const KBD_GROUP_MODIFIER = "Ctrl";

/**
 * A text cap in the group, exposed, so a designer retypes its label from the group's panel.
 *
 * @param key - The instance's key.
 * @param label - The cap's label, which the `Label` property sets where it is not the text cap's own.
 */
function capOf(key: string, label: string): InstanceDefinition {
  return {
    kind: "instance",
    key,
    of: KBD,
    cell: () => ({ content: "text" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: () => true,
    exposed: true,
  };
}

/**
 * A key combination, as `<KbdGroup><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>`. The recipe declares no
 * axes, so the set's one property, `keys`, names the two caps the combination holds.
 */
export const KBD_GROUP: ComponentDefinition = {
  key: "kbd-group",
  name: "Kbd group",
  slot: "kbd-group",
  axes: [{ name: "keys", values: ["2"] }],
  columnAxis: "keys",
  classesFor: () => group(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [capOf("modifier", KBD_GROUP_MODIFIER), capOf("key", KBD_LABEL)],
  swapProperties: [],
};
