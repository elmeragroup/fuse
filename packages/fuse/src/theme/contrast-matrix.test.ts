import { describe, expect, it } from "vitest";

import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { contrastRatio } from "./contrast";
import { buildContrastMatrix, TEXT_GRADE_PAIRS } from "./contrast-matrix";
import type { TokenName } from "./tokens/contract";
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
 * The filled-feature pair. The external Figma dark sheets choose their own feature colors and
 * do not meet the text floor; the internal dark palette is held to it.
 */
const FEATURE_TEXT_PAIRS = [
  ["feature-foreground", "feature"],
  ["feature-foreground", "feature-bright"],
] as const;

/** The surfaces a chart, syntax or control role must separate itself from. */
const CONTROL_SURFACES = ["background", "card", "card-soft"] as const;

const CHART_ROLES = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
] as const;

const SYNTAX_ROLES = [
  "sh-identifier",
  "sh-keyword",
  "sh-string",
  "sh-class",
  "sh-property",
  "sh-entity",
  "sh-jsxliterals",
  "sh-sign",
  "sh-comment",
] as const;

/** Every role/surface pair for the given roles, in policy order. */
function roleOnSurfaces(roles: readonly TokenName[]): readonly (readonly [TokenName, TokenName])[] {
  return roles.flatMap((role) => CONTROL_SURFACES.map((surface) => [role, surface] as const));
}

/** One contrast floor: every pair is measured on each theme the policy matches. */
type ContrastPolicy = {
  /** The color schemes the policy measures. */
  readonly schemes: readonly ResolvedColorScheme[];

  /** The themes the policy measures. */
  readonly matches: (theme: ThemeInput) => boolean;

  /** The foreground/background role pairs the floor applies to. */
  readonly pairs: readonly (readonly [TokenName, TokenName])[];

  /** The WCAG ratio every pair must reach. */
  readonly floor: number;
};

/**
 * `muted-foreground` copy is classified by the accessibility deviations instead of the blanket
 * 4.5:1 text-grade floor in light: the shared internal light default measures 4.35:1 on `muted`
 * and 4.74:1 on `background`, and Telinet's locked light palette measures 4.35:1 on `muted` and
 * 4.41:1 on `background` (documented deviation 4). Every dark theme holds 4.5:1.
 */
const CONTRAST_POLICIES: readonly ContrastPolicy[] = [
  {
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: TEXT_GRADE_PAIRS.filter(([foreground]) => foreground !== "muted-foreground"),
    floor: 4.5,
  },
  {
    schemes: ["light"],
    matches: (theme) => theme.variant === "internal",
    pairs: [["muted-foreground", "muted"]],
    floor: 4.3,
  },
  {
    schemes: ["light"],
    matches: (theme) => theme.variant === "internal",
    pairs: [["muted-foreground", "background"]],
    floor: 4.45,
  },
  {
    schemes: ["light"],
    matches: (theme) => theme.variant === "external" && theme.brand !== "fkse",
    pairs: [
      ["muted-foreground", "muted"],
      ["muted-foreground", "background"],
    ],
    floor: 4.5,
  },
  {
    schemes: ["light"],
    matches: (theme) => theme.variant === "external" && theme.brand === "fkse",
    pairs: [
      ["muted-foreground", "muted"],
      ["muted-foreground", "background"],
    ],
    floor: 4.3,
  },
  {
    schemes: ["dark"],
    matches: () => true,
    pairs: [
      ["muted-foreground", "muted"],
      ["muted-foreground", "background"],
    ],
    floor: 4.5,
  },
  {
    schemes: ["dark"],
    matches: () => true,
    pairs: DARK_PANEL_TEXT_PAIRS,
    floor: 4.5,
  },
  {
    schemes: ["dark"],
    matches: (theme) => theme.variant === "internal",
    pairs: FEATURE_TEXT_PAIRS,
    floor: 4.5,
  },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(CHART_ROLES), floor: 3 },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(SYNTAX_ROLES), floor: 4.5 },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(["input", "ring"]), floor: 3 },
];

describe("contrast matrix", () => {
  const lightMatrix = buildContrastMatrix();
  const darkMatrix = buildContrastMatrix("dark");

  it("snapshots text-grade pairs across the 20 themes", async () => {
    expect(LEGAL_THEMES).toHaveLength(20);
    expect(Object.keys(lightMatrix)).toHaveLength(20);
    await expect(lightMatrix).toMatchFileSnapshot("./__snapshots__/contrast-matrix.json");
  });

  it("snapshots the ten internal dark permutations as one shared body", async () => {
    const themes = LEGAL_THEMES.filter((theme) => theme.variant === "internal");
    expect(themes).toHaveLength(10);
    const [firstTheme] = themes;
    if (firstTheme === undefined) {
      throw new Error("No internal themes are legal");
    }
    const body = darkMatrix[themeSlug(firstTheme)];
    for (const theme of themes) {
      // Internal themes share one dark palette; a body drifting per brand is a contract break.
      expect(darkMatrix[themeSlug(theme)], themeSlug(theme)).toEqual(body);
    }
    await expect({ themes: themes.map(themeSlug), body }).toMatchFileSnapshot(
      "./__snapshots__/internal-dark-contrast-matrix.json"
    );
  });

  it("snapshots the 10 external dark themes", async () => {
    const themes = LEGAL_THEMES.filter((theme) => theme.variant === "external");
    const external = Object.fromEntries(
      themes.map((theme) => [themeSlug(theme), darkMatrix[themeSlug(theme)]])
    );
    expect(Object.keys(external)).toHaveLength(10);
    await expect(external).toMatchFileSnapshot("./__snapshots__/external-dark-contrast-matrix.json");
  });

  it("holds every contrast floor for every theme and color scheme", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        const slug = themeSlug(theme);
        const tokens = composeTheme(theme, scheme);
        for (const policy of CONTRAST_POLICIES) {
          if (!policy.schemes.includes(scheme) || !policy.matches(theme)) continue;
          for (const [foreground, background] of policy.pairs) {
            expect(
              contrastRatio(tokens[foreground], tokens[background]),
              `${scheme} ${slug} ${foreground}/${background}`
            ).toBeGreaterThanOrEqual(policy.floor);
          }
        }
      }
    }
  });
});
