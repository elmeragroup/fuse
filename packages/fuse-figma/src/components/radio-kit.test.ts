/**
 * Unit under test: the Radio component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `radioVariants` in
 * `radio-group-variants.ts`, `state-face.ts` and the focus ring in `styles/utils.ts`, with
 * `rounded-full` drawn as half of each fixed square side.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  CENTERED_BOX,
  ERROR_RING,
  FOCUS_RING,
  literal,
  paint,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function radio(checked: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `radio/checked=${checked},state=${state}`);
}

/** The 16px indicator `radio-group.tsx` renders while checked, around the 8px dot. */
const INDICATOR = {
  kind: "frame",
  key: "indicator",
  name: "radio-group-indicator",
  width: literal(16),
  height: literal(16),
  ...CENTERED_BOX,
  cornerRadius: literal(0),
  children: [
    {
      kind: "frame",
      key: "dot",
      name: "dot",
      width: literal(8),
      height: literal(8),
      ...CENTERED_BOX,
      cornerRadius: literal(4),
      fill: paint("primary-foreground"),
      children: [],
    },
  ],
};

describe("the Radio component set", () => {
  it("holds the 2 × 4 matrix, with columns by state and no properties of its own", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "radio");
    expect(set?.axes).toEqual([
      { name: "checked", values: ["off", "on"] },
      { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(8);
    expect([set?.textProperties, set?.swapProperties]).toEqual([[], []]);
  });

  it("draws an empty 16px circle with a muted-foreground border and no fill when off", () => {
    expect(radio("off", "rest")).toEqual({
      name: "radio-group-item",
      width: literal(16),
      height: literal(16),
      ...CENTERED_BOX,
      cornerRadius: literal(8),
      stroke: { color: paint("muted-foreground"), weight: literal(1) },
      children: [],
    });
  });

  it("fills checked with primary around a centered 8px primary-foreground dot", () => {
    const circle = radio("on", "rest");
    expect([circle.fill, circle.stroke?.color, circle.children]).toEqual([
      paint("primary"),
      paint("primary"),
      [INDICATOR],
    ]);
  });

  it("rings focus, dims disabled, and keeps the primary border only on a checked invalid radio", () => {
    expect(radio("off", "focus").shadows).toEqual([FOCUS_RING]);
    expect(radio("on", "disabled").opacity).toBe(0.5);
    const offInvalid = radio("off", "invalid");
    expect([offInvalid.stroke?.color, offInvalid.shadows]).toEqual([paint("error"), [ERROR_RING]]);
    const onInvalid = radio("on", "invalid");
    expect([onInvalid.stroke?.color, onInvalid.shadows]).toEqual([paint("primary"), [ERROR_RING]]);
  });

  it("drops the after: hit area with its reason", () => {
    const hitArea = coverage.filter((row) => row.component === "Radio" && row.className.startsWith("after:"));
    expect(new Set(hitArea.map((row) => row.className))).toEqual(
      new Set(["after:absolute", "after:-inset-x-3", "after:-inset-y-2", "after:content-['']"])
    );
    expect(new Set(hitArea.map((row) => `${row.outcome}: ${row.detail}`))).toEqual(
      new Set(["dropped: a hit area around the circle, which paints nothing"])
    );
  });
});
