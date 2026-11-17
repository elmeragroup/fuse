/**
 * Switch, as one component set: two sizes, off and on, in four states, with no label: 16 cells.
 *
 * - The root is Base UI's switch `<span data-slot="switch">`, the track.
 * - The thumb, `<span data-slot="switch-thumb">`, is a part below the track, which Base UI mounts in
 *   every cell.
 * - Invalid renders the switch in an invalid Field.
 */
import { switchVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { SetManifest } from "../capture/manifest";
import { ownKey } from "./own-key";

type SwitchSize = keyof typeof switchVariants.variants.size;

/** Every size the recipe declares, in its order, the default first. */
const SIZES = Object.keys(switchVariants.variants.size).filter(isSize);

function isSize(value: string | undefined): value is SwitchSize {
  return ownKey(switchVariants.variants.size, value);
}

/**
 * The switch's manifest, which the capture-backed build reads with `captures/switch.json`, as
 * `<Switch aria-label="Notifications" />` with `size` and `defaultChecked` renders it.
 */
export const SWITCH_MANIFEST: SetManifest = {
  key: "switch",
  name: "Switch",
  slot: "switch",
  axes: [
    { name: "size", values: SIZES },
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [{ key: "thumb", slot: "switch-thumb", shownIn: () => true, label: undefined, iconsFor: () => [] }],
  swapProperties: [],
};
