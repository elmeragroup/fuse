/**
 * Unit under test: the Loader component set as the build produces it. Oracle: the Fuse variable
 * or literal each Figma field of a cell must carry, read by hand from `loader-variants.ts`: a box
 * that hugs, padded 16px by `p-4`, around a `SpinnerGap` in the `foreground` role, whose own
 * `size-*` class makes it 16, 12, 24, 32 or 40px for `default`, `small`, `medium`, `large` and
 * `xl`. So the boxes are 48, 44, 56, 64 and 72px square.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, literal, paint, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** A loader box around a spinner of `size` px. */
const loader = (size: number) => ({
  name: "loader",
  paddingTop: literal(16),
  paddingRight: literal(16),
  paddingBottom: literal(16),
  paddingLeft: literal(16),
  itemSpacing: literal(0),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: literal(0),
  shadows: [],
  opacity: 1,
  children: [
    {
      kind: "icon",
      key: "spinner",
      name: "Spinner",
      icon: "icon/SpinnerGap",
      size: literal(size),
      color: paint("foreground"),
    },
  ],
});

describe("the Loader component set", () => {
  it("holds one cell per size, default first, with columns by size and no properties of its own", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "loader");
    expect(set?.axes).toEqual([{ name: "size", values: ["default", "small", "medium", "large", "xl"] }]);
    expect(set?.columnAxis).toBe("size");
    expect([set?.textProperties, set?.swapProperties]).toEqual([[], []]);
  });

  it.each([
    ["default", 16],
    ["small", 12],
    ["medium", 24],
    ["large", 32],
    ["xl", 40],
  ])("draws the %s spinner at %ipx inside a hugging box padded by 16px", (size, spinner) => {
    expect(variantRoot(spec, `loader/size=${size}`)).toEqual(loader(spinner));
  });
});
