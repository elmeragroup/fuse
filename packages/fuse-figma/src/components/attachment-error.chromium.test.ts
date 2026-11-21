/**
 * Unit under test: the stroke of a failed Attachment row and the fill of its media, as the kit
 * builds them, resolved in the in-memory file the token sync writes under every pin a designer can
 * give a frame (`test/mode-sweep.ts`).
 * Oracle: Chromium's computed `border-top-color` of the row and `background-color` of its
 * `attachment-media`, on the same cell rendered as `figma:capture` renders it, under the theme each
 * pin stamps. `figma:capture --check` reads one theme, and the frozen keys and the inventory counts
 * read no color, so this test goes red where the build binds the wrong tint, such as `error/20` for
 * `error/30`.
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
 * How far apart a built color's channel and Chromium's may sit, in `0..1`: Chromium serializes a
 * mixed tint in `oklab()` at a few digits, which converts back to sRGB within a thousandth. The
 * tints a row could swap differ by far more, such as `error/20` and `error/30` in alpha.
 */
const TINT_TOLERANCE = 0.004;

let kit: BuiltSets;
let file: SweptFile;
let swept: readonly SweptCell[];

beforeAll(async () => {
  [kit, file] = await Promise.all([builtKit(), sweptFile()]);
  swept = await sweepSet("attachment", (cell) => cell.state === "error", file.modes, [
    "border-top-color",
    "background-color",
  ]);
});

describe("the Attachment set", () => {
  it("strokes a failed row and fills its media as Chromium does under every pin", () => {
    const apart = swept.flatMap((each) => {
      const root = variantRoot(kit.spec, each.key);
      const media = root.children.find(({ key }) => key === "media");
      const fill = media?.kind === "frame" ? media.fill : undefined;
      if (root.stroke === undefined || fill === undefined || fill.kind === "image") {
        throw new Error(`${each.key} draws no stroke or no media fill`);
      }
      const element = each.elements.find(({ place }) => place === "attachment-media");
      const pairs = [
        [
          "stroke",
          colorIn(file.figma, root.stroke.color, each.mode),
          computedColor(each.elements[0]?.styles["border-top-color"]),
        ],
        ["media", colorIn(file.figma, fill, each.mode), computedColor(element?.styles["background-color"])],
      ] as const;
      return pairs.flatMap(([field, figma, chromium]) =>
        sameColor(figma, chromium, TINT_TOLERANCE)
          ? []
          : [
              `${each.key} ${named(each.mode)}: ${field} ${rgba(figma)} in Figma, ${rgba(chromium)} in Chromium`,
            ]
      );
    });
    expect(new Set(swept.map(({ mode }) => mode))).toEqual(new Set(file.modes));
    expect(swept.length).toBeGreaterThan(file.modes.length);
    expect(apart).toEqual([]);
  });
});
