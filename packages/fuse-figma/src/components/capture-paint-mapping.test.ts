/**
 * How the build paints a box: a background clipped to the padding box, `currentcolor` a custom property passes down, and a part under `visibility: hidden`. The unit under test is `buildComponentSet` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Each case names its oracle: the CSS specification that says what the
 * browser draws, or the Figma plugin typings that say what Figma draws, under the coverage contract,
 * where a declaration that does not reach Figma is `unmapped` and one with nothing to draw is
 * `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, buildChip, chip, frameOf, notesOf, part, rest } from "../../test/capture-fixtures";
import { makeVariableIndex } from "./css-values";

// Oracle: CSS Backgrounds 3 §3.7 and the Figma plugin typings. `padding-box` paints the background
// inside the border only, where Figma paints a fill under the whole frame and an INSIDE stroke over
// it: the two draw alike where the box has no border, or a solid border that hides the fill under it
// because it is opaque. A translucent or dashed border shows what the clip leaves out.
describe("background-clip: padding-box", () => {
  it.each([
    [
      "bg-clip-padding bg-[#ffffff]",
      "dropped",
      "the box has no border, so its padding box is its border box",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border border-[#000000]",
      "dropped",
      "the box's border draws as a solid stroke, opaque in every mode, over the fill beneath it",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border border-[#00000080]",
      "unmapped",
      "no Figma field reads padding-box",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border border-dashed border-[#000000]",
      "unmapped",
      "no Figma field reads padding-box",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border-0 border-s border-[#00000080]",
      "unmapped",
      "no Figma field reads padding-box",
    ],
  ])("on %s is %s", async (classes, outcome, detail) => {
    const { coverage } = await buildChip(classes);
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", outcome, detail]]);
  });

  it.each([
    [true, "dropped"],
    [false, "unmapped"],
  ])("beside a border bound to a variable opaque in every mode (%s) is %s", async (opaque, outcome) => {
    const variables = makeVariableIndex([
      { ref: { collection: "Fuse tokens", name: "border" }, webSyntax: "var(--border)", opaque },
    ]);
    const { coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "bg-clip-padding bg-[#ffffff] border border-(--border)" }),
      { variables }
    );
    expect(notesOf(coverage, "bg-clip-padding").map(([, read]) => read)).toEqual([outcome]);
  });
});

// Oracle: CSS Color 4 §6.4. `currentcolor` that a custom property passes down resolves where it is
// used: on `color`, to the color the element inherits, and on any other property, to the element's
// own `color`.
describe("currentcolor through a custom property", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;
  const GREEN = { kind: "literal", color: { r: 0, g: 1, b: 0, a: 1 } } as const;

  it("fills a part with the part's own color", async () => {
    const { variant } = await buildChip(
      "flex text-[#ff0000] [--x:currentColor]",
      [{ slot: "chip-dot", classes: "size-[8px] text-[#00ff00] bg-(--x)" }],
      { parts: [part()] }
    );
    expect(frameOf(variant?.root)?.fill).toEqual(GREEN);
  });

  it("colors a part's text with the color it inherits", async () => {
    const { variant } = await buildCaptured(
      chip({
        parts: [
          part({
            label: {
              key: "label",
              name: "label",
              characters: "Hi",
              textProperty: undefined,
              shownIn: () => true,
            },
          }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex font-sans text-[14px] leading-[20px] text-[#ff0000] [--x:currentColor]",
        children: [{ slot: "chip-dot", text: "Hi", classes: "text-(color:--x)" }],
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
    const text = frameOf(variant?.root)?.children[0];
    expect(text?.kind === "text" ? text.color : text).toEqual(RED);
  });

  it("colors the text of a part below with the color the declaring part inherits", async () => {
    const { variant } = await buildCaptured(
      chip({
        parts: [
          part({
            parts: [
              part({
                key: "cell",
                slot: "cell",
                label: {
                  key: "label",
                  name: "label",
                  characters: "Hi",
                  textProperty: undefined,
                  shownIn: () => true,
                },
              }),
            ],
          }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex font-sans text-[14px] leading-[20px] text-[#ff0000] [--x:currentColor]",
        children: [
          { slot: "chip-dot", classes: "flex text-(color:--x)", children: [{ slot: "cell", text: "Hi" }] },
        ],
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
    const text = frameOf(frameOf(variant?.root))?.children[0];
    expect(text?.kind === "text" ? text.color : text).toEqual(RED);
  });
});

// Oracle: CSS Display 3 §4.1 and the Figma plugin typings. `visibility: hidden` paints nothing of
// the box while it keeps its room, and a Figma layer with `visible` false paints nothing while its
// auto layout lays out as if it were gone. The two draw alike where the hidden part is the one layer
// of a box fixed on both axes, which keeps its size either way, and not in a box that hugs it.
describe("a hidden part", () => {
  it("draws hidden as the one layer of a fixed box", async () => {
    const { variant, coverage } = await buildChip(
      "flex size-[24px]",
      [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.hidden).toBe(true);
    expect(notesOf(coverage, "invisible").map(([property, outcome]) => [property, outcome])).toEqual([
      ["visibility", "literal"],
    ]);
  });

  it("stays unmapped in a box that hugs it", async () => {
    const { variant, coverage } = await buildChip(
      "flex",
      [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.hidden).toBeUndefined();
    expect(notesOf(coverage, "invisible").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});
