import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Wcag from "@elmeragroup/color/wcag";
import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";

import { fuseSrc } from "../scripts/lib/paths.ts";
import { PALETTE_CATALOG } from "../src/generated/palette-catalog";
import {
  brandColumns,
  contrastGrade,
  formatRatio,
  matchesSearch,
  pairRows,
  primitiveRows,
  tokenRows,
} from "../src/lib/palettes";
import type { PaletteAxes, PaletteCatalog, PaletteScheme, PairRow, TokenRow } from "../src/lib/palettes";

/**
 * Oracles: literal values from Fuse's token modules, the Figma brand ramps and Fuse's committed
 * contrast snapshot. The catalog under test is generated from the resolved theme catalog, so these
 * pin what it reports against what the sources declare.
 */
const EXTERNAL_PRIVATE_LIGHT: PaletteAxes = { variant: "external", segment: "private", scheme: "light" };
const INTERNAL_PRIVATE_LIGHT: PaletteAxes = { variant: "internal", segment: "private", scheme: "light" };

function brandIndex(code: string): number {
  return PALETTE_CATALOG.brands.findIndex((brand) => brand.code === code);
}

function tokenRow(rows: readonly TokenRow[], name: string): TokenRow {
  const row = rows.find((candidate) => candidate.name === name);
  if (row === undefined) throw new Error(`no row --${name}`);
  return row;
}

function pairRow(rows: readonly PairRow[], foreground: string, background: string): PairRow {
  const row = rows.find((candidate) => candidate.id === `${foreground}/${background}`);
  if (row === undefined) throw new Error(`no pair ${foreground}/${background}`);
  return row;
}

function valueCell(row: TokenRow, code: string) {
  const cell = row.cells[brandIndex(code)];
  if (cell?._tag !== "value") throw new Error(`no value for --${row.name} in ${code}`);
  return cell;
}

function pairCell(row: PairRow, code: string) {
  const cell = row.cells[brandIndex(code)];
  if (cell?._tag !== "value") throw new Error(`no value for ${row.id} in ${code}`);
  return cell;
}

describe("palette catalog", () => {
  it("holds every legal theme, brand by brand", () => {
    const slugs = PALETTE_CATALOG.brands.flatMap((brand) =>
      brand.themes.map((theme) => `${theme.variant}-${brand.code}-${theme.segment}`)
    );
    expect(slugs.toSorted()).toEqual(LEGAL_THEMES.map(themeSlug).toSorted());
  });

  it("marks Elmera's and Nordic Green Energy's ramps as generated and the others as Figma's", () => {
    expect(Object.fromEntries(PALETTE_CATALOG.brands.map((brand) => [brand.code, brand.rampOrigin]))).toEqual(
      {
        fkas: "figma",
        tkas: "figma",
        guen: "figma",
        fkab: "figma",
        fkse: "figma",
        elma: "generated",
        ngfi: "generated",
      }
    );
  });

  it("keeps ratios at full precision, so no grade reads a rounded ratio", () => {
    const ratios = PALETTE_CATALOG.brands.flatMap((brand) =>
      brand.themes.flatMap((theme) => [...theme.schemes.light.ratios, ...theme.schemes.dark.ratios])
    );
    expect(ratios.some((ratio) => ratio !== Number(ratio.toFixed(2)))).toBe(true);
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
    for (const theme of LEGAL_THEMES) {
      const columns = brandColumns(PALETTE_CATALOG, {
        variant: theme.variant,
        segment: theme.segment,
        scheme: "light",
      });
      const textGrade = pairRows(PALETTE_CATALOG, columns).filter((row) => row.pair.kind === "text-grade");
      for (const row of textGrade) {
        expect(Number(pairCell(row, theme.brand).ratio.toFixed(2)), `${themeSlug(theme)} ${row.id}`).toBe(
          snapshot[themeSlug(theme)]?.[row.id]
        );
      }
    }
  });
});

describe("brand columns", () => {
  it("show a pinned brand's one segment instead of a theme", () => {
    // Telinet (fkse) is pinned to private and Fjordkraft Företag (fkab) to company.
    const company = brandColumns(PALETTE_CATALOG, { ...EXTERNAL_PRIVATE_LIGHT, segment: "company" });
    expect(company[brandIndex("fkse")]).toMatchObject({ _tag: "pinned", only: "private" });
    const privateColumns = brandColumns(PALETTE_CATALOG, EXTERNAL_PRIVATE_LIGHT);
    expect(privateColumns[brandIndex("fkab")]).toMatchObject({ _tag: "pinned", only: "company" });
    expect(privateColumns.filter((column) => column._tag === "theme")).toHaveLength(6);
  });
});

describe("role rows", () => {
  it("pill a role whose value equals a ramp step, shade before neutral", () => {
    // Figma's Fjordkraft ramps hold #FFEEE6 at both shade-100 and neutral-100, and the external
    // Fjordkraft palette's background paints that color.
    const rows = tokenRows(PALETTE_CATALOG, brandColumns(PALETTE_CATALOG, EXTERNAL_PRIVATE_LIGHT), "roles");
    const background = valueCell(tokenRow(rows, "background"), "fkas");
    expect(background.tone.hex).toBe("#FFEEE6");
    expect(background.step).toBe("shade-100");
  });

  it("pill a role that aliases another token by that token's name", () => {
    // `tokens/defaults.ts`: dialog is var(--popover); the brand pointer: brand is var(--brand-fkas).
    const rows = tokenRows(PALETTE_CATALOG, brandColumns(PALETTE_CATALOG, INTERNAL_PRIVATE_LIGHT), "roles");
    expect(valueCell(tokenRow(rows, "dialog"), "fkas").alias).toBe("popover");
    expect(valueCell(tokenRow(rows, "brand"), "fkas").alias).toBe("brand-fkas");
    expect(valueCell(tokenRow(rows, "brand"), "fkas").tone.oklch).toBe("oklch(0.68 0.21747 38.8)");
  });

  it("change with the scheme", () => {
    // `tokens/dark-defaults.ts`: the dark error, #FFB4AB.
    const light = tokenRows(PALETTE_CATALOG, brandColumns(PALETTE_CATALOG, EXTERNAL_PRIVATE_LIGHT), "roles");
    const dark = tokenRows(
      PALETTE_CATALOG,
      brandColumns(PALETTE_CATALOG, { ...EXTERNAL_PRIVATE_LIGHT, scheme: "dark" }),
      "roles"
    );
    expect(valueCell(tokenRow(dark, "error"), "fkas").tone).toMatchObject({
      oklch: "oklch(0.8383036 0.089085 26.7575)",
      hex: "#FFB4AB",
    });
    expect(valueCell(tokenRow(light, "error"), "fkas").tone.hex).not.toBe("#FFB4AB");
  });

  it("leave the ramp steps to the Brand ramps collection, grouped by scale", () => {
    const columns = brandColumns(PALETTE_CATALOG, EXTERNAL_PRIVATE_LIGHT);
    const roles = tokenRows(PALETTE_CATALOG, columns, "roles");
    const ramps = tokenRows(PALETTE_CATALOG, columns, "ramps");
    expect(roles.some((row) => row.name.startsWith("brand-shade-"))).toBe(false);
    expect(ramps).toHaveLength(22);
    expect(new Set(ramps.map((row) => row.group))).toEqual(new Set(["neutral", "shade"]));
    // The Figma Telinet shade 600, in Fuse's `test/fixtures/figma-brand-ramps.json`.
    expect(valueCell(tokenRow(ramps, "brand-shade-600"), "fkse").tone.hex).toBe("#2F81A3");
  });
});

describe("pair rows", () => {
  it("grade a pair below AA as such", () => {
    // The fkas orange behind white: WCAG relative luminance of #FF5604 is 0.279, so
    // (1 + 0.05) / (0.279 + 0.05) is 3.19 at the hex's 8-bit precision.
    const rows = pairRows(PALETTE_CATALOG, brandColumns(PALETTE_CATALOG, INTERNAL_PRIVATE_LIGHT));
    const brand = pairCell(pairRow(rows, "brand-foreground", "brand"), "fkas");
    expect(brand.ratio).toBeCloseTo(3.19, 1);
    expect(brand.grade).toBe("below-aa");
    expect(pairRow(rows, "brand-foreground", "brand").grades).toContain("below-aa");
  });

  it("grade the pairs the contract names beyond the X-foreground convention", () => {
    // `tokens/external-dark-palettes.ts`, guen: feature-foreground #C2C2FF on feature-bright #403DEE.
    const onBright = getOrThrow(
      Wcag.contrastRatio(getOrThrow(Hex.parse("#C2C2FF")), getOrThrow(Hex.parse("#403DEE")))
    );
    const rows = pairRows(
      PALETTE_CATALOG,
      brandColumns(PALETTE_CATALOG, { ...EXTERNAL_PRIVATE_LIGHT, scheme: "dark" })
    );
    const bright = pairCell(pairRow(rows, "feature-foreground", "feature-bright"), "guen");
    expect(bright.ratio).toBeCloseTo(onBright, 1);
    expect(bright.grade).toBe("below-aa");
    for (const [foreground, background] of [
      ["background", "foreground"],
      ["selection-disabled-foreground", "selection-disabled-background"],
      ["sidebar-brand", "sidebar"],
      ["muted-foreground", "primary-soft"],
    ] as const) {
      expect(pairRow(rows, foreground, background).pair.kind).toBe("role");
    }
  });
});

describe("primitive rows", () => {
  it("hold the primitives in source order, the fkab accent as an alias of fkas", () => {
    const rows = primitiveRows(PALETTE_CATALOG);
    expect(rows[0]?.primitive.name).toBe("neutral-50");
    // `tokens/primitives.ts`: brand-fkab is var(--brand-fkas).
    expect(rows.find((row) => row.id === "brand-fkab")?.primitive.alias).toBe("--brand-fkas");
  });
});

describe("search", () => {
  it("matches a row by name, by any value it shows, and by every word", () => {
    const rows = tokenRows(PALETTE_CATALOG, brandColumns(PALETTE_CATALOG, EXTERNAL_PRIVATE_LIGHT), "roles");
    const background = tokenRow(rows, "background");
    expect(matchesSearch(background, "background")).toBe(true);
    expect(matchesSearch(background, "#ffeee6")).toBe(true);
    expect(matchesSearch(background, "shade-100 background")).toBe(true);
    expect(matchesSearch(background, "sidebar")).toBe(false);
  });
});

/** A two-token, one-pair catalog of one brand and theme, its scheme overridden by `scheme`. */
function fixture(
  ratio: number,
  scheme: Partial<PaletteScheme> = {},
  pairs: PaletteCatalog["pairs"] = [
    { foreground: "foreground", background: "background", kind: "text-grade" },
  ]
): PaletteCatalog {
  const palette: PaletteScheme = {
    values: [
      { oklch: "oklch(0.9 0 0)", hex: "#E2E2E2", alpha: 1 },
      { oklch: "oklch(0.2 0 0)", hex: "#161616", alpha: 1 },
    ],
    aliases: [null, null],
    ratios: [ratio],
    ...scheme,
  };
  return {
    tokens: ["background", "foreground"],
    pairs,
    primitives: [],
    brands: [
      {
        code: "elma",
        name: "Elmera",
        accent: { oklch: "oklch(0.3 0.05 217.7)", hex: "#0F3442", alpha: 1 },
        rampOrigin: "generated",
        segments: ["private", "company"],
        themes: [{ variant: "internal", segment: "private", schemes: { light: palette, dark: palette } }],
      },
    ],
  };
}

function fixturePairs(catalog: PaletteCatalog): readonly PairRow[] {
  return pairRows(catalog, brandColumns(catalog, INTERNAL_PRIVATE_LIGHT));
}

describe("grading", () => {
  it.each([
    [4.4988, "below-aa", "4.49:1"],
    [4.5, "AA", "4.50:1"],
    [6.9988, "AA", "6.99:1"],
    [7, "AAA", "7.00:1"],
  ] as const)("grades %s:1 at full precision as %s and shows %s", (ratio, grade, shown) => {
    const cell = fixturePairs(fixture(ratio))[0]?.cells[0];
    expect(cell?._tag === "value" ? cell.grade : undefined).toBe(grade);
    expect(formatRatio(ratio)).toBe(shown);
  });

  it.each([
    [21, "AAA"],
    [6.99, "AA"],
    [4.49, "below-aa"],
  ] as const)("grades %s:1 as %s", (ratio, grade) => {
    expect(contrastGrade(ratio)).toBe(grade);
  });
});

describe("a stale catalog", () => {
  it("throws on a theme that lacks a ratio, a value or an alias entry, rather than fill one in", () => {
    expect(() => fixturePairs(fixture(5, { ratios: [] }))).toThrow(/ratios/u);
    expect(() => fixturePairs(fixture(5, { values: [] }))).toThrow(/token values/u);
    expect(() => fixturePairs(fixture(5, { aliases: [null] }))).toThrow(/aliases/u);
  });

  it("throws, naming the missing token, on a pair whose endpoint the catalog lacks", () => {
    const orphan = fixture(5, {}, [
      { foreground: "primary-foreground", background: "background", kind: "text-grade" },
    ]);
    expect(() => fixturePairs(orphan)).toThrow(
      /--primary-foreground on --background, but has no token --primary-foreground/u
    );
  });

  it("throws on an allowed theme the catalog does not hold", () => {
    expect(() => brandColumns(fixture(5), { ...INTERNAL_PRIVATE_LIGHT, variant: "external" })).toThrow(
      /external-elma-private/u
    );
  });
});
