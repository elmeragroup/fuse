import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseScopedDeclarations } from "../../test/css-rules";
import { consumerBuild } from "../../test/tailwind-consumer-build";
import { controlMd } from "./control-size-md";

const here = dirname(fileURLToPath(import.meta.url));
const compiledCssPath = join(here, "../../dist/styles.css");

const COARSE_POINTER = "@media (pointer: coarse)";
const IOS_WEBKIT = "@supports (-webkit-touch-callout: none)";

/** One floor rule per site. */
const FLOOR_SITES = 2;

/** The classes of the two floor sites: the text-entry type slot and `Combobox.ChipsInput`. */
const FLOOR_CANDIDATES = [...controlMd.entryType().split(" "), "entry-floor:[--entry-text:max(16px,1em)]"];

/** Each condition `--entry-text` is declared under, mapped to its selectors and their values. */
function floorsByCondition(css: string): Map<string, Map<string, string>> {
  const floors = new Map<string, Map<string, string>>();
  for (const { name, value, scope } of parseScopedDeclarations(css)) {
    if (name !== "entry-text") {
      continue;
    }
    const condition = scope
      .filter((prelude) => prelude.startsWith("@"))
      .map((prelude) => prelude.replace(/\s+/g, " "))
      .join(" ");
    const selector = scope.filter((prelude) => !prelude.startsWith("@")).join(" ");
    const selectors = floors.get(condition) ?? new Map<string, string>();
    selectors.set(selector, value);
    floors.set(condition, selectors);
  }
  return floors;
}

/**
 * Chromium cannot match the `@supports` arm of `entry-floor`, so the touch browser suite only
 * proves the coarse-pointer arm. Unit under test: the emitted CSS. Oracle: its
 * `(pointer: coarse)` rules, which `control-size.touch.browser.test.tsx` checks in a browser.
 * Every selector that sets `--entry-text` there must set the same value under the iOS WebKit
 * `@supports`, and under no other condition.
 */
function expectIosArmMatchesCoarseArm(css: string): void {
  const floors = floorsByCondition(css);
  const coarse = floors.get(COARSE_POINTER);
  expect(coarse?.size, COARSE_POINTER).toBe(FLOOR_SITES);
  expect(floors.get(IOS_WEBKIT), IOS_WEBKIT).toEqual(coarse);
  expect([...floors.keys()].toSorted()).toEqual([COARSE_POINTER, IOS_WEBKIT].toSorted());
}

describe("entry-floor variant", () => {
  it("floors the same selectors under iOS WebKit as under a coarse pointer in a Tailwind-source build", async () => {
    expectIosArmMatchesCoarseArm(await consumerBuild(FLOOR_CANDIDATES));
  });

  it("floors the same selectors under iOS WebKit as under a coarse pointer in the standalone stylesheet", () => {
    expect(existsSync(compiledCssPath), compiledCssPath).toBe(true);
    expectIosArmMatchesCoarseArm(readFileSync(compiledCssPath, "utf8"));
  });
});
