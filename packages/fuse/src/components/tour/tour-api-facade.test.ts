// Unit under test: test/tour/api-facade.ts, the plain object the docs API extractor reads in place
// of the tour entry's ES module namespace. Oracle: the `Tour` namespace and hooks of src/tour.ts,
// which the facade must reproduce key for key and function for function, so the docs never
// describe a part the entry lacks.
import { describe, expect, it } from "vitest";

import * as facade from "../../../test/tour/api-facade";
import * as entry from "../../tour";

describe("the tour docs API facade", () => {
  it("holds Tour's parts under the same keys", () => {
    const parts = new Map<string, unknown>(Object.entries(entry.Tour));
    expect(Object.keys(facade.Tour).sort()).toEqual([...parts.keys()].sort());
    for (const [key, part] of Object.entries(facade.Tour)) {
      expect(part, key).toBe(parts.get(key));
    }
  });

  it("passes the hooks the page documents through", () => {
    expect(facade.useTour).toBe(entry.useTour);
    expect(facade.useTourStep).toBe(entry.useTourStep);
    expect(facade.useTourStepDone).toBe(entry.useTourStepDone);
    expect(facade.useAutoStartTour).toBe(entry.useAutoStartTour);
  });
});
