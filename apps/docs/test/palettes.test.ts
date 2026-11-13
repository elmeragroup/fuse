import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";

import { fuseSrc } from "../scripts/lib/paths.ts";
import { PALETTE_CATALOG } from "../src/generated/palette-catalog";
import { brandColumns, contrastGrade, formatRatio, pairRows, rampRows, roleRows } from "../src/lib/palettes";
import type { BrandColumn, PaletteAxes, PairRow, RampRow, RoleRow } from "../src/lib/palettes";

/**
 * Oracles: the role-to-step table and the palette seeds in CONTEXT.md ("Brand palette"), literal
 * values from Fuse's token modules, and Fuse's committed contrast snapshot. The catalog under test
 * is generated from the resolved theme catalog, so these pin what it reports against what the
 * sources declare.
 */
const BRANDED_PRIVATE_LIGHT: PaletteAxes = { identity: "branded", segment: "private", scheme: "light" };

function brandIndex(code: string): number {
  return PALETTE_CATALOG.brands.findIndex((brand) => brand.code === code);
}

function columnsFor(axes: PaletteAxes): readonly BrandColumn[] {
  return brandColumns(PALETTE_CATALOG, axes);
}

function valueAt<C extends { readonly _tag: string }>(
  cells: readonly C[] | undefined,
  code: string,
  id: string
): Extract<C, { readonly _tag: "value" }> {
  const cell = cells?.[brandIndex(code)];
  if (cell === undefined || !isValue(cell)) throw new Error(`no value for ${id} in ${code}`);
  return cell;
}

function isValue<C extends { readonly _tag: string }>(
  cell: C
): cell is Extract<C, { readonly _tag: "value" }> {
  return cell._tag === "value";
}

function rampCell(rows: readonly RampRow[], token: string, code: string) {
  return valueAt(rows.find((row) => row.token === token)?.cells, code, token);
}

function roleCell(rows: readonly RoleRow[], name: string, code: string) {
  return valueAt(rows.find((row) => row.name === name)?.cells, code, name);
}

function pairCell(rows: readonly PairRow[], id: string, code: string) {
  const row = rows.find((candidate) => `${candidate.pair.foreground}/${candidate.pair.background}` === id);
  return valueAt(row?.cells, code, id);
}

describe("palette catalog", () => {
  it("holds every legal theme, brand by brand", () => {
    const slugs = PALETTE_CATALOG.brands.flatMap((brand) =>
      brand.themes.map((theme) => `${theme.identity}-${brand.code}-${theme.segment}`)
    );
    expect(slugs.toSorted()).toEqual(LEGAL_THEMES.map(themeSlug).toSorted());
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
      const rows = pairRows(
        PALETTE_CATALOG,
        columnsFor({ identity: theme.identity, segment: theme.segment, scheme: "light" })
      ).filter((row) => row.pair.kind === "text-grade");
      expect(rows).toHaveLength(Object.keys(snapshot[themeSlug(theme)] ?? {}).length);
      for (const row of rows) {
        const id = `${row.pair.foreground}/${row.pair.background}`;
        const cell = row.cells[brandIndex(theme.brand)];
        const ratio = cell?._tag === "value" ? Number(cell.ratio.toFixed(2)) : undefined;
        expect(ratio, `${themeSlug(theme)} ${id}`).toBe(snapshot[themeSlug(theme)]?.[id]);
      }
    }
  });
});

describe("brand columns", () => {
  it("show a pinned brand's one segment instead of a theme", () => {
    // Telinet (fkse) is pinned to private and Fjordkraft Företag (fkab) to company.
    const company = columnsFor({ ...BRANDED_PRIVATE_LIGHT, segment: "company" });
    expect(company[brandIndex("fkse")]).toMatchObject({ _tag: "pinned", only: "private" });
    const privateColumns = columnsFor(BRANDED_PRIVATE_LIGHT);
    expect(privateColumns[brandIndex("fkab")]).toMatchObject({ _tag: "pinned", only: "company" });
    expect(privateColumns.filter((column) => column._tag === "theme")).toHaveLength(6);
  });
});

describe("brand palettes", () => {
  it("mark the step where palette 1 passes through the brand's branded light feature", () => {
    // CONTEXT.md: palette 1 is seeded by the composed branded light `--feature` and holds it exactly.
    for (const segment of ["private", "company"] as const) {
      const axes = { ...BRANDED_PRIVATE_LIGHT, segment };
      const ramps = rampRows(PALETTE_CATALOG, columnsFor(axes));
      const roles = roleRows(PALETTE_CATALOG, columnsFor(axes));
      for (const brand of PALETTE_CATALOG.brands.filter((entry) => entry.segments.includes(segment))) {
        const seeds = ramps.filter((row) => {
          const cell = row.cells[brandIndex(brand.code)];
          return row.scale === "1" && cell?._tag === "value" && cell.seed;
        });
        expect(seeds, `${brand.code} ${segment}`).toHaveLength(1);
        expect(rampCell(ramps, seeds[0]?.token ?? "", brand.code).hex).toBe(
          roleCell(roles, "feature", brand.code).hex
        );
      }
    }
  });

  it("seed palette 2 with a two-colour brand's second colour, and alias palette 1 otherwise", () => {
    const ramps = rampRows(PALETTE_CATALOG, columnsFor(BRANDED_PRIVATE_LIGHT));
    // CONTEXT.md: Telinet's green #36C275 and Gudbrandsdal Energi's orange #FF9100, each at 400.
    expect(rampCell(ramps, "brand-2-400", "fkse")).toMatchObject({
      hex: "#36C275",
      seed: true,
      alias: null,
    });
    expect(rampCell(ramps, "brand-2-400", "guen")).toMatchObject({
      hex: "#FF9100",
      seed: true,
      alias: null,
    });
    for (const code of ["fkas", "tkas", "elma", "ngfi"]) {
      const palette2 = ramps.filter((row) => row.scale === "2");
      for (const row of palette2) {
        expect(rampCell(ramps, row.token, code)).toMatchObject({ alias: `brand-1-${row.step}`, seed: false });
      }
    }
  });
});

describe("role rows", () => {
  it("name the neutral ramp step each branded neutral role points at", () => {
    // CONTEXT.md, the role-to-step table for branded light.
    const roles = roleRows(PALETTE_CATALOG, columnsFor(BRANDED_PRIVATE_LIGHT));
    const expected = {
      sidebar: "brand-neutral-50",
      "right-panel": "brand-neutral-50",
      muted: "brand-neutral-100",
      accent: "brand-neutral-100",
      input: "brand-neutral-200",
      "sidebar-accent": "brand-neutral-200",
      "sidebar-border": "brand-neutral-200",
      border: "brand-neutral-300",
    };
    for (const [role, step] of Object.entries(expected)) {
      expect(roleCell(roles, role, "fkas").link, role).toEqual({ _tag: "alias", token: step });
    }
    // CONTEXT.md: Telinet's feature-foreground points at palette 2's 400, its green.
    expect(roleCell(roles, "feature-foreground", "fkse")).toEqual({
      _tag: "value",
      hex: "#36C275",
      link: { _tag: "alias", token: "brand-2-400" },
    });
  });

  it("name the ramp step a literal role's color equals, from the brand's own palettes", () => {
    // `feature` is a curated literal that seeds palette 1, so it equals palette 1's seed step and
    // never the palette 2 alias of it.
    const roles = roleRows(PALETTE_CATALOG, columnsFor(BRANDED_PRIVATE_LIGHT));
    expect(roleCell(roles, "feature", "fkas").link).toEqual({ _tag: "equals", token: "brand-1-500" });
    // The neutral identity keeps untinted greys, which no brand-tinted step equals.
    const neutral = roleRows(PALETTE_CATALOG, columnsFor({ ...BRANDED_PRIVATE_LIGHT, identity: "neutral" }));
    expect(roleCell(neutral, "muted", "fkas").link).toEqual({ _tag: "none" });
  });
});

describe("pair rows", () => {
  it("grade Fjordkraft's white brand-foreground on its orange brand below AA", () => {
    // `tokens/primitives.ts`: brand-fkas is oklch(0.68 0.21747 38.8), #FF5604. WCAG relative
    // luminance of #FF5604 is 0.279, so (1 + 0.05) / (0.279 + 0.05) is 3.19.
    const rows = pairRows(PALETTE_CATALOG, columnsFor(BRANDED_PRIVATE_LIGHT));
    const cell = pairCell(rows, "brand-foreground/brand", "fkas");
    expect(cell.ratio).toBeCloseTo(3.19, 1);
    expect(cell.grade).toBe("below-aa");
    // No policy in `contrast-matrix.test.ts` measures text on the brand fill.
    expect(rows.find((row) => row.pair.foreground === "brand-foreground")?.pair.kind).toBe("unchecked");
  });
});

describe("grading", () => {
  it.each([
    [4.4988, "below-aa", "4.49:1"],
    [4.5, "AA", "4.50:1"],
    [6.9988, "AA", "6.99:1"],
    [7, "AAA", "7.00:1"],
  ] as const)("grades %s:1 at full precision as %s and shows %s", (ratio, grade, shown) => {
    expect(contrastGrade(ratio)).toBe(grade);
    expect(formatRatio(ratio)).toBe(shown);
  });
});
