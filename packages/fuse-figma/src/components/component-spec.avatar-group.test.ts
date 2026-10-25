/**
 * Build rules the Avatar group is the first set to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its oracle.
 */
import { describe, expect, it } from "vitest";

import { literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { PartDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";

/** The part, property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage
    .filter((row) => row.className === className)
    .map((row) => [row.part, row.property, row.outcome, row.detail]);

/** The outcomes of the coverage rows of one class, each once. */
const outcomesOf = (coverage: readonly CoverageRow[], className: string) =>
  new Set(coverage.filter((row) => row.className === className).map((row) => row.outcome));

/** A 32px circle that fills and clips, as an Avatar root does, under its own key and slot. */
const circle = (key: string, classes = ""): PartDefinition => ({
  ...dot(`size-[32px] rounded-full bg-[#ff0000] overflow-hidden ${classes}`),
  key,
  slot: `chip-${key}`,
});

const THREE = [circle("first"), circle("second"), circle("third")];

// Oracle: Tailwind compiles `-space-x-2` to `:where(.-space-x-2 > :not(:last-child))` with
// `--tw-space-x-reverse: 0`, `margin-inline-start: calc(calc(0.25rem * -2) * var(--tw-space-x-reverse))`
// and `margin-inline-end: calc(calc(0.25rem * -2) * calc(1 - var(--tw-space-x-reverse)))`: every
// child but the last ends 8px early, so in a left-to-right flex row each child starts 8px over the
// one before (CSS Flexbox 1 §9.4), and a later sibling paints over an earlier one (§5.4). Probe N7
// read the same in Figma for `itemSpacing = -8`: three 32px circles at x 0, 24 and 48, the later on
// top, so the row needs no `itemReverseZIndex`.
describe("a row that overlaps its children by a negative `space-x`", () => {
  it("draws `-space-x-2` as an item spacing of -8 in a row of three drawn children", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex -space-x-2", { parts: THREE, undrawnChildren: () => 0 })
    );
    expect(variant?.root.direction).toBe("HORIZONTAL");
    expect(variant?.root.itemSpacing).toEqual(literal(-8));
    expect(variant?.root.firstOnTop).toBeUndefined();
    expect(notesOf(coverage, "-space-x-2")).toEqual([
      [
        "chip",
        "--tw-space-x-reverse",
        "dropped",
        "0 keeps the margins on the end side of each child, which the item spacing draws",
      ],
      [
        "chip",
        "margin-inline-start",
        "dropped",
        "0 while `--tw-space-x-reverse` is 0, so the start side keeps no margin",
      ],
      [
        "chip",
        "margin-inline-end",
        "literal",
        "-8px, the item spacing: every child but the last ends that far early, and a later layer draws on top as a later sibling does",
      ],
    ]);
  });

  it.each([
    ["a column", chip("flex flex-col -space-x-2", { parts: THREE, undrawnChildren: () => 0 })],
    ["a row with a gap", chip("flex gap-1 -space-x-2", { parts: THREE, undrawnChildren: () => 0 })],
    [
      "a row beside a child the kit draws no layer for",
      chip("flex -space-x-2", { parts: THREE, undrawnChildren: () => 1 }),
    ],
    [
      "a row whose child has a margin of its own, which beats the zero-specificity rule",
      chip("flex -space-x-2", {
        parts: [circle("first", "mr-1"), circle("second"), circle("third")],
        undrawnChildren: () => 0,
      }),
    ],
  ])("leaves `-space-x-2` unmapped in %s", async (_box, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(outcomesOf(coverage, "-space-x-2")).toEqual(new Set(["unmapped"]));
  });

  it("leaves `-space-y-2` unmapped in a row", async () => {
    const { coverage } = await buildFixture(
      chip("flex -space-y-2", { parts: THREE, undrawnChildren: () => 0 })
    );
    expect(outcomesOf(coverage, "-space-y-2")).toEqual(new Set(["unmapped"]));
  });
});

// Oracle: Tailwind compiles `[:where(&>*)]:ring-2` to `:where(.\[…\]\:ring-2 > *)`, which selects
// every child of the element that carries the class at a specificity of (0,0,0) (Selectors 4 §17),
// so each child takes the ring, and a child's own ring utility, at (0,1,0), beats it whatever their
// order in the output.
describe("a class that styles every child at no specificity", () => {
  const RING = {
    color: { kind: "literal", color: { r: 0, g: 0, b: 1, a: 1 } },
    offsetX: 0,
    offsetY: 0,
    radius: literal(0),
  } as const;

  it("rings each child with `[:where(&>*)]:ring-2`", async () => {
    const { variant } = await buildFixture(
      chip("flex [:where(&>*)]:ring-2 [:where(&>*)]:ring-[rgb(0_0_255)]", {
        parts: [circle("first"), circle("second")],
        undrawnChildren: () => 0,
      })
    );
    const shadows = variant?.root.children.map((child) =>
      child.kind === "frame" ? child.shadows : undefined
    );
    expect(shadows).toEqual([[{ ...RING, spread: literal(2) }], [{ ...RING, spread: literal(2) }]]);
  });

  it("lets a child's own ring width beat it", async () => {
    const { variant } = await buildFixture(
      chip("flex [:where(&>*)]:ring-2 [:where(&>*)]:ring-[rgb(0_0_255)]", {
        parts: [circle("first", "ring-1")],
        undrawnChildren: () => 0,
      })
    );
    const [first] = variant?.root.children ?? [];
    expect(first?.kind === "frame" ? first.shadows : undefined).toEqual([{ ...RING, spread: literal(1) }]);
  });
});

// Oracle: CSS Flexbox 1 §3, under which `vertical-align` has no effect on a flex item, since a flex
// item sits in no line box, while an inline box in a block's line takes it (CSS 2.1 §10.8).
describe("a part's `vertical-align`", () => {
  it("drops on a part in a flex row", async () => {
    const { coverage } = await buildFixture(chip("flex", { parts: [circle("first", "align-middle")] }));
    expect(notesOf(coverage, "align-middle")).toEqual([
      ["chip-first", "vertical-align", "dropped", "a flex item sits in no line box, so no line aligns it"],
    ]);
  });

  it("stays unmapped on a part in a block box", async () => {
    const { coverage } = await buildFixture(
      chip("block", { parts: [circle("first", "inline-block align-middle")] })
    );
    expect(outcomesOf(coverage, "align-middle")).toEqual(new Set(["unmapped"]));
  });
});
