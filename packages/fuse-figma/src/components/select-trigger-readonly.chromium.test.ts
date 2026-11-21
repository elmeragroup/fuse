/**
 * Unit under test: the fill of each read-only Select trigger, as the kit builds it, resolved in the
 * in-memory file the token sync writes under every pin a designer can give a frame
 * (`test/mode-sweep.ts`).
 * Oracle: Chromium's computed `background-color` of the same cell, rendered as `figma:capture`
 * renders it, under the theme each pin stamps. `figma:capture --check` reads one theme, and the
 * frozen keys and the inventory counts read no color, so this test goes red where the build binds
 * the wrong role, such as `card-soft` for `muted`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import {
  colorIn,
  computedColor,
  named,
  rgba,
  sameColor,
  sweepSet,
  sweptFile,
} from "../../test/mode-sweep.ts";
import type { SweptCell, SweptFile } from "../../test/mode-sweep.ts";

/**
 * How far apart a built fill's channel and Chromium's may sit, in `0..1`. Chromium computes the
 * solid `muted` fill as `oklch()`, which converts back to sRGB within 0.000002 of the synced color.
 * `card-soft` sits 0.0037 from `muted` in Fjordkraft's private light neutral dense theme, so it
 * cannot pass for it.
 */
const FILL_TOLERANCE = 0.0001;

let kit: BuiltSets;
let file: SweptFile;
let swept: readonly SweptCell[];

beforeAll(async () => {
  [kit, file] = await Promise.all([builtKit(), sweptFile()]);
  swept = await sweepSet("select-trigger", (cell) => cell.state === "readonly", file.modes, [
    "background-color",
  ]);
});

describe("the Select trigger set", () => {
  it("fills a read-only trigger as Chromium does under every pin", () => {
    const apart = swept.flatMap((each) => {
      const { fill } = variantRoot(kit.spec, each.key);
      if (fill === undefined || fill.kind === "image") {
        throw new Error(`${each.key} draws no color fill`);
      }
      const figma = colorIn(file.figma, fill, each.mode);
      const chromium = computedColor(each.elements[0]?.styles["background-color"]);
      return sameColor(figma, chromium, FILL_TOLERANCE)
        ? []
        : [`${each.key} ${named(each.mode)}: ${rgba(figma)} in Figma, ${rgba(chromium)} in Chromium`];
    });
    expect(new Set(swept.map(({ mode }) => mode))).toEqual(new Set(file.modes));
    expect(swept.length).toBeGreaterThan(file.modes.length);
    expect(apart).toEqual([]);
  });
});
