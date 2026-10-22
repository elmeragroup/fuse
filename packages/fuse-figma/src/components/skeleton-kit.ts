/**
 * Skeleton, as one component set: a line and a circle, 2 cells. A Skeleton is a non-interactive
 * `<div data-slot="skeleton" aria-hidden="true">`, so the set has no state axis, and its columns
 * are the shapes.
 *
 * - The recipe fills the block with the `muted` role and gives it the `radius-md` corner. Its
 *   `animate-pulse` drops, as Figma components do not animate.
 * - The recipe gives no size, so each cell passes the shape a docs demo gives as consumer
 *   classes: a 192 × 16 line (`h-4 w-48`) and a 40px circle (`size-10 rounded-full`). The kit
 *   merges them as Skeleton merges its `className`, so the circle's `rounded-full` replaces the
 *   recipe's `rounded-md`.
 */
import { cn, skeletonClass } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition } from "./component-spec";

/**
 * The docs demos' shapes, as consumer classes, by the `shape` axis value. The kit merges them
 * over the recipe as Skeleton merges a consumer's `className`, and the compare renderer passes
 * them as that `className`.
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

/** A skeleton, as `<Skeleton className={demoClassesFor(cell)} />`. */
export const SKELETON: ComponentDefinition = {
  key: "skeleton",
  name: "Skeleton",
  slot: "skeleton",
  axes: [{ name: "shape", values: [...DEMO_CLASSES.keys()] }],
  columnAxis: "shape",
  classesFor: (cell) => cn(skeletonClass, demoClassesFor(cell)),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};
