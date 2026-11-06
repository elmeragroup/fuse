import { describe, expect, it } from "vitest";

import { densityAttributes } from "./density";
import type { Density } from "./density";

describe("densityAttributes", () => {
  it("returns exactly one data-density attribute for each rung", () => {
    expect(densityAttributes("dense")).toEqual({ "data-density": "dense" });
    expect(densityAttributes("comfortable")).toEqual({ "data-density": "comfortable" });
    expect(Object.keys(densityAttributes("dense"))).toEqual(["data-density"]);
  });
});

/** Untyped values a JS caller can pass: an unknown string and non-strings that coerce to a key. */
const UNTYPED: readonly (readonly [string, unknown])[] = [
  ["an unknown string", "system"],
  ["an array holding a density", ["comfortable"]],
  ["an object", { identity: "branded" }],
  ["a number", 1],
];

describe.each(UNTYPED)("an untyped value: %s", (_name, value) => {
  it("is rejected by densityAttributes", () => {
    // SAFETY: runtime rejection is the contract under test; the public type is Density.
    expect(() => densityAttributes(value as Density)).toThrow(/unknown or missing/);
  });
});
