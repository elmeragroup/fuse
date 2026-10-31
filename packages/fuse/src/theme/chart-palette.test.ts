import { describe, expect, it } from "vitest";

import * as Cvd from "@elmeragroup/color/cvd";
import * as Oklab from "@elmeragroup/color/oklab";
import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";
import type { Srgb } from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { CONTROL_SURFACES, tokenLiteral } from "./contrast";
import { tokenOklch } from "./token-color";
import type { TokenContract, TokenName } from "./tokens/contract";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

// Unit under test: the composed chart roles of every legal theme in both schemes. Oracle: the
// fixed gates of the dataviz skill's palette validator and its color formula, which state ΔE as
// Euclidean OKLab distance times 100 and CVD as Machado 2009 at severity 1.0. None of them
// derives from the tokens, and changing one is a design decision rather than a test fix.
// `contrast-matrix.test.ts` owns the WCAG floors of the same roles.
const GATE = {
  /** OKLCH lightness band per scheme for a slot that identifies a series. */
  band: { light: [0.43, 0.77], dark: [0.48, 0.67] },
  /** OKLCH chroma below which a hue reads as grey. */
  chromaFloor: 0.1,
  /** CVD ΔE, the smaller of protan and deutan, on a pair that must stay apart. */
  cvdTarget: 8,
  /** Unsimulated ΔE on the same pairs. */
  normalFloor: 15,
  /** Adjacent OKLCH lightness step of an ordinal scale. */
  ordinalStep: 0.06,
  /** Widest hue spread, in degrees, of a one-hue scale. */
  singleHue: 40,
  /** Unsimulated ΔE that keeps Other apart from every slot in a legend. */
  otherNormal: 10,
} as const;

const CATEGORICAL = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
] as const satisfies readonly TokenName[];

const SENTIMENT = [
  "chart-sentiment-positive",
  "chart-sentiment-negative",
] as const satisfies readonly TokenName[];

const SEQUENTIAL = [
  "chart-seq-1",
  "chart-seq-2",
  "chart-seq-3",
  "chart-seq-4",
  "chart-seq-5",
  "chart-seq-6",
  "chart-seq-7",
] as const satisfies readonly TokenName[];

/** Each diverging arm from the midpoint outward, so magnitude grows along the list. */
const DIVERGING_ARMS = {
  negative: ["chart-diverging-3", "chart-diverging-2", "chart-diverging-1"],
  positive: ["chart-diverging-5", "chart-diverging-6", "chart-diverging-7"],
} as const satisfies Record<string, readonly TokenName[]>;

/** Slot pairs `offset` apart on the cycle 1-2-…-8-1. */
function slotPairs(offset: number) {
  return CATEGORICAL.map((_, index) => [index, (index + offset) % CATEGORICAL.length] as const);
}

/** Neighbours on the cycle, so pies and every start offset stay legal. */
const CYCLIC_PAIRS = slotPairs(1);

/** Slots two apart. With the neighbours they are every pair inside a 3-slot window. */
const SKIP_PAIRS = slotPairs(2);

const SCHEMES = ["light", "dark"] as const satisfies readonly ResolvedColorScheme[];

/** The entry at `index`, which every caller below knows exists. */
function at<T>(list: readonly T[], index: number): T {
  const entry = list[index];
  if (entry === undefined) {
    throw new Error(`No entry at ${String(index)}`);
  }
  return entry;
}

/** The validator's single-hue spread: the hue range, folded the short way round past 180°. */
function hueSpread(colors: readonly Srgb[]): number {
  const hues = colors.map((color) => Oklch.fromSrgb(color).h);
  const spread = Math.max(...hues) - Math.min(...hues);
  return spread > 180 ? 360 - spread : spread;
}

/** The lightness gaps along a scale, positive where magnitude grows away from the surface. */
function lightnessSteps(scheme: ResolvedColorScheme, scale: readonly Srgb[]): number[] {
  const lightness = scale.map((color) => Oklch.fromSrgb(color).l);
  return lightness.slice(1).map((step, index) => {
    const previous = at(lightness, index);
    return scheme === "light" ? previous - step : step - previous;
  });
}

type Distance = { readonly label: string; readonly normal: number; readonly cvd: number };

function distance(label: string, left: Srgb, right: Srgb): Distance {
  return { label, normal: Oklab.deltaE(left, right), cvd: Cvd.deltaE(left, right) };
}

function slotDistance(slots: readonly Srgb[], left: number, right: number): Distance {
  return distance(`${String(left + 1)}↔${String(right + 1)}`, at(slots, left), at(slots, right));
}

/** Every measurement the gates and the snapshot read, for one theme in one scheme. */
function measure(scheme: ResolvedColorScheme, tokens: TokenContract) {
  const read = (name: TokenName): Srgb => Oklch.toSrgb(tokenOklch(tokenLiteral(tokens, name)));
  const surfaces = CONTROL_SURFACES.map(read);
  const lowestContrast = (color: Srgb): number =>
    Math.min(...surfaces.map((surface) => getOrThrow(Wcag.contrastRatio(color, surface))));
  const slots = CATEGORICAL.map(read);
  const negative = DIVERGING_ARMS.negative.map(read);
  const positive = DIVERGING_ARMS.positive.map(read);
  const midpoint = read("chart-diverging-4");
  const sequential = SEQUENTIAL.map(read);
  const other = read("chart-other");
  return {
    identities: [...CATEGORICAL, ...SENTIMENT].map((name) => {
      const { l, c } = Oklch.fromSrgb(read(name));
      return { name, l, c };
    }),
    cyclicPairs: CYCLIC_PAIRS.map(([left, right]) => slotDistance(slots, left, right)),
    skipPairs: SKIP_PAIRS.map(([left, right]) => slotDistance(slots, left, right)),
    sentiment: distance("sentiment", read(SENTIMENT[0]), read(SENTIMENT[1])),
    sequentialSteps: lightnessSteps(scheme, sequential),
    sequentialHueSpread: hueSpread(sequential),
    armSteps: [...lightnessSteps(scheme, negative), ...lightnessSteps(scheme, positive)],
    armHueSpreads: [hueSpread(negative), hueSpread(positive)],
    equalSteps: negative.map((step, index) =>
      distance(`step ${String(index + 1)}`, step, at(positive, index))
    ),
    midpointChroma: Oklch.fromSrgb(midpoint).c,
    midpointToArms: [at(negative, 0), at(positive, 0)].map((inner) => Oklab.deltaE(midpoint, inner)),
    otherToSlots: slots.map((slot) => Oklab.deltaE(other, slot)),
    lowestSlotContrast: Math.min(...slots.map(lowestContrast)),
    firstStepContrast: lowestContrast(at(sequential, 0)),
    lowestOtherContrast: lowestContrast(other),
  };
}

const RUNS = SCHEMES.flatMap((scheme) =>
  LEGAL_THEMES.map((theme) => ({
    scheme,
    slug: themeSlug(theme),
    measured: measure(scheme, composeTheme(theme, scheme)),
  }))
);

type Measured = ReturnType<typeof measure>;

const round = (value: number, digits: number): number => Number(value.toFixed(digits));
const worst = (values: readonly number[], digits: number): number => round(Math.min(...values), digits);

/** The worst ΔE of `pairs` under `key`, rounded to one decimal for the snapshot. */
const worstOf = (pairs: readonly Distance[], key: "normal" | "cvd"): number =>
  worst(
    pairs.map((pair) => pair[key]),
    1
  );

/** The worst margin of every gate, rounded, the row the snapshot records. */
function snapshotRow(measured: Measured) {
  const cyclic = measured.cyclicPairs;
  const window = [...cyclic, ...measured.skipPairs];
  return {
    categorical: {
      cyclicCvd: worstOf(cyclic, "cvd"),
      cyclicNormal: worstOf(cyclic, "normal"),
      windowCvd: worstOf(window, "cvd"),
      windowNormal: worstOf(window, "normal"),
      lowestContrast: round(measured.lowestSlotContrast, 2),
    },
    sequential: {
      smallestStep: worst(measured.sequentialSteps, 3),
      hueSpread: round(measured.sequentialHueSpread, 1),
      firstStepContrast: round(measured.firstStepContrast, 2),
    },
    diverging: {
      smallestStep: worst(measured.armSteps, 3),
      equalStepCvd: worstOf(measured.equalSteps, "cvd"),
      equalStepNormal: worstOf(measured.equalSteps, "normal"),
      midpointNormal: worst(measured.midpointToArms, 1),
    },
    sentiment: { cvd: round(measured.sentiment.cvd, 1), normal: round(measured.sentiment.normal, 1) },
    other: {
      normal: worst(measured.otherToSlots, 1),
      lowestContrast: round(measured.lowestOtherContrast, 2),
    },
  };
}

function expectApart(pair: Distance): void {
  expect.soft(pair.normal, `${pair.label} normal`).toBeGreaterThanOrEqual(GATE.normalFloor);
  expect.soft(pair.cvd, `${pair.label} CVD`).toBeGreaterThanOrEqual(GATE.cvdTarget);
}

describe("chart palette", () => {
  for (const { scheme, slug, measured } of RUNS) {
    const [low, high] = GATE.band[scheme];

    it(`${scheme} ${slug}: every categorical slot and sentiment role sits in the band and above the chroma floor`, () => {
      for (const { name, l, c } of measured.identities) {
        expect.soft(l, `${name} lightness`).toBeGreaterThanOrEqual(low);
        expect.soft(l, `${name} lightness`).toBeLessThanOrEqual(high);
        expect.soft(c, `${name} chroma`).toBeGreaterThanOrEqual(GATE.chromaFloor);
      }
    });

    it(`${scheme} ${slug}: cyclic neighbours, 3-slot windows and the sentiment pair separate in normal and CVD vision`, () => {
      for (const pair of [...measured.cyclicPairs, ...measured.skipPairs, measured.sentiment]) {
        expectApart(pair);
      }
    });

    it(`${scheme} ${slug}: the sequential ramp and each diverging arm are one hue and step visibly`, () => {
      for (const step of [...measured.sequentialSteps, ...measured.armSteps]) {
        expect.soft(step, "lightness step").toBeGreaterThanOrEqual(GATE.ordinalStep);
      }
      for (const spread of [measured.sequentialHueSpread, ...measured.armHueSpreads]) {
        expect.soft(spread, "hue spread").toBeLessThanOrEqual(GATE.singleHue);
      }
    });

    it(`${scheme} ${slug}: equal diverging steps separate, and the midpoint is a grey apart from both arms`, () => {
      for (const pair of measured.equalSteps) {
        expectApart(pair);
      }
      expect.soft(measured.midpointChroma, "midpoint chroma").toBeLessThan(GATE.chromaFloor);
      for (const normal of measured.midpointToArms) {
        expect.soft(normal, "midpoint to the inner step").toBeGreaterThanOrEqual(GATE.normalFloor);
      }
    });

    it(`${scheme} ${slug}: Other stands apart from every slot`, () => {
      measured.otherToSlots.forEach((normal, index) => {
        expect.soft(normal, `Other to ${at(CATEGORICAL, index)}`).toBeGreaterThanOrEqual(GATE.otherNormal);
      });
    });
  }

  it("snapshots the worst margin of every gate per theme and scheme", async () => {
    const rows = Object.fromEntries(
      RUNS.map((run) => [`${run.scheme} ${run.slug}`, snapshotRow(run.measured)])
    );
    expect(Object.keys(rows)).toHaveLength(48);
    await expect(rows).toMatchFileSnapshot("./__snapshots__/chart-palette.json");
  });
});
