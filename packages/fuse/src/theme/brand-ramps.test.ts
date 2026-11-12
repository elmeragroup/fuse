import { describe, expect, it } from "vitest";

import { composeTheme } from "./compose-theme";
import { tokenLiteral } from "./contrast";
import { LEGAL_THEMES, themeSlug } from "./theme-input";
import { tokenOklch } from "./token-color";
import { BRAND_RAMP_TOKEN_NAMES, RAMP_SCALES, RAMP_STEPS } from "./tokens/brand-ramps";
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
          expect(tokenOklch(tokens[next]).l, `${where} ${next}`).toBeLessThan(tokenOklch(tokens[name]).l);
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
        BRAND_RAMP_TOKEN_NAMES.map((name) => tokens[name])
      );
      for (const ramp of rest) {
        expect(ramp, themeSlug(theme)).toEqual(first);
      }
    }
  });
});
