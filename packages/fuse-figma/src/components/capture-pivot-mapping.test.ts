/**
 * How the build places a `::before` that hangs from its parent's bottom edge by its centre and turns
 * through `transform: translate(-50%, 50%) rotate(45deg)`, as a Popover arrow's square does. The unit
 * under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Oracles: CSS Transforms 1 §6 and §7, under which a transform moves
 * and turns a box about its `transform-origin`, `50% 50%` by default, and takes a percentage of its
 * reference box, which `transform-box` names; the spec's used values for a box with a CSS layout,
 * under which `view-box` and `stroke-box` resolve to the border box and `fill-box` to the content
 * box; and Chromium, which on 2026-11-21 moved an 8px `border-box` square with a 1px border by 4px
 * under `translateX(-50%)` at the default, `border-box`, `view-box` and `stroke-box`, and by 3px at
 * `content-box` and `fill-box`. Under the default origin and a border-box reference the square's
 * centre sits on the bottom edge, centred along it, turned 45 degrees clockwise, -45 as Figma counts
 * it. An origin or a reference box the kit cannot read leaves the pseudo-element with no place, and
 * the coverage contract keeps its rows unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, frameOf, rest } from "../../test/capture-fixtures";
import type { Written } from "../../test/capture-fixtures";
import type { CoverageRow } from "./coverage";

/** The written `content` that makes the `::before` render. */
const CONTENT: Written = { className: "before:content-['']", property: "content", value: '""' };

/** The written declarations every arrow case's `::before` wins: its content and its transform. */
const ARROW: readonly Written[] = [
  CONTENT,
  {
    className: "before:[transform:translate(-50%,50%)_rotate(45deg)]",
    property: "transform",
    value: "translate(-50%,50%) rotate(45deg)",
  },
];

/** The classes of the `::before`'s 8px square at its parent's bottom centre. */
const SQUARE = "absolute bottom-0 left-1/2 box-border size-[8px] border border-black bg-white";

/** A `relative` root whose `::before` wins `classes`, the {@link SQUARE} by default, and `written`. */
function squareRoot(written: readonly Written[], classes = SQUARE) {
  return buildCaptured(
    chip(),
    rest({
      slot: "chip",
      classes: "relative w-[100px] h-[40px] bg-white",
      measured: { pseudoBoxes: ["before"] },
      pseudo: {
        before: {
          classes,
          written,
        },
      },
    })
  );
}

/** The arrow's square: the 8px square that turns through {@link ARROW}, with `extra` written after it. */
const arrowRoot = (extra: readonly Written[]) => squareRoot([...ARROW, ...extra]);

/** A written declaration on the `::before`. */
const own = (property: string, value: string): Written => ({
  className: `before:[${property}:${value.replaceAll(" ", "_")}]`,
  property,
  value,
});

/** The unmapped rows' properties. */
const unmapped = (coverage: readonly CoverageRow[]) =>
  coverage.filter((row) => row.outcome === "unmapped").map((row) => row.property);

/** The outcome and the detail of the `::before`'s rows for one property. */
const rowOf = (coverage: readonly CoverageRow[], property: string) =>
  coverage
    .filter(
      (row) =>
        row.property === property &&
        (SQUARE.split(" ").includes(row.className) || row.className.startsWith("before:"))
    )
    .map((row) => [row.outcome, row.detail]);

describe("a ::before placed by its centre through a transform", () => {
  it.each([
    ["the default origin and reference box", []],
    ["an origin of `50% 50%`", [own("transform-origin", "50% 50%")]],
    ["an origin of `center`", [own("transform-origin", "center")]],
    ["an origin of `center center`", [own("transform-origin", "center center")]],
    ["a `border-box` reference", [own("transform-box", "border-box")]],
    ["a `view-box` reference", [own("transform-box", "view-box")]],
    ["a `stroke-box` reference", [own("transform-box", "stroke-box")]],
  ] as const)("sits centred on the bottom edge, turned -45, with %s", async (_case, extra) => {
    const { variant, coverage } = await arrowRoot(extra);
    const square = frameOf(variant?.root);
    expect([square?.key, square?.placement, square?.rotation]).toEqual([
      "::before",
      { kind: "pivot", edge: "bottom", along: 0, inset: 0 },
      -45,
    ]);
    // The place takes the origin and the reference box, so their rows are read.
    expect(extra.flatMap(({ property }) => rowOf(coverage, property).map(([outcome]) => outcome))).toEqual(
      extra.map(() => "literal")
    );
  });

  it.each([
    ["an origin at its top left corner", [own("transform-origin", "0 0")], "about `transform-origin: 0 0`"],
    ["an origin of `top`", [own("transform-origin", "top")], "about `transform-origin: top`"],
    [
      "a `content-box` reference, 6px across inside the border",
      [own("transform-box", "content-box")],
      "`transform-box: content-box` moves the part about a box other than its border box",
    ],
    [
      "a `fill-box` reference, which resolves to the content box",
      [own("transform-box", "fill-box")],
      "`transform-box: fill-box` moves the part about a box other than its border box",
    ],
  ] as const)("draws no layer, its rows unmapped, with %s", async (_case, extra, why) => {
    const { variant, coverage } = await arrowRoot(extra);
    expect(variant?.root.children).toEqual([]);
    expect(unmapped(coverage)).toEqual(expect.arrayContaining(["position", "transform"]));
    expect(rowOf(coverage, extra[0].property)).toEqual([["unmapped", expect.stringContaining(why)]]);
  });
});

// Oracle: CSS Transforms 2 §6 and CSS Values 4 §7.1. An individual `rotate` or `scale` acts about
// the `transform-origin`, so about `0 0` an 8px square at `bottom: 0; left: 50%` turns or grows about
// its top left corner, which moves its centre off the point the pivot reads. `.125turn` is 45deg, an
// angle unit the kit does not read, so it cannot draw the turn either.
describe("a ::before that turns or scales about its corner", () => {
  it.each([
    [
      "`rotate: .125turn`",
      [own("rotate", ".125turn"), own("transform-origin", "0 0")],
      "`rotate: .125turn` is no angle the kit reads",
    ],
    [
      "`scale: 2`",
      [own("scale", "2"), own("transform-origin", "0 0")],
      "`scale: 2` acts about `transform-origin: 0 0`, not the part's centre",
    ],
  ] as const)("draws no layer, its rows unmapped, with %s", async (_case, extra, why) => {
    const { variant, coverage } = await squareRoot([CONTENT, ...extra]);
    expect(variant?.root.children).toEqual([]);
    expect([rowOf(coverage, "position"), rowOf(coverage, extra[0].property)]).toEqual([
      [["unmapped", expect.stringContaining(why)]],
      [["unmapped", expect.stringContaining(why)]],
    ]);
  });
});

// Oracle: the kit's contract for a pseudo-element, which it draws only by its place, and CSS 2.1
// §10.6.4, under which an absolute box 8px wide with no height and no content is 0px tall and paints
// nothing. Its centre needs a fixed size, so it draws no layer, and the build goes on.
describe("a ::before at its parent's bottom centre with no height", () => {
  it("draws no layer, its rows unmapped", async () => {
    const { variant, coverage } = await squareRoot(ARROW, "absolute bottom-0 left-1/2 w-[8px] bg-white");
    expect(variant?.root.children).toEqual([]);
    expect(unmapped(coverage)).toEqual(expect.arrayContaining(["position", "width", "transform"]));
  });
});
