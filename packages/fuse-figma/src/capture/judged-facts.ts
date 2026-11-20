/**
 * The Node side of the capture's page function in `page-facts.ts`: the readings the page returns
 * that only `@elmeragroup/color` can judge, through `clearFill`, and the facts they become.
 */
import type { BlockReading } from "./block-frame.ts";
import type { MeasuredFacts } from "./capture-format.ts";
import { clearFill } from "./clear-fill.ts";
import { coincidingAround } from "./coinciding-around.ts";
import type { Rect } from "./coinciding-around.ts";
import { paints } from "./pseudo-boxes.ts";
import type { PseudoPaint } from "./pseudo-boxes.ts";

/**
 * An element around the root as the page reads it: its padding box, and for each other child and
 * its own paint over the root, whether the page counts it as reaching the root's box, whether it
 * paints anything the page checks other than a fill, and, where it does not, the distinct computed
 * `background-color` of it and every element below it.
 */
type AroundReading = {
  readonly padding: Rect;
  readonly others: readonly {
    readonly reaches: boolean;
    readonly paintsBesideFill: boolean;
    readonly fills: readonly string[];
  }[];
};

/**
 * An element's facts as the page returns them: `coincidingAround` holds the readings Node judges
 * into the fact, `pseudoPaint` the paint Node judges into `pseudoBoxes`, and `blockReading` the
 * steps and fills Node judges into `blockSteps`.
 */
export type PageFacts = Omit<MeasuredFacts, "coincidingAround" | "pseudoBoxes" | "blockSteps"> & {
  readonly coincidingAround?: { readonly root: Rect; readonly around: readonly AroundReading[] };
  readonly pseudoPaint?: Record<string, PseudoPaint>;
  readonly blockReading?: BlockReading;
};

/**
 * An element's facts with the readings the page took judged into facts. `coincidingAround` takes
 * the count {@link coincidingOf} judges from its readings, in the same place, so the facts keep the
 * order the page put them in, and goes where the count is 0. `blockReading` gives `blockSteps`
 * where `clearFill` judges every fill it holds clear. `pseudoPaint` gives `pseudoBoxes` for each
 * absolute `::before` and `::after` whose box paints, as `paints` judges it.
 *
 * @param path - The element's path from the root.
 * @param facts - What the page returned for it.
 * @returns The element's path and its facts, or nothing where it keeps none.
 */
export function judgedFacts(
  path: string,
  { pseudoPaint, blockReading, ...facts }: PageFacts
): readonly (readonly [string, MeasuredFacts])[] {
  const { coincidingAround: reading, ...rest } = facts;
  const coinciding = reading === undefined ? 0 : coincidingOf(reading);
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

/**
 * How many of the elements around the root lie exactly behind it, as {@link coincidingAround}
 * decides, where a child that paints nothing besides fills `clearFill` judges clear paints nothing.
 */
function coincidingOf({ root, around }: NonNullable<PageFacts["coincidingAround"]>): number {
  return coincidingAround(
    root,
    around.map(({ padding, others }) => ({
      padding,
      others: others.map(({ reaches, paintsBesideFill, fills }) => {
        const paintsNothing = !paintsBesideFill && fills.every(clearFill);
        return { meets: !paintsNothing && reaches, paintsNothing };
      }),
    }))
  );
}
