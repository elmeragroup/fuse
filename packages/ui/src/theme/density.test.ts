import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { defaultDensityForVariant, densityAttributes } from "./density";
import type { Density } from "./density";
import { LEGAL_THEMES } from "./tokens/themes";
import type { ThemeVariant } from "./tokens/themes";

const themeDir = dirname(fileURLToPath(import.meta.url));

describe("defaultDensityForVariant", () => {
  it("maps internal to dense and external to comfortable", () => {
    expect(defaultDensityForVariant("internal")).toBe("dense");
    expect(defaultDensityForVariant("external")).toBe("comfortable");
  });

  it("ignores brand and segment across all 20 legal themes", () => {
    expect(LEGAL_THEMES).toHaveLength(20);
    for (const theme of LEGAL_THEMES) {
      expect(defaultDensityForVariant(theme.variant)).toBe(
        theme.variant === "internal" ? "dense" : "comfortable"
      );
    }
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

describe("Wave 1 host interface", () => {
  it("leaves ThemeProvider and ThemeScope without density behavior", () => {
    const provider = readFileSync(join(themeDir, "theme-provider.tsx"), "utf8");
    const scope = readFileSync(join(themeDir, "theme-scope.tsx"), "utf8");
    expect(provider).not.toMatch(/density/i);
    expect(scope).not.toMatch(/density/i);
  });
});
