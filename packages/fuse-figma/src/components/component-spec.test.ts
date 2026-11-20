/**
 * The cells of a sparse matrix.
 *
 * Unit under test: `possibleCells`, the one enumerator of a set's cells.
 * Oracle: the cells written out by hand for a two-axis set, and the rule that an `impossible` entry
 * names at least one axis value and only axes and values the set declares, so a typo cannot drop
 * every cell or none.
 */
import { describe, expect, it } from "@effect/vitest";

import { KitUnmappable } from "./build-errors.ts";
import { possibleCells } from "./component-spec.ts";
import type { Cell } from "./component-spec.ts";

const AXES = [
  { name: "state", values: ["rest", "disabled"] },
  { name: "open", values: ["false", "true"] },
];

const FACT = "A disabled trigger cannot open.";

describe("possibleCells", () => {
  it("leaves out exactly the cells that hold every value an entry names", () => {
    expect(
      possibleCells({ axes: AXES, impossible: [{ where: { state: "disabled", open: "true" }, fact: FACT }] })
    ).toEqual([
      { state: "rest", open: "false" },
      { state: "rest", open: "true" },
      { state: "disabled", open: "false" },
    ]);
  });

  it.each<readonly [string, Cell]>([
    ["names no axis value", {}],
    ["names an axis the set lacks", { state: "disabled", opne: "true" }],
    ["names a value its axis lacks", { state: "disabled", open: "on" }],
  ])("refuses an entry that %s", (_reason, where) => {
    expect(() => possibleCells({ axes: AXES, impossible: [{ where, fact: FACT }] })).toThrow(KitUnmappable);
  });
});
