import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { generatedBrandRamps } from "../../scripts/brand-ramp-recipe";
import { consumerBuild } from "../../test/tailwind-consumer-build";
import { resolveThemeCatalog } from "./catalog";
import type { ResolvedScheme } from "./catalog";
import { BRAND_RAMP_TOKEN_NAMES, GENERATED_BRAND_RAMPS, RAMP_STEPS } from "./tokens/brand-ramps";
import type { RampScale, RampStep } from "./tokens/brand-ramps";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The oracle: the ramps as read from the Figma brand collection on 2026-11-03, with the mode each
 * brand-and-segment theme takes. The test resolves the themes through the whole pipeline and
 * compares their colors with these hex values.
 */
type FigmaRampsFixture = {
  readonly modeToTheme: Readonly<Record<string, readonly string[]>>;
  readonly ramps: Readonly<
    Record<string, Readonly<Record<"neutrals" | "shades", Readonly<Record<string, string>>>>>
  >;
};
// SAFETY: the fixture is a verbatim copy of the Figma read, whose shape the type spells.
const FIGMA = JSON.parse(
  readFileSync(join(here, "../../test/fixtures/figma-brand-ramps.json"), "utf8")
) as FigmaRampsFixture;

const catalog = resolveThemeCatalog();
const FIXTURE_SCALES = { neutral: "neutrals", shade: "shades" } as const satisfies Record<RampScale, string>;

/** The hex a resolved ramp token paints, as Figma writes it. */
function hexOf(scheme: ResolvedScheme, scale: RampScale, step: RampStep): string {
  return Hex.formatOpaque(scheme.tokens[`brand-${scale}-${step}` as const].value);
}

function brandSegment(slug: string): string {
  return slug.split("-").slice(1).join("-");
}

describe("brand ramps", () => {
  it("resolve every Figma-sourced theme to the Figma brand collection's hex values", () => {
    let compared = 0;
    for (const [mode, brandSegments] of Object.entries(FIGMA.modeToTheme)) {
      const ramps = FIGMA.ramps[mode];
      if (ramps === undefined) continue;
      for (const theme of catalog.themes.filter((candidate) =>
        brandSegments.includes(brandSegment(candidate.slug))
      )) {
        for (const scale of ["neutral", "shade"] as const) {
          for (const step of RAMP_STEPS) {
            expect(hexOf(theme.schemes.light, scale, step), `${theme.slug} ${scale}-${step}`).toBe(
              ramps[FIXTURE_SCALES[scale]][step]
            );
            compared += 1;
          }
        }
      }
    }
    // Fjordkraft private, Bedrift (fkas and fkab company), Telinet, TrøndelagKraft and GE, in
    // both variants: 16 themes of 22 steps.
    expect(compared).toBe(16 * 22);
  });

  it("darken step by step in every theme", () => {
    for (const theme of catalog.themes) {
      for (const scale of ["neutral", "shade"] as const) {
        const lightness = RAMP_STEPS.map(
          (step) => Oklch.fromSrgb(theme.schemes.light.tokens[`brand-${scale}-${step}` as const].value).l
        );
        expect(lightness, `${theme.slug} ${scale}`).toEqual(
          lightness.toSorted((left, right) => right - left)
        );
        expect(new Set(lightness).size, `${theme.slug} ${scale}`).toBe(lightness.length);
      }
    }
  });

  it("resolve the same ramp in light and dark and in both variants", () => {
    for (const theme of catalog.themes) {
      const twin = catalog.themes.find(
        (candidate) =>
          candidate.input.brand === theme.input.brand && candidate.input.segment === theme.input.segment
      );
      for (const name of BRAND_RAMP_TOKEN_NAMES) {
        expect(theme.schemes.dark.tokens[name].value, `${theme.slug} ${name}`).toEqual(
          theme.schemes.light.tokens[name].value
        );
        expect(theme.schemes.light.tokens[name].value, `${theme.slug} ${name}`).toEqual(
          twin?.schemes.light.tokens[name].value
        );
      }
    }
  });

  it("pass a generated ramp through its brand primitive at its anchor step", () => {
    // `tokens/primitives.ts`: brand-elma and brand-ngfi.
    const anchors = [
      { brand: "elma", step: "900", primitive: "oklch(0.28898 0.051828 217.7)" },
      { brand: "ngfi", step: "800", primitive: "oklch(0.3671893 0.072708 169.9789644)" },
    ] as const;
    for (const { brand, step, primitive } of anchors) {
      expect(GENERATED_BRAND_RAMPS[brand].shade[step]).toBe(`var(--brand-${brand})`);
      const theme = catalog.themes.find((candidate) => candidate.input.brand === brand);
      expect(theme?.schemes.light.tokens[`brand-shade-${step}`].source).toEqual(
        getOrThrow(Oklch.parse(primitive))
      );
    }
  });

  it("commit the literals the generation recipe gives", () => {
    // A cross-check between the committed literals and the recipe in scripts/, so a Figma ramp
    // change that moves the medians shows here until the literals are printed again.
    expect(GENERATED_BRAND_RAMPS.elma).toEqual(generatedBrandRamps("elma"));
    expect(GENERATED_BRAND_RAMPS.ngfi).toEqual(generatedBrandRamps("ngfi"));
  });
});

describe("brand ramp utilities", () => {
  let css = "";
  beforeAll(async () => {
    css = await consumerBuild(["bg-brand-shade-500", "text-brand-neutral-900", "border-brand-shade-50"]);
  });

  it("exist in a Tailwind-source consumer's build", () => {
    expect(css).toMatch(/\.bg-brand-shade-500\s*\{[^}]*background-color:\s*var\(--brand-shade-500\)/u);
    expect(css).toMatch(/\.text-brand-neutral-900\s*\{[^}]*color:\s*var\(--brand-neutral-900\)/u);
    expect(css).toMatch(/\.border-brand-shade-50\s*\{[^}]*border-color:\s*var\(--brand-shade-50\)/u);
  });
});
