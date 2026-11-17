/**
 * Badge, as one component set: every variant of the recipe at its three sizes, 57 cells. A Badge
 * is a non-interactive `<span data-slot="badge">`, so the set has no state axis, and its columns
 * are the sizes. The label is the root's own text, as every docs demo passes it, and no cell has an
 * icon.
 */
import { badgeVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { SetManifest } from "../capture/manifest";
import { ownKey } from "./own-key";

type BadgeVariant = keyof typeof badgeVariants.variants.variant;
type BadgeSize = keyof typeof badgeVariants.variants.size;

/** Every variant the recipe declares, in its order, so a new variant reaches Figma too. */
const VARIANTS = Object.keys(badgeVariants.variants.variant).filter(isVariant);

/** The sizes with the recipe's default first, the Badge `<Badge>` renders. */
const SIZES = ["default", "sm", "lg"] as const satisfies readonly BadgeSize[];

function isVariant(value: string | undefined): value is BadgeVariant {
  return ownKey(badgeVariants.variants.variant, value);
}

/**
 * The label every cell shows, the default of the `Label` text property. The compare renderer
 * renders the same text.
 */
export const BADGE_LABEL = "Badge";

/**
 * The Badge's manifest, which the capture-backed build reads with `captures/badge.json`: a Badge
 * with a label, as `<Badge>Badge</Badge>`.
 */
export const BADGE_MANIFEST: SetManifest = {
  key: "badge",
  name: "Badge",
  slot: "badge",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: SIZES },
  ],
  columnAxis: "size",
  label: {
    key: "label",
    name: "label",
    characters: BADGE_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};
