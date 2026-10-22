/**
 * Loader, as one component set: the spinner at each of its five sizes, 5 cells. A Loader is a
 * `<div data-slot="loader" role="status">` around a decorative `SpinnerGap`, so the set has no
 * state axis, and its columns are the sizes.
 *
 * - The recipe's `base` pads the box by 16px on every side and centers the spinner, so each box
 *   is the spinner's size plus 32px.
 * - The size sits on the `<svg>` itself, in the recipe's `icon` slot, so the spinner carries
 *   those classes as its own. Its `animate-spin` drops, as Figma components do not animate.
 * - The visually hidden label the Loader announces is not drawn.
 */
import { loaderVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";
import { ownKey } from "./own-key";

type LoaderSize = keyof typeof loaderVariants.variants.size;

/** Every size the recipe declares, in its order, with its default first. */
const SIZES = Object.keys(loaderVariants.variants.size).filter(isSize);

function isSize(value: string | undefined): value is LoaderSize {
  return ownKey(loaderVariants.variants.size, value);
}

function recipeFor(cell: Cell): ReturnType<typeof loaderVariants> {
  const { size } = cell;
  if (!isSize(size)) {
    throw new Error(`Loader has no size ${size ?? ""}`);
  }
  return loaderVariants({ size });
}

/** The spinner, a direct `<svg>` child of the box, at the cell's size. */
function spinner(cell: Cell): IconSlot {
  return {
    key: "spinner",
    name: "Spinner",
    side: "start",
    direct: true,
    dataIcon: undefined,
    icon: "SpinnerGap",
    swapProperty: undefined,
    classes: recipeFor(cell).icon(),
  };
}

/** A loader, as `<Loader size={size} aria-label="Loading" />`. */
export const LOADER: ComponentDefinition = {
  key: "loader",
  name: "Loader",
  slot: "loader",
  axes: [{ name: "size", values: SIZES }],
  columnAxis: "size",
  classesFor: (cell) => recipeFor(cell).base(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: (cell) => [spinner(cell)],
  swapProperties: [],
};
