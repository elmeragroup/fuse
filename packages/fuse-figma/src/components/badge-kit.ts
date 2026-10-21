/**
 * Badge, as one component set: every variant of the recipe at its three sizes, 57 cells. A Badge
 * is a non-interactive `<div data-slot="badge">`, so the set has no state axis, and its columns
 * are the sizes.
 *
 * - Every variant draws the base's 1px border. Most color it, transparent on the filled ones,
 *   and `outline` leaves it to the base layer of `fuse.css`, which gives it the `border` role.
 * - The `soft-*` variants stroke with their role at 20%, the synced `/20` tints.
 * - The label is the root's own text, as every docs demo passes it, and no cell has an icon.
 */
import { badgeVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition } from "./component-spec";
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

function isSize(value: string | undefined): value is BadgeSize {
  return ownKey(badgeVariants.variants.size, value);
}

function classesFor(cell: Cell): string {
  const { variant, size } = cell;
  if (!isVariant(variant) || !isSize(size)) {
    throw new Error(`Badge has no variant ${variant ?? ""} or size ${size ?? ""}`);
  }
  return badgeVariants({ variant, size });
}

/** A Badge with a label, as `<Badge>Badge</Badge>`. */
export const BADGE: ComponentDefinition = {
  key: "badge",
  name: "Badge",
  slot: "badge",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: SIZES },
  ],
  columnAxis: "size",
  classesFor,
  states: {},
  facts: new Map(),
  // `[&>span]` styles a span child, which a consumer may wrap the label in. The kit's label is
  // the root's own text, so no cell has that span, and the root's own `text-*` and the base's
  // `font-medium` set the same type.
  omittedStates: new Set(["[&>span]"]),
  label: { key: "label", name: "label", characters: "Badge", textProperty: "Label", shownIn: () => true },
  iconsFor: () => [],
  swapProperties: [],
};
