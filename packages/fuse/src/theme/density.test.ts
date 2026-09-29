import { describe, expect, it } from "vitest";

import { defaultDensityForVariant, densityAttributes } from "./density";
import type { Density } from "./density";
import type { ThemeVariant } from "./tokens/themes";

describe("defaultDensityForVariant", () => {
  it("maps internal to dense and external to comfortable", () => {
    expect(defaultDensityForVariant("internal")).toBe("dense");
    expect(defaultDensityForVariant("external")).toBe("comfortable");
  });

  it("rejects an unknown untyped variant", () => {
    // SAFETY: runtime rejection is the contract under test; the public type is ThemeVariant.
    expect(() => defaultDensityForVariant("system" as ThemeVariant)).toThrow(/unknown or missing/);
  });
});

describe("densityAttributes", () => {
  it("returns exactly one data-density attribute for each rung", () => {
    expect(densityAttributes("dense")).toEqual({ "data-density": "dense" });
    expect(densityAttributes("comfortable")).toEqual({ "data-density": "comfortable" });
    expect(Object.keys(densityAttributes("dense"))).toEqual(["data-density"]);
  });

  it("rejects an unknown untyped density", () => {
    // SAFETY: runtime rejection is the contract under test; the public type is Density.
    expect(() => densityAttributes("system" as Density)).toThrow(/unknown or missing/);
  });
});
