import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import elmeraDemoStageDensity, {
  DEMO_STAGE_COMFORTABLE_SELECTOR,
  LIBRARY_COMFORTABLE_SELECTOR,
  deriveDemoStageComfortableCss,
} from "../scripts/elmera-demo-stage-density";
import type { PostCssConfig } from "../postcss.config";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");
const demoFrameCssPath = join(docsRoot, "src/components/DemoFrame.css");
const demoFrameCss = readFileSync(demoFrameCssPath, "utf8");
const libraryCss = readFileSync(join(docsRoot, "../../packages/ui/src/styles/ui.css"), "utf8");

function extractRuleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s").exec(css)?.[1];
  if (block === undefined) {
    throw new Error(`failed to extract ${selector}`);
  }
  return block;
}

function controlDeclarationPairs(block: string): string[] {
  const pairs: string[] = [];
  const re = /(--control-[a-z0-9-]+):\s*([^;]+);/g;
  let match = re.exec(block);
  while (match !== null) {
    const name = match[1];
    const value = match[2];
    if (name === undefined || value === undefined) {
      throw new Error("density declaration capture failed");
    }
    pairs.push(`${name}:${value.trim()}`);
    match = re.exec(block);
  }
  return pairs;
}

function runPlugin(css: string, from: string): string {
  let output = css;
  elmeraDemoStageDensity().Once({
    source: { input: { file: from } },
    append: (node: string) => {
      output = `${output}\n${node}`;
    },
  });
  return output;
}

describe("DemoStage comfortable density", () => {
  it("derives the DemoStage block from the single library block", () => {
    const derived = deriveDemoStageComfortableCss(libraryCss);
    expect(
      controlDeclarationPairs(extractRuleBlock(derived, DEMO_STAGE_COMFORTABLE_SELECTOR))
    ).toEqual(controlDeclarationPairs(extractRuleBlock(libraryCss, LIBRARY_COMFORTABLE_SELECTOR)));
  });

  it("appends the derived block while processing DemoFrame.css", () => {
    const output = runPlugin(demoFrameCss, demoFrameCssPath);
    expect(
      controlDeclarationPairs(extractRuleBlock(output, DEMO_STAGE_COMFORTABLE_SELECTOR))
    ).toEqual(controlDeclarationPairs(extractRuleBlock(libraryCss, LIBRARY_COMFORTABLE_SELECTOR)));
  });

  it("skips stylesheets other than DemoFrame.css", () => {
    const other = ".OtherComponent { color: red; }";
    expect(runPlugin(other, join(docsRoot, "src/components/Other.css"))).toBe(other);
  });

  it("wires the plugin factory into postcss.config plugins", async () => {
    const config: PostCssConfig = (await import("../postcss.config")).default;
    const entry = config.plugins.find(([plugin]) => plugin === elmeraDemoStageDensity);
    if (entry === undefined) {
      throw new Error("expected the DemoStage density plugin factory in postcss.config plugins");
    }
    expect(entry[0]).toBe(elmeraDemoStageDensity);
  });

  it("carries no hand-copied density metrics in the committed stylesheet", () => {
    expect(demoFrameCss).not.toMatch(/--control-/);
    expect(existsSync(join(docsRoot, "src/components/DemoFrame.comfortable.css"))).toBe(false);
  });
});
