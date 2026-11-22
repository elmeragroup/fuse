/**
 * What a cell's coverage rows account for: the captured declarations its rows name, where its
 * instance parts hold their inner roots, and the parts it draws. `components/component-builder.ts`
 * builds it for each cell from the instance places `capture-cascade.ts` records, and `oracle.ts`
 * reads it to find the declarations no row accounts for.
 */

import type { DrawnPart } from "../components/drawn-parts.ts";

/**
 * What the rows of one cell account for, by the captured element and declaration. A place is the
 * measured root's index, then `around/` and the element's index among the elements around it,
 * outermost first, or `root` and the child index at each step down, as `0/root/1/0`. A declaration
 * is its place, `#`, and its index into the capture's declarations. The set's recorder collects each
 * declaration a row it records names, so one that reaches no row of the set's coverage, as a
 * declaration no layer reads, is not accounted for. The
 * cell's instance parts say where an inner set's declarations sit, which that set accounts for in its
 * own capture.
 */
export type CellAccounting = {
  readonly accounted: ReadonlySet<string>;
  readonly instances: readonly InstancePlace[];
  /** Each part the cell draws or leaves out, and the layer that draws it, as `drawn-parts.ts` records it. */
  readonly parts: readonly DrawnPart[];
};

/**
 * Where a cell's instance part holds its inner root: the root's place in the cell, as
 * {@link CellAccounting} names places, and the inner set's key and cell, whose own
 * capture holds the same root and below it the declarations that set owns.
 */
export type InstancePlace = { readonly place: string; readonly set: string; readonly cell: string };
