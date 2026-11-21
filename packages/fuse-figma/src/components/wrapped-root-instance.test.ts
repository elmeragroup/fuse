/**
 * Unit under test: `buildSetsInOrder` on hand-built captures (`test/capture-fixtures.ts`): a `tip`
 * set of two variants whose roots hold a `::before` that hangs past their bottom edge by its centre,
 * where only `focus` casts a shadow, and a `chip` set that holds an instance of one of them. Oracles:
 * CSS Overflow 3, under which an `overflow: visible` box paints a layer past its edge, and the
 * build's contract for an instance part, which maps the inner root in place as its own set maps a
 * plain root and diffs it against the variant. Figma draws a shadow's spread only from a frame that
 * clips, so the `focus` root clips for its shadow, and its own set draws it as an unclipped root
 * around a frame that draws the box (`root-clip.ts`), which no instance part builds in place. The
 * `rest` root casts no shadow, so it needs no clip and leaves the square unclipped where CSS paints
 * it. So the build draws an instance of `rest` and refuses one of `focus`, naming the variant.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, instanceOf } from "../../test/capture-fixtures";
import type { FixtureCell, FixtureElement } from "../../test/capture-fixtures";
import { KitUnmappable } from "./build-errors";

/** A set of two states whose roots are boxes with a turned square hanging from their bottom edge. */
const tip = chip({
  key: "tip",
  name: "Tip",
  slot: "tip",
  axes: [{ name: "state", values: ["rest", "focus"] }],
});

/** The tip's root in a state, with `shadow` on the box, as its own set and the chip's instance render it. */
function tipRoot(shadow: string): FixtureElement {
  return {
    slot: "tip",
    classes: `relative w-[100px] h-[40px] bg-white ${shadow}`,
    measured: { pseudoBoxes: ["before"] },
    pseudo: {
      before: {
        classes: "absolute bottom-0 left-1/2 box-border size-[8px] bg-white",
        written: [
          { className: "before:content-['']", property: "content", value: '""' },
          {
            className: "before:[transform:translate(-50%,50%)_rotate(45deg)]",
            property: "transform",
            value: "translate(-50%,50%) rotate(45deg)",
          },
        ],
      },
    },
  };
}

/** The tip's roots by state: `rest` casts no shadow, and `focus` does. */
const ROOTS = { rest: tipRoot(""), focus: tipRoot("shadow-[0_0_4px_#000000]") } as const;

/** The tip set's cells. */
const TIP_CELLS: readonly FixtureCell[] = [
  { cell: { state: "rest" }, root: ROOTS.rest },
  { cell: { state: "focus" }, root: ROOTS.focus },
];

/** Build a chip that holds an instance of the tip in `state`. */
function chipHolding(state: keyof typeof ROOTS) {
  return buildCaptured(
    chip({ parts: [{ ...instanceOf("tip", tip), cell: () => ({ state }) }] }),
    [
      {
        cell: { state: "rest" },
        root: { slot: "chip", classes: "flex w-[200px]", children: [ROOTS[state]] },
      },
    ],
    { inner: [{ manifest: tip, cells: TIP_CELLS }] }
  );
}

describe("an instance part of a variant whose root wraps its box", () => {
  it("leaves the shadowless variant unclipped, with the square directly on its root", async () => {
    const { componentSet } = await buildCaptured(tip, TIP_CELLS);
    const rest = componentSet.variants.find((variant) => variant.key === "tip/state=rest");
    expect([rest?.root.clips, rest?.root.children.map((layer) => layer.key)]).toEqual([false, ["::before"]]);
  });

  it("builds an instance of the shadowless variant", async () => {
    await expect(chipHolding("rest")).resolves.toBeDefined();
  });

  it("fails the build of an instance of the shadowed variant, naming it", async () => {
    const built = chipHolding("focus");
    await expect(built).rejects.toBeInstanceOf(KitUnmappable);
    await expect(built).rejects.toThrow(
      "tip/state=focus, whose root draws its box in a frame inside an unclipped root"
    );
  });
});
