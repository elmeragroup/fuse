/**
 * Skeleton, as one component set: a line and a circle, 2 cells. A Skeleton is a non-interactive
 * `<div data-slot="skeleton" aria-hidden="true">`, so the set has no state axis, and its columns
 * are the shapes.
 *
 * The recipe gives no size, so each cell passes the shape a docs demo gives as consumer classes:
 * a 192 × 16 line (`h-4 w-48`) and a 40px circle (`size-10 rounded-full`).
 */
import type { SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";

/**
 * The docs demos' shapes, as consumer classes, by the `shape` axis value. The compare renderer
 * passes them as Skeleton's `className`.
 */
export const DEMO_CLASSES: ReadonlyMap<string, string> = new Map([
  ["line", "h-4 w-48"],
  ["circle", "size-10 rounded-full"],
]);

/**
 * The consumer classes of a cell's shape.
 *
 * @param cell - A `skeleton` cell.
 * @returns The shape's classes from {@link DEMO_CLASSES}.
 * @throws When the cell names no shape the set declares, a defect in the caller's cell.
 */
export function demoClassesFor(cell: Cell): string {
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- `shape` is the set's axis, as the owner named it
  const placeholder = cell.shape;
  const classes = placeholder === undefined ? undefined : DEMO_CLASSES.get(placeholder);
  if (classes === undefined) {
    throw new Error(`Skeleton has no shape ${placeholder ?? ""}`);
  }
  return classes;
}

/**
 * The skeleton's manifest, which the capture-backed build reads with `captures/skeleton.json`: a
 * skeleton, as `<Skeleton className={demoClassesFor(cell)} />`.
 */
export const SKELETON_MANIFEST: SetManifest = {
  key: "skeleton",
  name: "Skeleton",
  slot: "skeleton",
  axes: [{ name: "shape", values: [...DEMO_CLASSES.keys()] }],
  columnAxis: "shape",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};
