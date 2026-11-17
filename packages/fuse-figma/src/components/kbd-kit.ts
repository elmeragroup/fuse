/**
 * Kbd, as two component sets on one page.
 *
 * - `Kbd` is a key cap that holds a label or one icon: 2 cells. The recipe declares no axes, so the
 *   set's one property is what the cap holds, `content`, which is also its column axis. The cap is
 *   a `<kbd data-slot="kbd">`. The text cap holds the `Label` text, `K` by default, as the docs
 *   demos place `Ctrl`, `K` or `Enter`. The icon cap holds one icon, picked by `Icon`.
 * - `Kbd group` is the docs Combination demo's first combination, `Ctrl` and `K`: 1 cell. Each cap
 *   in the group is an instance of the text cap.
 */
import type { IconManifest, InstanceManifest, SetManifest } from "../capture/manifest";
import { swapProperties } from "./component-spec";
import type { Cell } from "./component-spec";

/** Backspace, a roster icon that reads as a key. The roster has no Command icon. */
const ICON: IconManifest = {
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

/**
 * The cap's manifest, which the capture-backed build reads with `captures/kbd.json`: a key cap, as
 * `<Kbd>K</Kbd>`, or around one icon, as `<Kbd><Backspace /></Kbd>`.
 */
export const KBD_MANIFEST: SetManifest = {
  key: "kbd",
  name: "Kbd",
  slot: "kbd",
  axes: [{ name: "content", values: ["text", "icon"] }],
  columnAxis: "content",
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
function capManifest(key: string, label: string): InstanceManifest {
  return {
    kind: "instance",
    key,
    of: KBD_MANIFEST,
    cell: () => ({ content: "text" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: () => true,
    exposed: true,
  };
}

/**
 * The group's manifest, which the capture-backed build reads with `captures/kbd-group.json`: a key
 * combination, as `<KbdGroup><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>`. The recipe declares no axes,
 * so the set's one property, `keys`, names the two caps the combination holds.
 */
export const KBD_GROUP_MANIFEST: SetManifest = {
  key: "kbd-group",
  name: "Kbd group",
  slot: "kbd-group",
  axes: [{ name: "keys", values: ["2"] }],
  columnAxis: "keys",
  label: undefined,
  iconsFor: () => [],
  parts: [capManifest("modifier", KBD_GROUP_MODIFIER), capManifest("key", KBD_LABEL)],
  swapProperties: [],
};
