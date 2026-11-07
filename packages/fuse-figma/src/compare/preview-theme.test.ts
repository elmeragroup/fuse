import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { parsePreviewTheme, themeStamps } from "./preview-theme";

const modes = (entries: Readonly<Record<string, string>>) =>
  Object.entries(entries).map(([collection, mode]) => ({ collection, mode }));

const FJORDKRAFT_LIGHT = {
  "Fuse tokens": "Light",
  "Fuse identity": "Neutral",
  "Fuse segment": "Private",
  "Fuse brand": "Fjordkraft",
  "Fuse density": "Dense",
};

describe("parsePreviewTheme", () => {
  it("reads the modes figma:sync names", () => {
    expect(Result.getOrThrow(parsePreviewTheme(modes(FJORDKRAFT_LIGHT)))).toEqual({
      scheme: "light",
      identity: "neutral",
      brand: "fkas",
      segment: "private",
      density: "dense",
    });
    expect(
      Result.getOrThrow(
        parsePreviewTheme(
          modes({
            "Fuse tokens": "Dark",
            "Fuse identity": "Branded",
            "Fuse segment": "Company",
            "Fuse brand": "Elmera",
            "Fuse density": "Comfortable",
          })
        )
      )
    ).toEqual({
      scheme: "dark",
      identity: "branded",
      brand: "elma",
      segment: "company",
      density: "comfortable",
    });
  });

  it("ignores collections a theme does not read", () => {
    expect(
      Result.getOrThrow(
        parsePreviewTheme(modes({ ...FJORDKRAFT_LIGHT, "Fuse primitives": "Value", Local: "Mode 1" }))
      )
    ).toMatchObject({ brand: "fkas" });
  });

  it("reads the density the preview pins, whatever its identity, and refuses Auto", () => {
    const density = (identity: string, mode: string) =>
      parsePreviewTheme(modes({ ...FJORDKRAFT_LIGHT, "Fuse identity": identity, "Fuse density": mode }));
    expect(Result.getOrThrow(density("Branded", "Dense")).density).toBe("dense");
    expect(Result.getOrThrow(density("Neutral", "Comfortable")).density).toBe("comfortable");
    // No identity implies a density, so the Auto mode an older sync wrote renders nothing.
    expect(Result.isFailure(density("Neutral", "Auto"))).toBe(true);
  });

  it("shows a brand pinned to one segment in that segment under either segment mode", () => {
    const pinned = (brand: string, segment: string) =>
      Result.getOrThrow(
        parsePreviewTheme(modes({ ...FJORDKRAFT_LIGHT, "Fuse brand": brand, "Fuse segment": segment }))
      );
    expect(pinned("Telinet (private only)", "Company")).toMatchObject({ brand: "fkse", segment: "private" });
    expect(pinned("Fjordkraft Företag (company only)", "Private")).toMatchObject({
      brand: "fkab",
      segment: "company",
    });
  });

  it("refuses a missing collection and an unknown mode, naming them", () => {
    const { "Fuse density": _, ...withoutDensity } = FJORDKRAFT_LIGHT;
    const refusal = (theme: ReturnType<typeof parsePreviewTheme>) =>
      Result.isFailure(theme) ? theme.failure.message : undefined;
    expect(refusal(parsePreviewTheme(modes(withoutDensity)))).toContain("Fuse density");
    expect(refusal(parsePreviewTheme(modes({ ...FJORDKRAFT_LIGHT, "Fuse brand": "Acme" })))).toContain(
      "Fuse brand / Acme"
    );
  });
});

describe("themeStamps", () => {
  it("puts the scheme and density on the root and the theme on the body", () => {
    expect(
      themeStamps({
        scheme: "dark",
        identity: "neutral",
        brand: "elma",
        segment: "company",
        density: "comfortable",
      })
    ).toEqual({
      root: { "data-theme": "dark", "data-density": "comfortable" },
      body: { "data-theme-identity": "neutral", "data-theme-brand": "elma", "data-theme-segment": "company" },
    });
  });
});
