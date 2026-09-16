import { describe, expect, it } from "vitest";

import { composeTheme } from "./compose-theme";
import { buildContrastMatrix, contrastRatio, pairId, TEXT_GRADE_PAIRS } from "./contrast";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";
import type { ThemeInput } from "./tokens/themes";

/**
 * Dark-only panel pairs. `TEXT_GRADE_PAIRS` covers the roles every theme pairs with a surface;
 * these cover the popup, accent, sidebar and right-panel roles both variants render in dark.
 */
const DARK_PANEL_TEXT_PAIRS = [
  ["popover-foreground", "popover"],
  ["accent-foreground", "accent"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["right-panel-foreground", "right-panel"],
] as const;

/**
 * `muted-foreground` copy is classified by the accessibility deviations instead of the blanket
 * 4.5:1 text-grade floor: the shared internal light default measures 4.35:1 on `muted` and
 * 4.74:1 on `background`, and Telinet's locked light palette measures 4.35:1 on `muted` and
 * 4.41:1 on `background` (documented deviation 4). Every other theme/pair combination is owed
 * the full floor.
 */
const MUTED_FOREGROUND_POLICY = [
  {
    matches: (theme: ThemeInput): boolean => theme.variant === "internal",
    pairs: [["muted-foreground", "muted"]],
    floor: 4.3,
  },
  {
    matches: (theme: ThemeInput): boolean => theme.variant === "internal",
    pairs: [["muted-foreground", "background"]],
    floor: 4.45,
  },
  {
    matches: (theme: ThemeInput): boolean => theme.variant === "external" && theme.brand !== "fkse",
    pairs: [
      ["muted-foreground", "muted"],
      ["muted-foreground", "background"],
    ],
    floor: 4.5,
  },
  {
    matches: (theme: ThemeInput): boolean => theme.variant === "external" && theme.brand === "fkse",
    pairs: [
      ["muted-foreground", "muted"],
      ["muted-foreground", "background"],
    ],
    floor: 4.3,
  },
] as const satisfies readonly {
  matches: (theme: ThemeInput) => boolean;
  pairs: readonly (readonly ["muted-foreground", "muted" | "background"])[];
  floor: number;
}[];

describe("contrast matrix", () => {
  const matrix = buildContrastMatrix();

  it("snapshots text-grade pairs across the 20 themes", async () => {
    expect(LEGAL_THEMES).toHaveLength(20);
    expect(Object.keys(matrix)).toHaveLength(20);
    await expect(matrix).toMatchFileSnapshot("./__snapshots__/contrast-matrix.json");
  });

  it("meets 4.5:1 on text-grade pairs that are not the muted-foreground classification", () => {
    for (const theme of LEGAL_THEMES) {
      const slug = themeSlug(theme);
      const row = matrix[slug];
      for (const [foreground, background] of TEXT_GRADE_PAIRS) {
        if (foreground === "muted-foreground") continue;
        const id = pairId(foreground, background);
        expect(row[id], `${slug} ${id}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const { matches, pairs, floor } of MUTED_FOREGROUND_POLICY) {
        if (!matches(theme)) continue;
        for (const [foreground, background] of pairs) {
          const id = pairId(foreground, background);
          expect(row[id], `${slug} ${id}`).toBeGreaterThanOrEqual(floor);
        }
      }
    }
  });
});

describe("internal dark contrast matrix", () => {
  const themes = LEGAL_THEMES.filter((theme) => theme.variant === "internal");

  it("keeps input boundaries, focus rings and all chart colors at 3:1 on supported surfaces", () => {
    for (const theme of themes) {
      const tokens = composeTheme(theme, "dark");
      for (const role of [
        "input",
        "ring",
        "chart-1",
        "chart-2",
        "chart-3",
        "chart-4",
        "chart-5",
        "chart-6",
        "chart-7",
        "chart-8",
      ] as const) {
        for (const surface of ["background", "card", "card-soft"] as const) {
          expect(contrastRatio(tokens[role], tokens[surface]), `${role}/${surface}`).toBeGreaterThanOrEqual(
            3
          );
        }
      }
    }
  });

  it("snapshots the ten internal dark permutations", async () => {
    const matrix = buildContrastMatrix("dark");
    const internal = Object.fromEntries(themes.map((theme) => [themeSlug(theme), matrix[themeSlug(theme)]]));
    expect(Object.keys(internal)).toHaveLength(10);
    await expect(internal).toMatchFileSnapshot("./__snapshots__/internal-dark-contrast-matrix.json");
  });

  it("meets 4.5:1 for paired text and syntax on supported dark panels", () => {
    for (const theme of themes) {
      const tokens = composeTheme(theme, "dark");
      for (const [foreground, background] of [
        ...TEXT_GRADE_PAIRS,
        ...DARK_PANEL_TEXT_PAIRS,
        ["feature-foreground", "feature"],
        ["feature-foreground", "feature-bright"],
      ] as const) {
        expect(
          contrastRatio(tokens[foreground], tokens[background]),
          `${themeSlug(theme)} ${foreground}/${background}`
        ).toBeGreaterThanOrEqual(4.5);
      }
      for (const syntax of [
        "sh-identifier",
        "sh-keyword",
        "sh-string",
        "sh-class",
        "sh-property",
        "sh-entity",
        "sh-jsxliterals",
        "sh-sign",
        "sh-comment",
      ] as const) {
        for (const panel of ["background", "card", "card-soft"] as const) {
          expect(contrastRatio(tokens[syntax], tokens[panel]), `${syntax}/${panel}`).toBeGreaterThanOrEqual(
            4.5
          );
        }
      }
    }
  });
});

describe("external dark contrast matrix", () => {
  const matrix = buildContrastMatrix("dark");
  const themes = LEGAL_THEMES.filter((theme) => theme.variant === "external");

  it("snapshots the 10 external dark themes", async () => {
    const external = Object.fromEntries(themes.map((theme) => [themeSlug(theme), matrix[themeSlug(theme)]]));
    expect(Object.keys(external)).toHaveLength(10);
    await expect(external).toMatchFileSnapshot("./__snapshots__/external-dark-contrast-matrix.json");
  });

  it("meets the text-grade floor for dark roles including muted copy and shared panels", () => {
    for (const theme of themes) {
      const slug = themeSlug(theme);
      const tokens = composeTheme(theme, "dark");
      for (const [foreground, background] of TEXT_GRADE_PAIRS) {
        const pair = pairId(foreground, background);
        expect(
          contrastRatio(tokens[foreground], tokens[background]),
          `${slug} ${pair}`
        ).toBeGreaterThanOrEqual(4.5);
      }
      for (const [foreground, background] of DARK_PANEL_TEXT_PAIRS) {
        expect(
          contrastRatio(tokens[foreground], tokens[background]),
          `${slug} ${foreground}/${background}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps input boundaries and focus rings at 3:1 on the dark control surfaces", () => {
    for (const theme of themes) {
      const tokens = composeTheme(theme, "dark");
      for (const foreground of ["input", "ring"] as const) {
        for (const background of ["background", "card", "card-soft"] as const) {
          expect(
            contrastRatio(tokens[foreground], tokens[background]),
            `${themeSlug(theme)} ${foreground}/${background}`
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
