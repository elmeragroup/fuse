import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseCssBlocks, parseStyleRules } from "../../test/css-rules";
import type { CssDeclaration } from "../../test/css-rules";
import type { Density } from "./density";
import { generateThemesCss } from "./generate-css";
import { generateDemoStageDensityCss } from "./generate-demo-stage-css";
import { DENSITY_METRIC_NAMES, DENSITY_METRICS } from "./tokens/density-metrics";

const here = dirname(fileURLToPath(import.meta.url));
const fuseCss = readFileSync(join(here, "../styles/fuse.css"), "utf8");
const compiledCssPath = join(here, "../../dist/styles.css");
const packedRawCssPath = join(here, "../../dist/styles/fuse.css");
const demoStageCssPath = join(here, "../../dist/demo-stage-density.css");

/**
 * The `fuse.css` rule that declares each density's metrics. Dense is the `:root` default, and
 * comfortable overrides it on the rooted attribute.
 */
const DENSITY_SELECTORS = {
  dense: ":root",
  comfortable: ':root[data-density="comfortable"]',
} as const satisfies Record<Density, string>;

/** The prefixes of the density metric families: control, row, label and surface metrics. */
const DENSITY_METRIC_PREFIXES = ["control-", "row-", "label-", "surface-pad-", "surface-gap-"] as const;

/** A declaration of a density metric, by its family prefix. */
const isDensityMetric = (declaration: CssDeclaration): boolean =>
  DENSITY_METRIC_PREFIXES.some((prefix) => declaration.name.startsWith(prefix));

/** The declarations of the one `fuse.css` rule with this selector. */
function fuseCssRule(selector: string): CssDeclaration[] {
  const matching = parseStyleRules(fuseCss).filter((rule) => rule.selector === selector);
  expect(
    matching.map((rule) => rule.selector),
    `one ${selector} rule in fuse.css`
  ).toEqual([selector]);
  return matching[0]?.declarations ?? [];
}

/** What a density's rule must declare, in order, according to `DENSITY_METRICS`. */
function expectedDeclarations(density: Density): CssDeclaration[] {
  return DENSITY_METRIC_NAMES.map((name) => ({ name, value: DENSITY_METRICS[name][density] }));
}

describe("density CSS", () => {
  // This cross-check reads the hand-written fuse.css, and DENSITY_METRICS is the oracle it
  // must reproduce.
  it("declares exactly DENSITY_METRICS, dense on :root and comfortable on the rooted attribute, in no other block", () => {
    expect(fuseCssRule(DENSITY_SELECTORS.dense).filter(isDensityMetric)).toEqual(
      expectedDeclarations("dense")
    );
    expect(fuseCssRule(DENSITY_SELECTORS.comfortable)).toEqual(expectedDeclarations("comfortable"));

    // At-rule blocks such as @utility count as other blocks.
    const declaring = parseCssBlocks(fuseCss)
      .filter((block) => block.declarations.some(isDensityMetric))
      .map((block) => block.prelude);
    expect(declaring).toEqual([DENSITY_SELECTORS.dense, DENSITY_SELECTORS.comfortable]);
  });

  it("does not key density metrics on data-theme-variant or a nested attribute selector", () => {
    for (const prefix of DENSITY_METRIC_PREFIXES) {
      expect(fuseCss).not.toMatch(new RegExp(String.raw`\[data-theme-variant[^\]]*\][^{]*--${prefix}`, "s"));
    }
    expect(fuseCss).not.toMatch(/(?<!:root)\[data-density="comfortable"\]/);
  });

  it("does not enter generated theme CSS", () => {
    const css = generateThemesCss();
    for (const prefix of DENSITY_METRIC_PREFIXES) {
      expect(css).not.toContain(`--${prefix}`);
    }
    expect(css).not.toContain("data-density");
  });

  it("reaches both stylesheet distribution modes", () => {
    // This package inherits the root `test` task, which names `@elmeragroup/fuse#build`
    // directly, so both sheets are task-graph-guaranteed. A missing artifact is the
    // failure, not a reason to skip.
    expect(existsSync(compiledCssPath), compiledCssPath).toBe(true);
    expect(existsSync(packedRawCssPath), packedRawCssPath).toBe(true);
    const compiled = readFileSync(compiledCssPath, "utf8");
    const packedRaw = readFileSync(packedRawCssPath, "utf8");
    expect(compiled).toContain("--control-h-md");
    expect(compiled).toContain("--surface-pad-lg");
    expect(compiled).toContain(':root[data-density="comfortable"]');
    expect(packedRaw).toContain("--control-h-md");
    expect(packedRaw).toContain("--surface-pad-lg");
    expect(packedRaw).toContain(':root[data-density="comfortable"]');
  });
});

/** The `fuse.css` rule a density's demo-stage block re-scopes: dense lives on `:root` beside other metrics. */
function libraryDensityRule(density: Density): CssDeclaration[] {
  return fuseCssRule(DENSITY_SELECTORS[density]).filter(isDensityMetric);
}

/** The demo-stage blocks the hand-written fuse.css density rules require, in emitted order. */
function expectedStageRules(): { selector: string; declarations: CssDeclaration[] }[] {
  return [
    { selector: '[data-demo-stage][data-density="dense"]', declarations: libraryDensityRule("dense") },
    {
      selector: '[data-demo-stage][data-density="comfortable"]',
      declarations: libraryDensityRule("comfortable"),
    },
  ];
}

// The generator reads DENSITY_METRICS, so these tests take the hand-written fuse.css density
// blocks as the oracle the demo stage must reproduce under its own selectors.
describe("DemoStage density artifact", () => {
  it("re-scopes the library dense and comfortable blocks onto [data-demo-stage]", () => {
    expect(parseStyleRules(generateDemoStageDensityCss())).toEqual(expectedStageRules());
  });

  it("is emitted next to themes.css with every metric of both densities", () => {
    // Guaranteed by the root `test` task's direct `@elmeragroup/fuse#build` dependency.
    expect(existsSync(demoStageCssPath), demoStageCssPath).toBe(true);
    const rules = parseStyleRules(readFileSync(demoStageCssPath, "utf8"));
    expect(rules).toEqual(expectedStageRules());
    const metric = (density: Density) =>
      rules
        .find((rule) => rule.selector === `[data-demo-stage][data-density="${density}"]`)
        ?.declarations.find((declaration) => declaration.name === "control-h-md")?.value;
    expect(metric("dense")).toBe("2.25rem");
    expect(metric("comfortable")).toBe("2.75rem");
  });
});
