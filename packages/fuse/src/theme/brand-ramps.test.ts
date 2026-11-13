import { describe, expect, it } from "vitest";

import type * as Oklch from "@elmeragroup/color/oklch";

import { composeTheme } from "./compose-theme";
import { tokenLiteral } from "./contrast";
import { LEGAL_THEMES, themeSlug } from "./theme-input";
import { tokenOklch } from "./token-color";
import { BRAND_RAMP_TOKEN_NAMES, HUE_SCALES, RAMP_SCALES, RAMP_STEPS } from "./tokens/brand-ramps";
import type { TokenContract } from "./tokens/contract";
import { DEFAULTS } from "./tokens/defaults";

/** The neutral roles issue #433 asks to follow the brand hue in every branded light theme. */
const NEUTRAL_ROLES = [
  "muted",
  "accent",
  "border",
  "input",
  "sidebar",
  "sidebar-accent",
  "sidebar-border",
  "right-panel",
] as const;

/** The chroma band of a grey tinted with a hue, as issue #433 sets it. */
const TINT_CHROMA = { min: 0.005, max: 0.02 } as const;

/** How far a tinted neutral's hue may sit from the brand hue, in degrees. */
const HUE_TOLERANCE = 1;

/** The distance between two hues in degrees, the short way round the circle. */
function hueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

/** A ramp step's colour, following the alias a single-colour brand's palette 2 step holds. */
function stepColor(tokens: TokenContract, name: (typeof BRAND_RAMP_TOKEN_NAMES)[number]): Oklch.Oklch {
  return tokenOklch(tokenLiteral(tokens, name));
}

describe("brand neutral ramp", () => {
  it("tints every branded light neutral role with the theme's feature hue at low chroma", () => {
    // Oracle: issue #433's acceptance criterion. The brand hue is the hue of the theme's own
    // curated `feature` role, and each neutral role is a grey at that hue with chroma 0.005-0.02.
    for (const theme of LEGAL_THEMES.filter((candidate) => candidate.identity === "branded")) {
      const tokens = composeTheme(theme, "light");
      const brandHue = tokenOklch(tokenLiteral(tokens, "feature")).h;
      for (const role of NEUTRAL_ROLES) {
        const color = tokenOklch(tokenLiteral(tokens, role));
        const where = `${themeSlug(theme)} ${role} ${tokenLiteral(tokens, role)}`;
        expect(color.c, where).toBeGreaterThanOrEqual(TINT_CHROMA.min);
        expect(color.c, where).toBeLessThanOrEqual(TINT_CHROMA.max);
        expect(hueDistance(color.h, brandHue), where).toBeLessThanOrEqual(HUE_TOLERANCE);
      }
    }
  });

  it("darkens at every step from 50 to 950, in the root and in every theme", () => {
    const ramps = [
      { where: "root", tokens: DEFAULTS },
      ...LEGAL_THEMES.map((theme) => ({ where: themeSlug(theme), tokens: composeTheme(theme) })),
    ];
    // Each scale on its own, in numeric step order, so one scale's 950 is never compared with
    // the next scale's 50.
    const steps = RAMP_STEPS.toSorted((left, right) => Number(left) - Number(right));
    for (const { where, tokens } of ramps) {
      for (const scale of RAMP_SCALES) {
        const names = steps.map((step) => `brand-${scale}-${step}` as const);
        for (const [index, name] of names.entries()) {
          const next = names[index + 1];
          if (next === undefined) continue;
          expect(stepColor(tokens, next).l, `${where} ${next}`).toBeLessThan(stepColor(tokens, name).l);
        }
      }
    }
  });

  it("holds one ramp per brand and segment, the same in both schemes and both identities", () => {
    for (const theme of LEGAL_THEMES.filter((candidate) => candidate.identity === "branded")) {
      const neutral = { ...theme, identity: "neutral" } as const;
      const compositions = [
        composeTheme(theme, "light"),
        composeTheme(theme, "dark"),
        composeTheme(neutral, "light"),
        composeTheme(neutral, "dark"),
      ];
      const [first, ...rest] = compositions.map((tokens) =>
        BRAND_RAMP_TOKEN_NAMES.map((name) => tokenLiteral(tokens, name))
      );
      for (const ramp of rest) {
        expect(ramp, themeSlug(theme)).toEqual(first);
      }
    }
  });
});

/** One brand's curated colours: palette 1's seed, and palette 2's where the brand has one. */
type CuratedSeeds = { readonly "1": string; readonly "2"?: string };

/**
 * The colours each brand curates, copied from where design set them, independent of the ramp
 * recipe. Palette 1 is each brand's light `feature` literal, with Fjordkraft company's teal for
 * its segment and `fkab`. Palette 2 is a brand's second colour, which only Telinet (its green, its
 * light `feature-foreground` before #432) and Gudbrandsdal Energi (its orange, its dark
 * `secondary`) have.
 */
const CURATED_SEEDS = new Map<string, CuratedSeeds>([
  ["fkas", { "1": "oklch(0.57866 0.19387 36.96)" }],
  ["fkas-company", { "1": "oklch(0.55738 0.06979 216.27)" }],
  ["tkas", { "1": "oklch(0.55688 0.09585 191.06)" }],
  ["guen", { "1": "oklch(0.57814 0.22881 270.38)", "2": "oklch(0.758638 0.1768149 60.637)" }], // #FF9100
  ["fkse", { "1": "oklch(0.56873 0.09344 229.37)", "2": "oklch(0.72225 0.16251 154.25)" }], // #36C275
  ["elma", { "1": "oklch(0.56464 0.048167 218.5)" }],
  ["ngfi", { "1": "oklch(0.496237 0.0877084 169.5466991)" }],
]);

/** The chroma under which a step is too grey for its hue to be read. */
const HUE_CHROMA_FLOOR = 0.02;

/**
 * The midtone steps, where every palette is chromatic: each must show the seed's hue, so a
 * palette that lost its colour fails rather than skipping every step.
 */
const MIDTONE_STEPS: ReadonlySet<string> = new Set(["400", "500", "600", "700"]);

describe("brand palettes", () => {
  const branded = LEGAL_THEMES.filter((candidate) => candidate.identity === "branded");
  const seedsOf = (theme: (typeof branded)[number]) => {
    const brand = theme.brand === "fkab" ? "fkas" : theme.brand;
    const seeds = CURATED_SEEDS.get(`${brand}-${theme.segment}`) ?? CURATED_SEEDS.get(brand);
    if (seeds === undefined) throw new Error(`no curated seeds for ${themeSlug(theme)}`);
    return seeds;
  };

  it("passes each palette through its curated seed and holds the seed's hue", () => {
    // Oracle: CURATED_SEEDS. Each palette holds its seed literal unchanged at one step, and its
    // steps show the seed's hue: every midtone step, and any other step chromatic enough to show
    // one, since near-white and near-black steps may lose their hue to gamut mapping.
    for (const theme of branded) {
      const tokens = composeTheme(theme);
      const seeds = seedsOf(theme);
      for (const scale of HUE_SCALES) {
        const seed = seeds[scale] ?? seeds["1"];
        const palette = `${themeSlug(theme)} brand-${scale}`;
        const values = RAMP_STEPS.map((step) => tokenLiteral(tokens, `brand-${scale}-${step}`));
        expect(values, palette).toContain(seed);
        const hue = tokenOklch(seed).h;
        for (const step of RAMP_STEPS) {
          const color = stepColor(tokens, `brand-${scale}-${step}`);
          const where = `${palette}-${step} ${tokenLiteral(tokens, `brand-${scale}-${step}`)}`;
          if (MIDTONE_STEPS.has(step)) {
            expect(color.c, where).toBeGreaterThanOrEqual(HUE_CHROMA_FLOOR);
          } else if (color.c < HUE_CHROMA_FLOOR) {
            continue;
          }
          expect(hueDistance(color.h, hue), where).toBeLessThanOrEqual(HUE_TOLERANCE);
        }
      }
    }
  });

  it("points a single-colour brand's palette 2 at its palette 1, step for step", () => {
    for (const theme of branded.filter((candidate) => seedsOf(candidate)["2"] === undefined)) {
      const tokens = composeTheme(theme);
      for (const step of RAMP_STEPS) {
        expect(tokens[`brand-2-${step}`], `${themeSlug(theme)} ${step}`).toBe(`var(--brand-1-${step})`);
      }
    }
  });

  it("paints Telinet's feature foreground from a step of palette 2", () => {
    // Issue #432: a role points at a palette and a step, not a colour.
    const tokens = composeTheme({ identity: "branded", brand: "fkse", segment: "private" });
    expect(tokens["feature-foreground"]).toMatch(/^var\(--brand-2-\d+\)$/);
  });
});
