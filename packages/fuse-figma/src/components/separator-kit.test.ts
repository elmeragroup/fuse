/**
 * Unit under test: the Separator component set as the build produces it. Oracle: the Fuse variable
 * or literal each Figma field of a cell must carry, read by hand from `separator-class.ts` and the
 * docs demos' lengths: a 1px line in the `border` role, 256px long across a horizontal cell
 * (`w-64`) and 16px long down a vertical one (`h-4`).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, literal, paint, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** A line with no padding, gap, corner, shadow or layers. */
const LINE = {
  name: "separator",
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(0),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: literal(0),
  fill: paint("border"),
  shadows: [],
  opacity: 1,
  children: [],
} as const;

describe("the Separator component set", () => {
  it("holds one cell per orientation, with columns by orientation and no properties of its own", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "separator");
    expect(set?.axes).toEqual([{ name: "orientation", values: ["horizontal", "vertical"] }]);
    expect(set?.columnAxis).toBe("orientation");
    expect(set?.variants.map((cell) => cell.key)).toEqual([
      "separator/orientation=horizontal",
      "separator/orientation=vertical",
    ]);
    expect([set?.textProperties, set?.swapProperties]).toEqual([[], []]);
  });

  it("draws a 256 × 1 border line across and a 1 × 16 one down", () => {
    expect(variantRoot(spec, "separator/orientation=horizontal")).toEqual({
      ...LINE,
      width: literal(256),
      height: literal(1),
    });
    expect(variantRoot(spec, "separator/orientation=vertical")).toEqual({
      ...LINE,
      width: literal(1),
      height: literal(16),
    });
  });
});
