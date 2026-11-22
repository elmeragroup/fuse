/**
 * The Node side of the capture's page function in `page-facts.ts`: the readings the page returns
 * that Node judges, the fills through `clearFill` and the paint through `paints`, and the facts
 * they become.
 */
import type { BlockReading } from "./block-frame.ts";
import type { MeasuredFacts } from "./capture-format.ts";
import { clearFill } from "./clear-fill.ts";
import type { AroundReading } from "./coinciding-around.ts";
import { paints } from "./pseudo-boxes.ts";
import type { PseudoPaint } from "./pseudo-boxes.ts";

/**
 * An element's facts as the page returns them: `coincidingAround` holds the boxes Node measures the
 * fact against, `pseudoPaint` the paint Node judges into `pseudoBoxes`, and `blockReading` the
 * steps and fills Node judges into `blockSteps`.
 */
export type PageFacts = Omit<MeasuredFacts, "coincidingAround" | "pseudoBoxes" | "blockSteps"> & {
  readonly coincidingAround?: AroundReading;
  readonly pseudoPaint?: Record<string, PseudoPaint>;
  readonly blockReading?: BlockReading;
};

/**
 * An element's facts with the readings the page took judged into facts. `coincidingAround` takes
 * the count Node measured, in the same place, so the facts keep the order the page put them in, and
 * goes where the count is 0. `blockReading` gives `blockSteps` where `clearFill` judges every fill
 * it holds clear. `pseudoPaint` gives `pseudoBoxes` for each absolute `::before` and `::after` whose
 * box paints, as `paints` judges it.
 *
 * @param path - The element's path from the root.
 * @param facts - What the page returned for it.
 * @param coinciding - The `coincidingAround` count Node measured, 0 off the root.
 * @returns The element's path and its facts, or nothing where it keeps none.
 */
export function judgedFacts(
  path: string,
  { pseudoPaint, blockReading, ...facts }: PageFacts,
  coinciding: number
): readonly (readonly [string, MeasuredFacts])[] {
  const { coincidingAround: _reading, ...rest } = facts;
  const judged: MeasuredFacts = coinciding > 0 ? { ...facts, coincidingAround: coinciding } : rest;
  const framed: MeasuredFacts =
    blockReading?.fills.every(clearFill) === true ? { ...judged, blockSteps: blockReading.steps } : judged;
  const boxes = (["before", "after"] as const).filter((name) => {
    const paint = pseudoPaint?.[name];
    return paint !== undefined && paints(paint);
  });
  const kept: MeasuredFacts = boxes.length === 0 ? framed : { ...framed, pseudoBoxes: boxes };
  return Object.keys(kept).length === 0 ? [] : [[path, kept]];
}
