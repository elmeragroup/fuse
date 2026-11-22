/**
 * Unit under test: the side paddings of the Pagination link and edge sets at Button's label sizes,
 * as the kit builds them, resolved in the in-memory file the token sync writes under every pin a
 * designer can give a frame (`test/mode-sweep.ts`).
 * Oracle: Chromium's computed `padding-left` and `padding-right` of the same cell, rendered as
 * `figma:capture` renders it, under the theme each pin stamps. `figma:capture --check` reads one
 * theme, and the frozen keys and the inventory counts read no padding. Under a branded dense pin
 * Button pads a label side with the identity's floor (#858), so the label sides of a page link and
 * the copy's side of an edge pad wider there than the size's inset, and an edge's caret side does
 * not.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import { named, pixelsIn, sweepSet, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptCell, SweptFile } from "../../test/mode-sweep.ts";

/** How far apart, in CSS pixels, a built padding and Chromium's may sit. */
const PADDING_TOLERANCE_PX = 0.01;

/** Button's label sizes, which a page link and an edge take beside the square ones. */
const LABEL_SIZES = new Set(["default", "xs", "sm", "lg"]);

let kit: BuiltSets;
let file: SweptFile;

beforeAll(async () => {
  [kit, file] = await Promise.all([builtKit(), sweptFile()]);
});

describe.each(["pagination-link", "pagination-edge"])("the %s set at a label size", (set) => {
  let swept: readonly SweptCell[];

  beforeAll(async () => {
    swept = await sweepSet(set, (cell) => LABEL_SIZES.has(cell.size ?? ""), file.modes, [
      "padding-left",
      "padding-right",
    ]);
  });

  it("pads each side as Chromium does under every pin", () => {
    const apart = swept.flatMap((each) => {
      const root = variantRoot(kit.spec, each.key);
      const styles = each.elements[0]?.styles ?? {};
      return (
        [
          ["left", root.paddingLeft],
          ["right", root.paddingRight],
        ] as const
      ).flatMap(([side, length]) => {
        const figma = pixelsIn(file.figma, length, each.mode);
        const chromium = Number.parseFloat(styles[`padding-${side}`] ?? "");
        return Math.abs(figma - chromium) <= PADDING_TOLERANCE_PX
          ? []
          : [
              `${each.key} ${named(each.mode)}: ${side} ${String(figma)} in Figma, ${String(chromium)} in Chromium`,
            ];
      });
    });
    expect(new Set(swept.map(({ cell }) => cell.size))).toEqual(LABEL_SIZES);
    expect(new Set(swept.map(({ mode }) => mode))).toEqual(new Set(file.modes));
    expect(apart).toEqual([]);
  });
});
