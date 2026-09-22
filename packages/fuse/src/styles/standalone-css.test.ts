import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
