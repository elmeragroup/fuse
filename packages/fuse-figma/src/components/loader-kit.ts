/**
 * Loader, as one component set: the spinner at each of its five sizes, 5 cells. A Loader is a
 * `<div data-slot="loader" role="status">` around a decorative `SpinnerGap`, so the set has no
 * state axis, and its columns are the sizes. The visually hidden label the Loader announces is not
 * drawn.
 */
import { loaderVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, SetManifest } from "../capture/manifest";
import { ownKey } from "./own-key";

type LoaderSize = keyof typeof loaderVariants.variants.size;

/** Every size the recipe declares, in its order, with its default first. */
const SIZES = Object.keys(loaderVariants.variants.size).filter(isSize);

function isSize(value: string | undefined): value is LoaderSize {
  return ownKey(loaderVariants.variants.size, value);
}

/** The spinner, a direct `<svg>` child of the box, as a manifest names it. */
const SPINNER: IconManifest = {
  key: "spinner",
  name: "Spinner",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "SpinnerGap",
  swapProperty: undefined,
};

/**
 * The loader's manifest, which the capture-backed build reads with `captures/loader.json`: a
 * loader, as `<Loader size={size} aria-label="Loading" />`.
 */
export const LOADER_MANIFEST: SetManifest = {
  key: "loader",
  name: "Loader",
  slot: "loader",
  axes: [{ name: "size", values: SIZES }],
  columnAxis: "size",
  label: undefined,
  iconsFor: () => [SPINNER],
  swapProperties: [],
};
