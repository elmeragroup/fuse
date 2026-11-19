/**
 * Aspect ratio, as one component set on the Aspect ratio page: one cell per `ratio`, 7 cells, each
 * at the width its docs demo gives it.
 *
 * - The root is a `<div data-slot="aspect-ratio">`, in a 448px host, the widest demo's `max-w-md`.
 *   Each demo's `w-full` and `max-w-*` classes set the frame's width, and the ratio sets its height,
 *   which the build draws as a fixed height where the capture measured it, with Figma's aspect lock
 *   at that ratio.
 * - The frame holds an `<img>` with the demos' `size-full rounded-lg object-cover`, which shows the
 *   kit's portrait as an image paint. A designer replaces the picture by changing that fill on an
 *   instance.
 *
 * The set draws no custom ratio, which a consumer's `aspect-[7/5]` class sets.
 */
// Fuse's aspect ratio subpath resolves its types to TSX source, and this package's type check
// compiles no JSX. The type comes from Fuse's build instead, as the compare renderers take theirs.
import type { AspectRatioValue } from "../../../fuse/dist/aspect-ratio.js";
import type { SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";
import { portraitPng } from "./portrait";

/** The width of the host the frame renders in: the docs default demo's `max-w-md`. */
export const ASPECT_RATIO_PREVIEW_WIDTH = 448;

/**
 * The classes each docs demo gives its frame, by its `ratio`, in the docs page's order: the default
 * demo's 16:9 first, then the examples.
 */
export const RATIO_CLASSES: ReadonlyMap<AspectRatioValue, string> = new Map<AspectRatioValue, string>([
  ["16:9", "w-full max-w-md"],
  ["1:1", "w-full max-w-60"],
  ["4:3", "w-full max-w-sm"],
  ["3:4", "w-full max-w-60"],
  ["3:2", "w-full max-w-sm"],
  ["2:3", "w-full max-w-52"],
  ["9:16", "w-full max-w-44"],
]);

/** A cell's ratio and the classes its docs demo gives the frame. */
export type AspectRatioLook = { readonly ratio: AspectRatioValue; readonly classes: string };

/**
 * A cell's ratio and classes.
 *
 * @param cell - An `aspect-ratio` cell.
 * @returns The ratio its `ratio` names, with that demo's classes from {@link RATIO_CLASSES}.
 * @throws When the cell names no ratio the set declares, a defect in the caller's cell.
 */
export function aspectRatioLook(cell: Cell): AspectRatioLook {
  const found = [...RATIO_CLASSES].find(([ratio]) => ratio === cell.ratio);
  if (found === undefined) {
    throw new Error(`Aspect ratio has no ratio ${cell.ratio ?? ""}`);
  }
  const [ratio, classes] = found;
  return { ratio, classes };
}

/**
 * The frame's manifest, which the capture-backed build reads with `captures/aspect-ratio.json`: an
 * `<AspectRatio ratio className>` around the portrait's `<img>`, in a 448px host.
 */
export const ASPECT_RATIO_MANIFEST: SetManifest = {
  key: "aspect-ratio",
  name: "Aspect ratio",
  api: { page: "aspect-ratio", parts: ["AspectRatio"] },
  slot: "aspect-ratio",
  axes: [{ name: "ratio", values: [...RATIO_CLASSES.keys()] }],
  columnAxis: "ratio",
  previewWidth: ASPECT_RATIO_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "image",
      slot: undefined,
      place: "aspect-ratio/0",
      shownIn: always,
      image: portraitPng,
      label: undefined,
      iconsFor: () => [],
    },
  ],
  swapProperties: [],
};
