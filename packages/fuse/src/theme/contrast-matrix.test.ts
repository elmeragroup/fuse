import { describe, expect, it } from "vitest";

import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import {
  ACCORDION_MUTED_PAIRS,
  buildContrastMatrix,
  CONTROL_SURFACES,
  DARK_PANEL_TEXT_PAIRS,
  FEATURE_TEXT_PAIRS,
  ROLE_TEXT_PAIRS,
  TEXT_GRADE_PAIRS,
  tokenLiteral,
} from "./contrast";
import { LEGAL_THEMES, themeSlug } from "./theme-input";
import type { ThemeInput } from "./theme-input";
import { literalContrast, tokenOklch } from "./token-color";
import type { TokenName } from "./tokens/contract";

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

/** The chart marks that identify a series: the categorical slots, Other and the sentiments. */
const CHART_MARK_ROLES = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
  "chart-other",
  "chart-sentiment-positive",
  "chart-sentiment-negative",
] as const;

/** The `--sh-*` roles sugar-high paints code tokens with. */
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
 * `dialog`. Muted copy carries field and selection row descriptions, which can hold required
 * information.
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
    matches: (theme) => theme.identity === "neutral",
    pairs: FEATURE_TEXT_PAIRS,
    floor: 4.5,
  },
  {
    // Muted copy, such as a field description, in a default Accordion item, which fills with
    // `primary-soft`. Dark only: light measures 4.43:1 on the neutral default, 3.84:1 on fkas
    // and 4.22:1 on fkse, an accepted deviation the accessibility page lists.
    schemes: ["dark"],
    matches: () => true,
    pairs: ACCORDION_MUTED_PAIRS,
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
    // the same 1.1:1 floor as the menu row. The active default Tabs trigger fills with `card` on
    // its `muted` list, so in dark this floor is also all that separates the selected tab from the
    // list. Dark only: light muted is the shadcn 0.97 on a white card, 1.09:1, a design value this
    // floor does not override.
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
    // carries the row's state at 3:1, branded themes make the row edge transparent, and the
    // divider between stacked rows is decorative. Card and the `card` Accordion item draw
    // `--card-border`, which has no floor either: a card is a container, and branded themes
    // make its edge, and Card's `--card-shadow`, transparent. The line between a Card's stacked
    // sections, `--card-section-divider`, has none: it separates segments of one container, and
    // branded themes draw it in the page tint.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: [["border", "background"]],
    floor: 1.19,
  },
  {
    // Chart marks are graphical objects under WCAG 1.4.11, so each separates from every surface a
    // chart sits on at 3:1.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: roleOnSurfaces(CHART_MARK_ROLES),
    floor: 3,
  },
  {
    // The diverging midpoint paints every value near zero, such as a quarter-hour price just
    // below or above it, so it is a WCAG 1.4.11 graphical object at 3:1 on every surface.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: roleOnSurfaces(["chart-diverging-4"]),
    floor: 3,
  },
  {
    // The step of an ordinal scale nearest the surface still has to read as a mark, at 2:1: the
    // ramp's least step and each diverging arm's step beside the midpoint. The steps beyond them
    // contrast more.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: roleOnSurfaces(["chart-seq-1", "chart-diverging-3", "chart-diverging-5"]),
    floor: 2,
  },
  {
    // Code tokens on the surfaces Code's JSDoc names. Code paints no fill, so it reads on its
    // container's. The docs paint code blocks on `card` and the API panel's type signature on
    // `muted`.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: [...roleOnSurfaces(SYNTAX_ROLES), ...SYNTAX_ROLES.map((role) => [role, "muted"] as const)],
    floor: 4.5,
  },
  { schemes: ["dark"], matches: () => true, pairs: roleOnSurfaces(["input"]), floor: 3 },
  {
    // The focus ring, under WCAG 1.4.11. It is drawn flush against the control, so it must separate
    // from the page or card around the control and from the muted Tabs list track it sits on
    // inside the list padding. Light `input` stays out of this gate: it is the field border and
    // an accepted deviation.
    schemes: ["light", "dark"],
    matches: () => true,
    pairs: [...roleOnSurfaces(["ring"]), ["ring", "muted"]],
    floor: 3,
  },
  {
    // The unchecked Checkbox and Radio edge and the unchecked Switch edge and thumb, under WCAG 1.4.11.
    // Light `input` is the field border and stays under 3:1 as an accepted deviation, so the
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

/**
 * The text-grade pairs a neutral theme colors with its brand. The neutral identity takes each
 * brand's own `--brand` and sidebar brand, so these ratios differ per brand while the rest of the
 * neutral dark palette is one shared body.
 */
const BRAND_COLORED_PAIRS: ReadonlySet<string> = new Set([
  "brand-ink/background",
  "brand-ink/card",
  "sidebar-brand/sidebar",
  "sidebar-brand-foreground/sidebar-brand",
]);

/** One theme's matrix row, split into the brand-independent pairs and the brand-colored ones. */
function splitBrandPairs(
  row: Readonly<Record<string, number>>
): readonly [Record<string, number>, Record<string, number>] {
  const entries = Object.entries(row);
  return [
    Object.fromEntries(entries.filter(([pair]) => !BRAND_COLORED_PAIRS.has(pair))),
    Object.fromEntries(entries.filter(([pair]) => BRAND_COLORED_PAIRS.has(pair))),
  ];
}

describe("contrast matrix", () => {
  const lightMatrix = buildContrastMatrix();
  const darkMatrix = buildContrastMatrix("dark");

  it("snapshots text-grade pairs across the 24 themes", async () => {
    expect(LEGAL_THEMES).toHaveLength(24);
    expect(Object.keys(lightMatrix)).toHaveLength(24);
    await expect(lightMatrix).toMatchFileSnapshot("./__snapshots__/contrast-matrix.json");
  });

  it("snapshots the twelve neutral dark permutations as one shared body", async () => {
    const themes = LEGAL_THEMES.filter((theme) => theme.identity === "neutral");
    expect(themes).toHaveLength(12);
    const rows = themes.map((theme) => {
      const [shared, brandColored] = splitBrandPairs(darkMatrix[themeSlug(theme)]);
      return { slug: themeSlug(theme), shared, brandColored };
    });
    const [first] = rows;
    if (first === undefined) {
      throw new Error("No neutral themes are legal");
    }
    for (const { slug, shared } of rows) {
      // Neutral themes share one dark palette; a body that differs per brand fails.
      expect(shared, slug).toEqual(first.shared);
    }
    const body = first.shared;
    const brand = Object.fromEntries(rows.map(({ slug, brandColored }) => [slug, brandColored]));
    await expect({ themes: rows.map(({ slug }) => slug), body, brand }).toMatchFileSnapshot(
      "./__snapshots__/neutral-dark-contrast-matrix.json"
    );
  });

  it("snapshots the 12 branded dark themes", async () => {
    const themes = LEGAL_THEMES.filter((theme) => theme.identity === "branded");
    const branded = Object.fromEntries(
      themes.map((theme) => [themeSlug(theme), darkMatrix[themeSlug(theme)]])
    );
    expect(Object.keys(branded)).toHaveLength(12);
    await expect(branded).toMatchFileSnapshot("./__snapshots__/branded-dark-contrast-matrix.json");
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
              literalContrast(tokenLiteral(tokens, foreground), tokenLiteral(tokens, background)),
              `${scheme} ${slug} ${foreground}/${background}`
            ).toBeGreaterThanOrEqual(policy.floor);
          }
        }
      }
    }
  });

  it("files each role text pair by where its 4.5:1 floor holds", () => {
    // The docs palette inspector lists TEXT_GRADE_PAIRS as held in every theme and ROLE_TEXT_PAIRS
    // as held in some. The oracle is the policy table above: a role text pair belongs in
    // ROLE_TEXT_PAIRS only when its 4.5:1 floors cover some theme and scheme combinations but not
    // all of them. One covered everywhere is misfiled, and one covered nowhere has lost its floor.
    const combinations = (["light", "dark"] as const).flatMap((scheme) =>
      LEGAL_THEMES.map((theme) => ({ scheme, theme }))
    );
    const misfiled = ROLE_TEXT_PAIRS.filter(([foreground, background]) => {
      const covered = combinations.filter(({ scheme, theme }) =>
        CONTRAST_POLICIES.some(
          (policy) =>
            policy.floor >= 4.5 &&
            policy.schemes.includes(scheme) &&
            policy.matches(theme) &&
            policy.pairs.some(([fg, bg]) => fg === foreground && bg === background)
        )
      ).length;
      return covered === 0 || covered === combinations.length;
    }).map(([foreground, background]) => `${foreground}/${background}`);
    expect(misfiled).toEqual([]);
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
});
