import { describe, expect, it } from "vitest";

import { defaultDensityForVariant, densityAttributes } from "./density";
import type { Density } from "./density";
import type { ThemeVariant } from "./tokens/themes";

describe("defaultDensityForVariant", () => {
  it("maps internal to dense and external to comfortable", () => {
    expect(defaultDensityForVariant("internal")).toBe("dense");
    expect(defaultDensityForVariant("external")).toBe("comfortable");
  });
});

describe("densityAttributes", () => {
  it("returns exactly one data-density attribute for each rung", () => {
    expect(densityAttributes("dense")).toEqual({ "data-density": "dense" });
    expect(densityAttributes("comfortable")).toEqual({ "data-density": "comfortable" });
    expect(Object.keys(densityAttributes("dense"))).toEqual(["data-density"]);
  });
});

it.each([
  // SAFETY: runtime rejection is the contract under test; the public type is ThemeVariant.
  ["defaultDensityForVariant", () => defaultDensityForVariant("system" as ThemeVariant)],
  // SAFETY: runtime rejection is the contract under test; the public type is Density.
  ["densityAttributes", () => densityAttributes("system" as Density)],
] as const)("%s rejects an unknown untyped value", (_name, call) => {
  expect(call).toThrow(/unknown or missing/);
});
