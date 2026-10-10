import { describe, expect, it } from "vitest";

import { getOrThrow } from "@elmeragroup/color/result";
import * as Wcag from "@elmeragroup/color/wcag";

import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { buildContrastMatrix, contrastRatio, TEXT_GRADE_PAIRS } from "./contrast";
import { resolveThemeCatalog } from "./resolve-theme-catalog";
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
 * The sidebar's brand pair: `text-sidebar-brand` on the sidebar, and text on a
 * `bg-sidebar-brand` fill. Either role may alias another, so the test reads them resolved.
 */
const SIDEBAR_BRAND_PAIRS = [
  ["sidebar-brand", "sidebar"],
  ["sidebar-brand-foreground", "sidebar-brand"],
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
  {
    // A menu row's hover tint over its popup. It is not a text pair, but a tint equal to the
    // popup hides which row is highlighted; 1.1:1 sits under the light default's 1.12:1.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: [["accent", "popover"]],
    floor: 1.1,
  },
  {
    // `hover:bg-muted` over a card or popover, such as a ghost Button in a Dialog, with the
    // same 1.1:1 floor as the menu row. Dark only: light muted is the shadcn 0.97 on a white
    // card, 1.09:1, a design value this floor does not yet override.
    schemes: ["dark"],
    matches: () => true,
    pairs: [
      ["muted", "popover"],
      ["muted", "card"],
    ],
    floor: 1.1,
  },
  {
    // The hairline every bare border draws on the page, such as a Card, Table or
    // DescriptionList edge. It is not a 1.4.11 control boundary. The floor is elma light's
    // measured 1.1994:1 rounded down; below it the line stops reading on a tinted brand page.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: [["border", "background"]],
    floor: 1.19,
  },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(CHART_ROLES), floor: 3 },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(SYNTAX_ROLES), floor: 4.5 },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(["input", "ring"]), floor: 3 },
  {
    // The unchecked Checkbox and Radio edge (WCAG 1.4.11). Light `input` is the field border and
    // stays under 3:1 (an accepted deviation), so the selection controls draw this role instead.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: roleOnSurfaces(["muted-foreground"]),
    floor: 3,
  },
];

describe("contrast matrix", () => {
  const lightMatrix = buildContrastMatrix();
  const darkMatrix = buildContrastMatrix("dark");

  it("snapshots text-grade pairs across the 24 themes", async () => {
    expect(LEGAL_THEMES).toHaveLength(24);
    expect(Object.keys(lightMatrix)).toHaveLength(24);
    await expect(lightMatrix).toMatchFileSnapshot("./__snapshots__/contrast-matrix.json");
  });

  it("snapshots the twelve internal dark permutations as one shared body", async () => {
    const themes = LEGAL_THEMES.filter((theme) => theme.variant === "internal");
    expect(themes).toHaveLength(12);
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

  it("snapshots the 12 external dark themes", async () => {
    const themes = LEGAL_THEMES.filter((theme) => theme.variant === "external");
    const external = Object.fromEntries(
      themes.map((theme) => [themeSlug(theme), darkMatrix[themeSlug(theme)]])
    );
    expect(Object.keys(external)).toHaveLength(12);
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

  it("holds the sidebar brand pair at 4.5:1 for every theme and color scheme", () => {
    for (const theme of resolveThemeCatalog().themes) {
      for (const scheme of ["light", "dark"] as const) {
        const tokens = theme.schemes[scheme].tokens;
        for (const [foreground, background] of SIDEBAR_BRAND_PAIRS) {
          expect
            .soft(
              getOrThrow(Wcag.contrastRatio(tokens[foreground].value, tokens[background].value)),
              `${scheme} ${theme.slug} ${foreground}/${background}`
            )
            .toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
