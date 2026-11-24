// The props chartPart returns. Unit under test: `chartPart`'s overloads. Oracle: JavaScript's object
// spread order, where the marker comes last and wins its key, and a given `data-slot` can hold
// anything, `undefined` included.
import { expectTypeOf, test } from "vitest";

import { chartPart } from "../components/chart/chart-part-marker";

test("without given props, the part's exact slot and marker", () => {
  expectTypeOf(chartPart("headline")).branded.toEqualTypeOf<{
    readonly "data-slot": "chart-headline";
    readonly "data-chart-part": "headline";
  }>();
});

/** Props whose optional data-slot may hold undefined, which erases the part's slot. */
type Given = { readonly "data-slot"?: "bill-headline"; readonly "data-chart-part": "legend" };
const given: Given = { "data-chart-part": "legend" };

test("with given props, only the marker, which wins over a data-chart-part in them", () => {
  expectTypeOf(chartPart("headline", given)).branded.toEqualTypeOf<{
    readonly "data-chart-part": "headline";
  }>();
});
