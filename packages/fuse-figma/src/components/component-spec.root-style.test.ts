/**
 * The root's `style` attribute, which Toggle group is the first set to need, against the `chip` and
 * `dot` fixtures of `test/fixture-sets.ts`. The unit under test is `buildComponentSet`.
 *
 * Oracle: CSS Cascade 4 §6.2 and CSS Variables 1 §2. A declaration in an element's `style` attribute
 * beats every rule of a style sheet for that element, and a custom property it sets is what
 * `var()` reads there, so `gap-[--spacing(var(--gap))]` beside `style="--gap:3"` is 3 spacing units,
 * 12px. Chromium measured ToggleGroup's default `--gap:2` as an 8px gap on 2026-10-27.
 */
import { describe, expect, it } from "vitest";

import { literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { CoverageRow } from "./coverage";

/** The property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

/** A fixture part with its own key and slot. */
const part = (key: string, classes: string) => ({ ...dot(classes), key, slot: `chip-${key}` });

const ROW = [part("a", "size-[10px]"), part("b", "size-[10px]")];

describe("a root's style attribute", () => {
  it("sets the custom property the root's gap reads, over the root's own class", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex gap-[--spacing(var(--gap))] [--gap:1]", {
        parts: ROW,
        styleFor: () => [{ property: "--gap", value: "3" }],
      })
    );
    expect(variant?.root.itemSpacing).toEqual(literal(12));
    expect(notesOf(coverage, "inline style")).toEqual([["--gap", "literal", "12px"]]);
  });

  it("leaves the class's value where the root carries no style", async () => {
    const { variant } = await buildFixture(
      chip("flex gap-[--spacing(var(--gap))] [--gap:1]", { parts: ROW })
    );
    expect(variant?.root.itemSpacing).toEqual(literal(4));
  });
});
