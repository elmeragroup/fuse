/**
 * Separator, as one component set: a horizontal and a vertical line, 2 cells. A Separator is a
 * non-interactive `<div role="separator" data-slot="separator">`, so the set has no state axis, and
 * its columns are the orientations.
 *
 * The line takes its length from its container, and the kit draws no container, so each cell passes
 * the length a docs demo gives as consumer classes: 256px horizontal, as the `w-64` column demo, and
 * 16px vertical, as the header demo's `data-vertical:h-4 data-vertical:self-auto`.
 */
import type { SetManifest } from "../capture/manifest";

/** The docs demos' lengths, as consumer classes, which the compare renderer passes as `className`. */
export const DEMO_LENGTHS = "data-horizontal:w-64 data-vertical:h-4 data-vertical:self-auto";

/**
 * The separator's manifest, which the capture-backed build reads with `captures/separator.json`: a
 * separator, as `<Separator orientation={orientation} className={DEMO_LENGTHS} />`.
 */
export const SEPARATOR_MANIFEST: SetManifest = {
  key: "separator",
  name: "Separator",
  slot: "separator",
  axes: [{ name: "orientation", values: ["horizontal", "vertical"] }],
  columnAxis: "orientation",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};
