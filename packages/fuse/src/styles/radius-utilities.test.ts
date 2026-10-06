import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { consumerBuild } from "../../test/tailwind-consumer-build";
import { RADIUS_RUNGS } from "../theme/tokens/radius-scale";

const here = dirname(fileURLToPath(import.meta.url));
const compiledCssPath = join(here, "../../dist/styles.css");

/**
 * Corner utilities a `--radius-*` entry in `@theme` would add to a consumer's build. The
 * corners outside the `rounded-*` scale live in `corner-radius.ts` as private classes, so
 * none of these names may resolve.
 */
const PRIVATE_CORNER_CANDIDATES = [
  "rounded-inset",
  "rounded-fixed",
  "rounded-t-inset",
  "rounded-t-fixed",
] as const;
const PRIVATE_CORNER_SELECTOR = /\.rounded-(?:t-)?(?:inset|fixed)\b/;
const PRIVATE_CORNER_VARIABLE = /--radius-(?:inset|fixed)\b/;

describe("private corner classes", () => {
  it("add no rounded-* utility to a Tailwind-source consumer's build", async () => {
    const css = await consumerBuild([...PRIVATE_CORNER_CANDIDATES, "rounded-md", "rounded-button"]);
    // The scale rung and the button utility resolve, so the build itself is populated.
    expect(css).toContain(".rounded-md {");
    expect(css).toContain(".rounded-button {");
    expect(css).not.toMatch(PRIVATE_CORNER_SELECTOR);
    expect(css).not.toMatch(PRIVATE_CORNER_VARIABLE);
  });

  it("leave no corner utility or theme variable in the standalone stylesheet", () => {
    expect(existsSync(compiledCssPath), compiledCssPath).toBe(true);
    const css = readFileSync(compiledCssPath, "utf8");
    expect(css).not.toMatch(PRIVATE_CORNER_SELECTOR);
    expect(css).not.toMatch(PRIVATE_CORNER_VARIABLE);
  });
});

describe("radius rungs in a consumer build", () => {
  // The unit under test is Tailwind's inlining of the `@theme inline` rungs into the
  // `rounded-*` utilities. The oracle is `RADIUS_RUNGS`, whose CSS carries the 0px step
  // fallback, so a host that imports fuse.css without themes.css and keeps its own --radius
  // still rounds every rung with that radius.
  it("inline each rung's formula, step fallback included, into its rounded-* utility", async () => {
    const css = await consumerBuild(["rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"]);
    for (const [utility, rung] of [
      ["rounded-xs", "radius-xs"],
      ["rounded-sm", "radius-sm"],
      ["rounded-md", "radius-md"],
      ["rounded-lg", "radius-lg"],
      ["rounded-xl", "radius-xl"],
    ] as const) {
      expect(css, utility).toContain(`.${utility} {\n  border-radius: ${RADIUS_RUNGS[rung].css};`);
    }
    expect(css).not.toContain("--radius-step)");
  });
});
