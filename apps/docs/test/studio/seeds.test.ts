import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";
import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import { LIVE_MIXES, buildStudioSeeds } from "../../src/studio/generate/seeds";

const seeds = buildStudioSeeds(resolveThemeCatalog());

function seed(slug: string) {
  const found = seeds.find((candidate) => candidate.slug === slug);
  if (found === undefined) {
    throw new Error(`no seed for ${slug}`);
  }
  return found;
}

describe("buildStudioSeeds", () => {
  it("seeds every legal theme once", () => {
    expect(seeds.map((candidate) => candidate.slug).toSorted()).toEqual(
      LEGAL_THEMES.map(themeSlug).toSorted()
    );
  });

  // Each expected value is copied from the theme source module named beside it.
  it("holds the declared CSS and the resolved value of a literal", () => {
    // external-palettes.ts, fkas: radius 0.75rem, 12px at the 16px root.
    expect(seed("external-fkas-private").light.radius).toEqual({ css: "0.75rem", value: "12px" });
    // external-dark-palettes.ts, fkas: primary oklch(0.8009687 0.1043361 49.42), #F5AA81.
    expect(seed("external-fkas-private").dark.primary).toEqual({
      css: "oklch(0.8009687 0.1043361 49.42)",
      value: "#F5AA81",
    });
    // internal-dark-palette.ts: primary oklch(0.922 0 0).
    expect(seed("internal-elma-private").dark.primary.css).toBe("oklch(0.922 0 0)");
  });

  // Unit under test: buildStudioSeeds' alias entries. Oracle: literals pinned from the theme
  // source modules, never another entry of the same seed run.
  it("holds an alias as its var() and the value at the end of its chain", () => {
    const internal = seed("internal-fkas-private").light;
    // defaults.ts: button-outline var(--border), and border NEUTRAL_LINE, oklch(0.9219 0 0).
    // L 0.9219 is linear 0.9219³ = 0.7835, sRGB-encoded 0.8980, the byte 229: #E5E5E5.
    expect(internal["button-outline"]).toEqual({ css: "var(--border)", value: "#E5E5E5" });
    // defaults.ts: radius-button var(--radius), and radius 0.375rem, 6px at the 16px root.
    expect(internal["radius-button"]).toEqual({ css: "var(--radius)", value: "6px" });
    // defaults.ts: font-heading var(--font-sans), whose first family is Roboto.
    expect(internal["font-heading"]).toEqual({ css: "var(--font-sans)", value: "Roboto" });
    expect(internal["selection-title-weight"]).toEqual({ css: "400", value: "400" });
  });

  it("holds a mixed role as the color-mix() the theme rules declare", () => {
    for (const scheme of ["light", "dark"] as const) {
      expect(seed("external-elma-private")[scheme]["secondary-hover"].css).toBe(
        "color-mix(in oklch, var(--secondary), var(--foreground) 5%)"
      );
    }
  });

  it("keeps a light-only key's light declaration in dark", () => {
    // external-palettes.ts, fkas: radius 0.75rem, which the dark palette keeps.
    expect(seed("external-fkas-private").dark.radius.css).toBe("0.75rem");
  });
});

describe("LIVE_MIXES", () => {
  it("matches the color-mix() the shipped theme stylesheet declares for each mixed role", () => {
    const themesCss = readFileSync(
      createRequire(import.meta.url).resolve("@elmeragroup/fuse/themes.css"),
      "utf8"
    );
    for (const [name, css] of LIVE_MIXES) {
      expect(themesCss).toContain(`--${name}: ${css};`);
    }
  });
});
