import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

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

const RUNG_UTILITIES = [
  ["rounded-xs", "radius-xs"],
  ["rounded-sm", "radius-sm"],
  ["rounded-md", "radius-md"],
  ["rounded-lg", "radius-lg"],
  ["rounded-xl", "radius-xl"],
] as const;

/**
 * One Tailwind-source consumer build that spells every candidate below. Each assertion reads
 * only its own rules, and a negative holds a fortiori in a build that spells more.
 */
let consumerCss = "";
beforeAll(async () => {
  consumerCss = await consumerBuild([
    ...PRIVATE_CORNER_CANDIDATES,
    "rounded-button",
    "rounded-inner",
    ...RUNG_UTILITIES.map(([utility]) => utility),
  ]);
});

describe("private corner classes", () => {
  it("add no rounded-* utility to a Tailwind-source consumer's build", () => {
    const css = consumerCss;
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

/** The public inner-corner utility as fuse.css declares it: the shell's corner, else `--radius`. */
const ROUNDED_INNER_RULE = ".rounded-inner {\n  border-radius: var(--inner-corner, var(--radius));\n}";

describe("the public rounded-inner utility", () => {
  it("resolves in a Tailwind-source consumer's build", () => {
    expect(consumerCss).toContain(ROUNDED_INNER_RULE);
  });

  it("ships in the standalone stylesheet, which Fuse's own menu rows put it in", () => {
    expect(existsSync(compiledCssPath), compiledCssPath).toBe(true);
    const css = readFileSync(compiledCssPath, "utf8");
    expect(css).toContain(ROUNDED_INNER_RULE);
  });
});

describe("radius rungs in a consumer build", () => {
  // The unit under test is Tailwind's inlining of the `@theme inline` rungs into the
  // `rounded-*` utilities. The oracle is `RADIUS_RUNGS`, whose CSS carries the 0px step
  // fallback, so a host that imports fuse.css without themes.css and keeps its own --radius
  // still rounds every rung with that radius.
  it("inline each rung's formula, step fallback included, into its rounded-* utility", () => {
    const css = consumerCss;
    for (const [utility, rung] of RUNG_UTILITIES) {
      expect(css, utility).toContain(`.${utility} {\n  border-radius: ${RADIUS_RUNGS[rung].css};`);
    }
    expect(css).not.toContain("--radius-step)");
  });
});
