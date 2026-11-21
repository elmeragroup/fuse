/**
 * Unit under test: how the cascade resolves a registered custom property whose own declaration reads
 * a custom property nothing sets. Oracle: CSS Properties and Values API 1, the calculation of computed
 * values, under which such a declaration is invalid at computed-value time and the property takes
 * `unset`: its parent's computed value where it inherits, its initial value where it does not. Chromium
 * computes the same values for `@property --x { syntax: "<length>"; initial-value: 3px }` under a
 * parent's `--x: 17px`, read on 2026-11-19: the box that declares `--x: var(--missing)` and its child
 * both pad by 17px where the registration inherits and by 3px where it does not, not by the `9px`
 * fallback of `padding-left: var(--x, 9px)`. The coverage table follows the value: where the parent's
 * `--x` stands in for the failed declaration, a read of the padding, on the declaring box or on its
 * child alone, reads the parent's declaration, and where the box's own `--x` resolves, the parent's
 * reaches no part, and drops.
 */
import { describe, expect, it } from "vitest";

import type { BuildContext } from "./component-spec.ts";
import { makeVariableIndex } from "./css-values.ts";
import { CellLedger, LayerStyle, inheritance } from "./layer-style.ts";
import type { Layer } from "./layer-style.ts";

/** What the cell resolved and recorded. */
type Resolved = {
  /** The padding of the box that declares `--x` and of its child, in that order. */
  readonly paddings: readonly (string | undefined)[];
  /** The outcome the coverage table gives the parent's `--x: 17px`. */
  readonly parent: string | undefined;
};

/** A build context whose only registration is `--x`, with an initial value of 3px. */
function registering(inherits: boolean): BuildContext {
  return {
    compiled: {
      rules: new Map(),
      themeValues: new Map(),
      registeredProperties: new Map([["--x", { initialValue: "3px", inherits }]]),
    },
    variables: makeVariableIndex([]),
  };
}

/** The box whose padding the build reads, so the coverage table records it. */
type Reader = "declaring" | "child";

/**
 * Resolve the padding under a parent's `--x: 17px` and a box's own `--x` declaration, and read it
 * on one of the two boxes.
 */
function resolve(inherits: boolean, declared: string, reader: Reader = "child"): Resolved {
  const context = registering(inherits);
  const rows: { part: string; property: string; outcome: string }[] = [];
  // The ledger records each row through the origin of the declaration it concerns.
  const origin = { record: (row: (typeof rows)[number]) => rows.push(row) };
  const cell = new CellLedger({
    context,
    origin,
    record: origin.record,
    cell: {},
    inPlace: undefined,
  });
  const box = (part: string, declarations: Readonly<Record<string, string>>, parent?: Layer) =>
    cell.add(
      parent === undefined ? new Map() : inheritance(parent, context),
      [
        {
          part,
          className: "sample",
          origin,
          rank: 0,
          at: undefined,
          order: 0,
          declarations: Object.entries(declarations).map(([property, value]) => ({ property, value })),
        },
      ],
      parent
    );
  const parent = box("parent", { "--x": "17px" });
  const declaring = box("declaring", { "--x": declared, "padding-left": "var(--x,9px)" }, parent);
  const child = box("child", { "padding-left": "var(--x,9px)" }, declaring);
  const paddings = [declaring, child].map((layer) =>
    new LayerStyle(cell, layer, []).resolved("padding-left")
  );
  new LayerStyle(cell, reader === "declaring" ? declaring : child, []).read(
    "padding-left",
    (value) => value,
    () => ({ outcome: "literal", detail: "padding" }),
    []
  );
  cell.settle();
  const parentRows = rows.filter((row) => row.part === "parent" && row.property === "--x");
  return { paddings, parent: [...new Set(parentRows.map((row) => row.outcome))].join() || undefined };
}

describe("a registered custom property whose declaration reads one nothing sets", () => {
  it.each<Reader>(["declaring", "child"])(
    "takes its parent's value where it inherits, and a read on the %s box reads the parent's declaration",
    (reader) => {
      expect(resolve(true, "var(--missing)", reader)).toEqual({
        paddings: ["17px", "17px"],
        parent: "literal",
      });
    }
  );

  it("takes its initial value where it does not inherit", () => {
    expect(resolve(false, "var(--missing)").paddings).toEqual(["3px", "3px"]);
  });

  it("drops the parent's declaration where the box's own resolves", () => {
    expect(resolve(true, "5px")).toEqual({ paddings: ["5px", "5px"], parent: "dropped" });
  });
});
