/**
 * Unit under test: the Skeleton component set as the build produces it. Oracle: the Fuse variable
 * or literal each Figma field of a cell must carry, read by hand from `skeleton-class.ts` and the
 * docs demos' shapes: a block in the `muted` role, 192 × 16 with the `radius-md` corner for a line
 * (`h-4 w-48`), and 40 × 40 with a 20px corner for a circle (`size-10 rounded-full`, where CSS draws
 * the infinite radius as half the side).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, fixedSize, literal, paint, token, UNLIMITED, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** A block with no padding, gap, shadow or layers. */
const BLOCK = {
  name: "skeleton",
  direction: "HORIZONTAL",
  limits: UNLIMITED,
  clips: true,
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(0),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  fill: paint("muted"),
  shadows: [],
  opacity: 1,
  children: [],
} as const;

describe("the Skeleton component set", () => {
  it("holds one cell per shape, with columns by shape and no properties of its own", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "skeleton");
    expect(set?.axes).toEqual([{ name: "shape", values: ["line", "circle"] }]);
    expect(set?.columnAxis).toBe("shape");
    expect(set?.variants.map((cell) => cell.key)).toEqual(["skeleton/shape=line", "skeleton/shape=circle"]);
    expect([set?.textProperties, set?.swapProperties]).toEqual([[], []]);
  });

  it("draws a 192 × 16 muted line on the radius-md corner and a 40px muted circle", () => {
    expect(variantRoot(spec, "skeleton/shape=line")).toEqual({
      ...BLOCK,
      sizing: fixedSize(literal(192), literal(16)),
      cornerRadius: token("radius-md"),
    });
    expect(variantRoot(spec, "skeleton/shape=circle")).toEqual({
      ...BLOCK,
      sizing: fixedSize(literal(40), literal(40)),
      cornerRadius: literal(20),
    });
  });
});
