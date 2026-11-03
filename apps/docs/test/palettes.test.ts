import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Wcag from "@elmeragroup/color/wcag";
import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";
import type { ThemeSlug } from "@elmeragroup/fuse/theme";

import { fuseSrc } from "../scripts/lib/paths.ts";
import { PALETTE_CATALOG } from "../src/generated/palette-catalog";
import { contrastGrade, formatRatio, paletteTheme, paletteView } from "../src/lib/palettes";
import type { PaletteCatalog, PaletteScheme, PaletteView, RoleView } from "../src/lib/palettes";

/**
 * Oracles: literal values from Fuse's token modules and its committed contrast snapshot. The
 * catalog under test is generated from the resolved theme catalog, so these pin what it reports
 * against what the token sources declare.
 */
const NEUTRAL_950 = "oklch(0.16 0 0)"; // `tokens/defaults.ts`, the internal primary
const WHITE = "oklch(1 0 0)"; // `tokens/primitives.ts`
const BRAND_FKAS = "oklch(0.68 0.21747 38.8)"; // `tokens/primitives.ts`, `brand-fkas`
const DARK_ERROR = { oklch: "oklch(0.8383036 0.089085 26.7575)", hex: "#FFB4AB" }; // `tokens/dark-defaults.ts`

function view(slug: ThemeSlug, scheme: "light" | "dark"): PaletteView {
  return paletteView(PALETTE_CATALOG, paletteTheme(PALETTE_CATALOG, slug), scheme);
}

function role(palette: PaletteView, name: string): RoleView {
  const found = palette.roles.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`no role --${name} in ${palette.slug}`);
  }
  return found;
}

function pair(palette: PaletteView, foreground: string, background: string) {
  return palette.pairs.find(
    (candidate) => candidate.foreground === foreground && candidate.background === background
  );
}

describe("palette catalog", () => {
  it("holds every legal theme, in order", () => {
    expect(PALETTE_CATALOG.themes.map((theme) => theme.slug)).toEqual(LEGAL_THEMES.map(themeSlug));
  });

  it("reports a role's declared oklch() literal, following a var() to the primitive it names", () => {
    const fkas = view("internal-fkas-private", "light");
    expect(role(fkas, "primary").tone.oklch).toBe(NEUTRAL_950);
    expect(role(fkas, "brand").tone.oklch).toBe(BRAND_FKAS);
    expect(role(fkas, "brand").alias).toBe("--brand-fkas");
    expect(role(fkas, "brand").tone.hex).toBe("#FF5604");
  });

  it("matches the hex the dark defaults note beside each literal", () => {
    const error = role(view("external-fkas-private", "dark"), "error").tone;
    expect({ oklch: error.oklch, hex: error.hex }).toEqual(DARK_ERROR);
  });

  it("reads a hex literal as declared", () => {
    // `tokens/defaults.ts` declares `sh-keyword: "#ff7733"` for the light scheme.
    expect(role(view("internal-fkas-private", "light"), "sh-keyword").tone.hex).toBe("#FF7733");
  });

  it("puts roles with the same value on one tone and lists them together", () => {
    const fkas = view("internal-fkas-private", "light");
    // `tokens/defaults.ts` sets background, card and popover to WHITE.
    const white = role(fkas, "background").tone;
    expect(white.oklch).toBe(WHITE);
    expect(white.roles).toEqual(expect.arrayContaining(["background", "card", "popover"]));
    expect(role(fkas, "card").tone.step).toBe(white.step);
    expect(role(fkas, "card").sharesWith).toContain("background");
    // Every tone is distinct.
    expect(new Set(fkas.tones.map((tone) => tone.oklch)).size).toBe(fkas.tones.length);
  });

  it("orders the opaque tones from darkest to lightest, then the translucent ones", () => {
    for (const theme of PALETTE_CATALOG.themes) {
      for (const scheme of ["light", "dark"] as const) {
        const { tones } = theme.schemes[scheme];
        const opaque = tones.filter((tone) => tone.alpha === 1);
        const lightness = opaque.map((tone) => {
          const parsed = Oklch.parse(tone.oklch);
          return parsed._tag === "ok" ? parsed.value.l : Number.NaN;
        });
        expect(lightness, `${theme.slug} ${scheme}`).toEqual(lightness.toSorted((a, b) => a - b));
        expect(tones.slice(0, opaque.length), `${theme.slug} ${scheme}`).toEqual(opaque);
      }
    }
  });

  it("matches Fuse's committed contrast snapshot for every text-grade pair in light", () => {
    // A cross-check: the snapshot comes from Fuse's own contrast matrix over composed tokens,
    // the catalog from the resolved catalog's sRGB values.
    // Vitest's file snapshot writes trailing commas, which JSON refuses.
    const text = readFileSync(path.join(fuseSrc, "theme/__snapshots__/contrast-matrix.json"), "utf8");
    // SAFETY: the file is Fuse's committed `toMatchFileSnapshot` output of `buildContrastMatrix`,
    // a record of theme slug to pair id to ratio.
    const snapshot = JSON.parse(text.replaceAll(/,(\s*[}\]])/gu, "$1")) as Record<
      string,
      Record<string, number>
    >;
    for (const theme of PALETTE_CATALOG.themes) {
      const palette = view(theme.slug, "light");
      for (const graded of palette.pairs.filter((candidate) => candidate.kind === "text-grade")) {
        const id = `${graded.foreground}/${graded.background}`;
        // The snapshot rounds with `toFixed(2)`; the catalog keeps full precision for grading.
        expect(Number(graded.ratio.toFixed(2)), `${theme.slug} ${id}`).toBe(snapshot[theme.slug]?.[id]);
      }
    }
  });

  it("keeps ratios at full precision, so no grade reads a rounded ratio", () => {
    const ratios = PALETTE_CATALOG.themes.flatMap((theme) => [
      ...theme.schemes.light.ratios,
      ...theme.schemes.dark.ratios,
    ]);
    expect(ratios.some((ratio) => ratio !== Number(ratio.toFixed(2)))).toBe(true);
  });

  it("grades a pair below AA as such", () => {
    // The fkas orange behind white: WCAG relative luminance of #FF5604 is 0.279, so
    // (1 + 0.05) / (0.279 + 0.05) is 3.19 at the hex's 8-bit precision.
    const brand = pair(view("internal-fkas-private", "light"), "brand-foreground", "brand");
    expect(brand?.kind).toBe("role");
    expect(brand?.ratio).toBeCloseTo(3.19, 1);
    expect(brand?.grade).toBe("below-aa");
    expect(role(view("internal-fkas-private", "light"), "brand").weakestPair?.grade).toBe("below-aa");
  });

  it("grades a passing pair from the snapshot's ratio", () => {
    // `contrast-matrix.json`: external-elma-private foreground/background is 13.28.
    const text = pair(view("external-elma-private", "light"), "foreground", "background");
    expect(text).toMatchObject({ kind: "text-grade", grade: "AAA" });
    expect(text?.ratio).toBeCloseTo(13.28, 2);
  });

  it("grades the pairs the contract names beyond the X-foreground convention", () => {
    // `tokens/external-dark-palettes.ts`, guen: feature-foreground #C2C2FF draws on both feature
    // fills, and feature-bright is #403DEE. The oracle measures the declared hex values.
    const onBright = getOrThrow(
      Wcag.contrastRatio(getOrThrow(Hex.parse("#C2C2FF")), getOrThrow(Hex.parse("#403DEE")))
    );
    const guen = view("external-guen-private", "dark");
    const bright = pair(guen, "feature-foreground", "feature-bright");
    expect(bright?.kind).toBe("role");
    expect(bright?.ratio).toBeCloseTo(onBright, 1);
    expect(bright?.grade).toBe("below-aa");
    expect(role(guen, "feature-foreground").weakestPair).toMatchObject({
      foreground: "feature-foreground",
      background: "feature-bright",
    });
    for (const [foreground, background] of [
      ["background", "foreground"],
      ["selection-disabled-foreground", "selection-disabled-background"],
      ["sidebar-brand", "sidebar"],
      ["muted-foreground", "primary-soft"],
    ] as const) {
      expect(pair(guen, foreground, background), `${foreground}/${background}`).toBeDefined();
    }
  });
});

/** A two-role catalog whose one pair has `ratio`, with the scheme overridden by `scheme`. */
function fixture(ratio: number, scheme: Partial<PaletteScheme> = {}): PaletteCatalog {
  const palette: PaletteScheme = {
    tones: [
      { oklch: "oklch(0.2 0 0)", hex: "#161616", alpha: 1 },
      { oklch: "oklch(0.9 0 0)", hex: "#E2E2E2", alpha: 1 },
    ],
    roleTones: [1, 0],
    aliases: [null, null],
    ratios: [ratio],
    ...scheme,
  };
  return {
    roles: ["background", "foreground"],
    pairs: [{ foreground: "foreground", background: "background", kind: "text-grade" }],
    themes: [
      {
        slug: "internal-elma-private",
        input: { variant: "internal", brand: "elma", segment: "private" },
        schemes: { light: palette, dark: palette },
      },
    ],
  };
}

function fixtureView(catalog: PaletteCatalog): PaletteView {
  return paletteView(catalog, paletteTheme(catalog, "internal-elma-private"), "light");
}

describe("paletteView", () => {
  it.each([
    [4.4988, "below-aa", "4.49:1"],
    [4.5, "AA", "4.50:1"],
    [6.9988, "AA", "6.99:1"],
    [7, "AAA", "7.00:1"],
  ] as const)("grades %s:1 at full precision as %s and shows %s", (ratio, grade, shown) => {
    const [graded] = fixtureView(fixture(ratio)).pairs;
    expect(graded?.grade).toBe(grade);
    expect(formatRatio(graded?.ratio ?? 0)).toBe(shown);
  });

  it("throws on a catalog that lacks a ratio, a tone or an alias entry, rather than fill one in", () => {
    expect(() => fixtureView(fixture(5, { ratios: [] }))).toThrow(/ratios/u);
    expect(() => fixtureView(fixture(5, { roleTones: [1, 2] }))).toThrow(/tone 2 for --foreground/u);
    expect(() => fixtureView(fixture(5, { aliases: [null] }))).toThrow(/aliases/u);
  });

  it("throws, naming the theme, scheme and role, on a pair whose role the catalog lacks", () => {
    const catalog = fixture(5);
    const orphan: PaletteCatalog = {
      ...catalog,
      pairs: [{ foreground: "primary-foreground", background: "background", kind: "text-grade" }],
    };
    expect(() => fixtureView(orphan)).toThrow(
      /--primary-foreground on --background in internal-elma-private \(light\), but has no role --primary-foreground/u
    );
  });

  it("throws on a slug the catalog does not hold", () => {
    expect(() => paletteTheme(fixture(5), "external-elma-private")).toThrow(/external-elma-private/u);
  });
});

describe("contrastGrade", () => {
  it.each([
    [21, "AAA"],
    [7, "AAA"],
    [6.99, "AA"],
    [4.5, "AA"],
    [4.49, "below-aa"],
    [1, "below-aa"],
  ] as const)("grades %s:1 as %s", (ratio, grade) => {
    expect(contrastGrade(ratio)).toBe(grade);
  });
});
