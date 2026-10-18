import { describe, expect, it } from "vitest";

import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { buildContrastMatrix, contrastRatio, TEXT_GRADE_PAIRS, tokenLiteral } from "./contrast";
import { resolveThemeCatalog } from "./resolve-theme-catalog";
import { tokenOklch } from "./token-color";
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

/**
 * Text on an alert's translucent status fill: `[text role, tint role]`. The destructive and
 * success Alert fill `bg-<status>/5` over whatever surface holds the alert, and both the title
 * and the body take the variant's text role: `error` on the destructive tint and `foreground`
 * on the success tint. The info and warning fills are opaque soft roles in TEXT_GRADE_PAIRS.
 */
const ALERT_TINT_TEXT_PAIRS = [
  ["error", "error"],
  ["foreground", "success"],
] as const;

/** The alpha of an alert's status tint, Tailwind's `/5`. */
const ALERT_TINT_ALPHA = 0.05;

/**
 * The surfaces a chart, syntax or control role must separate itself from: the page, the cards
 * and the modal fill.
 */
const CONTROL_SURFACES = ["background", "card", "card-soft", "dialog"] as const;

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
 * The text-grade pairs hold 4.5:1 in both schemes, `muted-foreground` among them on every
 * surface muted copy lands on: `background`, `muted`, `card`, `card-soft` and the modal fill,
 * `dialog`. Muted copy carries
 * field and selection row descriptions, which can hold required information.
 */
const CONTRAST_POLICIES: readonly ContrastPolicy[] = [
  {
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: TEXT_GRADE_PAIRS,
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
    // Muted copy, such as a field description, in a default Accordion item, which fills with
    // `primary-soft`. Dark only: light measures 4.43:1 on the internal default, 3.84:1 on fkas
    // and 4.17:1 on fkse, an accepted deviation the accessibility page lists until design picks
    // the light tones.
    schemes: ["dark"],
    matches: () => true,
    pairs: [["muted-foreground", "primary-soft"]],
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
    // `hover:bg-muted` over a card, popover or modal, such as a ghost Button in a Dialog, with
    // the same 1.1:1 floor as the menu row. Dark only: light muted is the shadcn 0.97 on a white
    // card, 1.09:1, a design value this floor does not yet override.
    schemes: ["dark"],
    matches: () => true,
    pairs: [
      ["muted", "popover"],
      ["muted", "card"],
      ["muted", "dialog"],
    ],
    floor: 1.1,
  },
  {
    // The `--border` hairline on the page: bare borders such as a Table row or DescriptionList
    // edge, the Separator line, and the edge `CheckboxCard` and the TextField `card` box keep. It
    // is not a 1.4.11 control boundary. The floor is elma light's measured 1.1994:1 rounded down;
    // below it the line stops reading on a tinted brand page. Selection rows draw
    // `--selection-border` and their dividers instead, which have no floor: the control inside
    // carries the row's state at 3:1, external themes make the row edge transparent, and the
    // divider between stacked rows is decorative. Card and the `card` Accordion item draw
    // `--card-border`, which has no floor either: a card is a container, and external themes
    // make its edge, and Card's `--card-shadow`, transparent. The line between a Card's stacked
    // sections, `--card-section-divider`, has none: it separates segments of one container, and
    // external themes draw it in the page tint.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: [["border", "background"]],
    floor: 1.19,
  },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(CHART_ROLES), floor: 3 },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(SYNTAX_ROLES), floor: 4.5 },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(["input"]), floor: 3 },
  {
    // The focus ring (WCAG 1.4.11). It is drawn flush against the control, so it must separate
    // from the page or card around the control and from the muted Tabs list track it sits on
    // inside the list padding. Light `input` stays out of this gate: it is the field border and
    // an accepted deviation.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: [...roleOnSurfaces(["ring"]), ["ring", "muted"]],
    floor: 3,
  },
  {
    // The unchecked Checkbox and Radio edge and the unchecked Switch edge and thumb (WCAG 1.4.11).
    // Light `input` is the field border and stays under 3:1 (an accepted deviation), so the
    // selection controls draw this role instead.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: roleOnSurfaces(["muted-foreground"]),
    floor: 3,
  },
  {
    // Status roles as text on the plain surfaces: the outline Badge arms, field errors and the
    // destructive and success typography arms draw `text-<status>` on the page, card and card-soft.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: roleOnSurfaces(["error", "info", "success", "warning"]),
    floor: 4.5,
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
              contrastRatio(tokenLiteral(tokens, foreground), tokenLiteral(tokens, background)),
              `${scheme} ${slug} ${foreground}/${background}`
            ).toBeGreaterThanOrEqual(policy.floor);
          }
        }
      }
    }
  });

  it("holds alert text at 4.5:1 on its 5% status tint over every surface, theme and scheme", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        const tokens = composeTheme(theme, scheme);
        for (const [text, tint] of ALERT_TINT_TEXT_PAIRS) {
          const tintColor = Oklch.toSrgb(tokenOklch(tokenLiteral(tokens, tint)));
          for (const surface of CONTROL_SURFACES) {
            // The browser paints `color-mix(in oklab, <tint> 5%, transparent)`, the tint at 5%
            // alpha, and composites it over the surface in sRGB.
            const fill = Srgb.compositeOver(
              getOrThrow(
                Srgb.make({ r: tintColor.r, g: tintColor.g, b: tintColor.b, alpha: ALERT_TINT_ALPHA })
              ),
              Oklch.toSrgb(tokenOklch(tokenLiteral(tokens, surface)))
            );
            expect
              .soft(
                getOrThrow(Wcag.contrastRatio(Oklch.toSrgb(tokenOklch(tokenLiteral(tokens, text))), fill)),
                `${scheme} ${themeSlug(theme)} ${text} on ${tint}/5 over ${surface}`
              )
              .toBeGreaterThanOrEqual(4.5);
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
