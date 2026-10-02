import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LAYER_DEFAULTS } from "../theme/tokens/defaults";
import { EXTERNAL_VARIANT_LAYER } from "../theme/tokens/external-palettes";

const here = dirname(fileURLToPath(import.meta.url));
const wrapperPath = join(here, "../../scripts/standalone.css");
const compiledCssPath = join(here, "../../dist/styles.css");

/**
 * Utilities spelled in this file and nowhere under `dist/`. They are the probe: with
 * Tailwind's automatic source detection on, scanning the package would pick them up from
 * this very test and emit them; with `source(none)` plus the dist glob they stay out.
 * Role-token utilities only — a raw palette class here would trip `no-primitive-colors`.
 */
const SRC_ONLY_CLASSES = ["mb-4", "border-inherit", "min-w-xl", "ms-1"] as const;

/** A utility Skeleton emits, so the compiled sheet is known to be populated. */
const DIST_CLASS = "animate-pulse";

function selectorLines(css: string): Set<string> {
  const selectors = new Set<string>();
  for (const line of css.split("\n")) {
    const match = /^\s*\.([A-Za-z0-9_-]+)(?=[\s{:,.[\\>])/.exec(line);
    if (match?.[1] !== undefined) {
      selectors.add(match[1]);
    }
  }
  return selectors;
}

/** The fallback of every `var(--name, …)` read in `css`, or `undefined` for a bare read. */
function varFallbacks(css: string, name: string): (string | undefined)[] {
  const fallbacks: (string | undefined)[] = [];
  const read = new RegExp(`var\\(--${name}(?![\\w-])\\s*`, "gu");
  for (const match of css.matchAll(read)) {
    const start = match.index + match[0].length;
    if (css[start] !== ",") {
      fallbacks.push(undefined);
      continue;
    }
    let depth = 0;
    let end = start + 1;
    for (; end < css.length; end++) {
      const char = css[end];
      if (char === "(") depth++;
      else if (char === ")" && depth-- === 0) break;
    }
    fallbacks.push(css.slice(start + 1, end).trim());
  }
  return fallbacks;
}

describe("standalone stylesheet source set", () => {
  it("compiles from dist/**/*.js with automatic source detection off", () => {
    const wrapper = readFileSync(wrapperPath, "utf8");
    expect(wrapper).toContain('@import "tailwindcss/utilities.css" source(none)');
    expect(wrapper.match(/@source\b/g)).toHaveLength(1);
    expect(wrapper).toContain('@source "../dist/**/*.js"');
    expect(wrapper).not.toContain("@source not");
  });

  it("emits no utility spelled only in src-only files", () => {
    // This package has no turbo.json of its own, so it inherits the root `test` task and
    // its direct `@elmeragroup/fuse#build` dependency.
    expect(existsSync(compiledCssPath), compiledCssPath).toBe(true);
    const emitted = selectorLines(readFileSync(compiledCssPath, "utf8"));
    expect(emitted.has(DIST_CLASS)).toBe(true);
    for (const className of SRC_ONLY_CLASSES) {
      expect(emitted.has(className), className).toBe(false);
    }
  });
});

describe("variant-layer role reads", () => {
  it("fall back to the internal default wherever the compiled sheet reads them", () => {
    // Only themes.css declares the variant-layer roles, so a host without it reads every
    // fallback. Unit under test: each `var(--K` in dist/styles.css for K in
    // EXTERNAL_VARIANT_LAYER. Oracle: LAYER_DEFAULTS[K], the role's internal default.
    expect(existsSync(compiledCssPath), compiledCssPath).toBe(true);
    const css = readFileSync(compiledCssPath, "utf8");
    const defaults: Readonly<Record<string, string>> = LAYER_DEFAULTS;
    for (const key of Object.keys(EXTERNAL_VARIANT_LAYER)) {
      const fallbacks = varFallbacks(css, key);
      expect(fallbacks.length, key).toBeGreaterThan(0);
      for (const fallback of fallbacks) {
        expect(fallback, key).toBe(defaults[key]);
      }
    }
  });
});
