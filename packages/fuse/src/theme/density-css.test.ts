import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseCssBlocks, parseStyleRules } from "../../test/css-rules";
import type { CssDeclaration } from "../../test/css-rules";
import type { Density } from "./density";
import { generateThemesCss } from "./generate-css";
import { DEMO_STAGE_COMFORTABLE_SELECTOR, generateDemoStageComfortableCss } from "./generate-demo-stage-css";
import { EXTERNAL_RESET_KEYS, TOKEN_NAMES } from "./tokens/contract";
import { DENSITY_METRIC_NAMES, DENSITY_METRICS, DENSITY_SELECTORS } from "./tokens/density-metrics";

const here = dirname(fileURLToPath(import.meta.url));
const fuseCss = readFileSync(join(here, "../styles/fuse.css"), "utf8");
const compiledCssPath = join(here, "../../dist/styles.css");
const packedRawCssPath = join(here, "../../dist/styles/fuse.css");
const demoStageCssPath = join(here, "../../dist/demo-stage-comfortable.css");

const isControlMetric = (declaration: CssDeclaration): boolean => declaration.name.startsWith("control-");

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
  it("declares exactly DENSITY_METRICS, dense on :root and comfortable on the rooted attribute", () => {
    expect(fuseCssRule(DENSITY_SELECTORS.dense).filter(isControlMetric)).toEqual(
      expectedDeclarations("dense")
    );
    expect(fuseCssRule(DENSITY_SELECTORS.comfortable)).toEqual(expectedDeclarations("comfortable"));
  });

  it("declares control metrics in no other block, at-rule blocks such as @utility included", () => {
    const declaring = parseCssBlocks(fuseCss)
      .filter((block) => block.declarations.some(isControlMetric))
      .map((block) => block.prelude);
    expect(declaring).toEqual([DENSITY_SELECTORS.dense, DENSITY_SELECTORS.comfortable]);
  });

  it("does not key density metrics on data-theme-variant or a nested attribute selector", () => {
    expect(fuseCss).not.toMatch(/\[data-theme-variant[^\]]*\][^{]*--control-/s);
    expect(fuseCss).not.toMatch(/(?<!:root)\[data-density="comfortable"\]/);
  });

  it("never enters TOKEN_NAMES or EXTERNAL_RESET_KEYS", () => {
    for (const name of DENSITY_METRIC_NAMES) {
      expect(TOKEN_NAMES).not.toContain(name);
      expect(EXTERNAL_RESET_KEYS).not.toContain(name);
    }
  });

  it("does not enter generated theme CSS", () => {
    const css = generateThemesCss();
    expect(css).not.toContain("--control-");
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
    expect(compiled).toContain(':root[data-density="comfortable"]');
    expect(packedRaw).toContain("--control-h-md");
    expect(packedRaw).toContain(':root[data-density="comfortable"]');
  });
});

// The generator reads DENSITY_METRICS, so these tests take the hand-written fuse.css
// comfortable block as the oracle the demo stage must reproduce under its own selector.
describe("DemoStage comfortable density artifact", () => {
  it("re-scopes the library comfortable block onto [data-demo-stage]", () => {
    expect(parseStyleRules(generateDemoStageComfortableCss())).toEqual([
      {
        selector: '[data-demo-stage][data-density="comfortable"]',
        declarations: fuseCssRule(DENSITY_SELECTORS.comfortable),
      },
    ]);
  });

  it("is emitted next to themes.css with every comfortable metric", () => {
    // Guaranteed by the root `test` task's direct `@elmeragroup/fuse#build` dependency.
    expect(existsSync(demoStageCssPath), demoStageCssPath).toBe(true);
    const rules = parseStyleRules(readFileSync(demoStageCssPath, "utf8"));
    expect(rules.map((rule) => rule.selector)).toEqual([DEMO_STAGE_COMFORTABLE_SELECTOR]);
    const declarations = rules[0]?.declarations ?? [];
    expect(declarations).toEqual(fuseCssRule(DENSITY_SELECTORS.comfortable));
    expect(declarations.find((declaration) => declaration.name === "control-h-md")?.value).toBe("2.75rem");
  });
});
