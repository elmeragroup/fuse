/**
 * How the build paints a box: a background clipped to the padding box, `currentcolor` a custom property passes down, and a part under `visibility: hidden`. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Each case names its oracle: the CSS specification that says what the
 * browser draws, or the Figma plugin typings that say what Figma draws, under the coverage contract,
 * where a declaration that does not reach Figma is `unmapped` and one with nothing to draw is
 * `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  buildChip,
  chip,
  fixedSize,
  frameOf,
  literal,
  notesOf,
  part,
  rest,
} from "../../test/capture-fixtures";
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
// of a box fixed on both axes, which keeps its size either way, or of a box that hugs it, drawn at the
// part's literal size and its own padding and border, as CSS keeps the hidden part's room in it; a
// part whose margins a hugging frame draws has no literal size there, so a box that hugs it cannot
// keep the room CSS keeps for it (8px and 2px margins hold 12px), and it stays unmapped.
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

  it("draws hidden in a box that hugs it, which keeps the part's literal size and its padding", async () => {
    const { variant } = await buildChip(
      "flex p-[2px]",
      [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.hidden).toBe(true);
    expect(variant?.root.sizing).toEqual(fixedSize(literal(12), literal(12)));
  });

  it("keeps a shorthand border beside the padding around the part it holds", async () => {
    const { variant } = await buildChip(
      "flex p-[2px] border-[3px] border-[#000000]",
      [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
      { parts: [part()] }
    );
    expect(variant?.root.sizing).toEqual(fixedSize(literal(18), literal(18)));
  });

  it("hides a part with margins in a fixed box, and leaves it unmapped in a box that hugs it", async () => {
    const hidden = async (classes: string) => {
      const { variant, coverage } = await buildChip(
        classes,
        [{ slot: "chip-dot", classes: "size-[8px] m-[2px] invisible" }],
        {
          parts: [part()],
        }
      );
      return {
        hidden: frameOf(variant?.root)?.hidden,
        notes: notesOf(coverage, "invisible").map(([, outcome]) => outcome),
      };
    };
    expect(await hidden("flex size-[24px]")).toEqual({ hidden: true, notes: ["literal"] });
    expect(await hidden("flex")).toEqual({ hidden: undefined, notes: ["unmapped"] });
  });

  it("stays unmapped in a box that hugs a part of no literal size", async () => {
    const { variant, coverage } = await buildChip(
      "flex",
      [{ slot: "chip-dot", classes: "h-[8px] invisible" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.hidden).toBeUndefined();
    expect(notesOf(coverage, "invisible").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Logical Properties 1 §6.2 and CSS Backgrounds 3 §5.5, against Figma's four corner
// radii, each capped at half the shorter side (probe P10). On the kit's left-to-right page
// `rounded-s-*` rounds the top left and bottom left. CSS scales every radius by one factor where the
// radii along a side add past it, so `rounded-s-full` on a 36px square is 18px on both left corners,
// within the cap, and two 20px corners along a 36px side are 18px each; `rounded-tl-full` alone
// scales to the whole 36px side, a 30px corner alone keeps 30px, and a 30px and a 10px corner along
// a 36px side are 27px and 9px, each past the 18px Figma would draw, so they stay unmapped. A variable maps only where its greatest value in any mode leaves
// CSS nothing to scale and stays within the cap. A box that also sets `border-radius` leaves the
// order of the two to the cascade, which the build does not read, so it stays unmapped too.
describe("a radius per corner", () => {
  const corners = (topLeft: number, topRight: number, bottomRight: number, bottomLeft: number) => ({
    kind: "corners",
    topLeft: literal(topLeft),
    topRight: literal(topRight),
    bottomRight: literal(bottomRight),
    bottomLeft: literal(bottomLeft),
  });

  it.each([
    ["size-[36px] rounded-s-full", corners(18, 0, 0, 18)],
    ["size-[36px] rounded-e-full", corners(0, 18, 18, 0)],
    ["size-[36px] rounded-t-[8px]", corners(8, 8, 0, 0)],
    ["size-[36px] rounded-ss-[4px] rounded-ee-[6px]", corners(4, 0, 6, 0)],
    ["size-[36px] rounded-tl-[20px] rounded-tr-[20px]", corners(18, 18, 0, 0)],
  ])("draws %s on the corners it names", async (classes, expected) => {
    const { variant, coverage } = await buildChip(classes);
    expect(variant?.root.cornerRadius).toEqual(expected);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("reads the sides of a box that hugs one part of a literal size", async () => {
    const { variant } = await buildChip(
      "flex rounded-s-full",
      [{ slot: "chip-dot", classes: "size-[36px]" }],
      {
        parts: [part()],
      }
    );
    expect(variant?.root.cornerRadius).toEqual(corners(18, 0, 0, 18));
  });

  it("reads the sides a box's minimum holds it at around a smaller part, as CSS raises it", async () => {
    const { variant } = await buildChip(
      "flex min-w-[64px] min-h-[64px] rounded-s-full",
      [{ slot: "chip-dot", classes: "size-[36px]" }],
      { parts: [part()] }
    );
    expect(variant?.root.cornerRadius).toEqual(corners(32, 0, 0, 32));
  });

  it("leaves the corners unmapped where a limit it cannot read could set the box's side", async () => {
    const { variant } = await buildChip(
      "flex min-w-[50%] rounded-s-full",
      [{ slot: "chip-dot", classes: "size-[36px]" }],
      {
        parts: [part()],
      }
    );
    expect(variant?.root.cornerRadius).toEqual(literal(0));
  });

  it("binds each corner a variable sets to that variable", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 16,
      },
    ]);
    const { variant } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "size-[36px] rounded-t-(--radius)" }),
      {
        variables,
      }
    );
    const radius = { kind: "variable", variable: { collection: "Fuse tokens", name: "radius" } };
    expect(variant?.root.cornerRadius).toEqual({
      kind: "corners",
      topLeft: radius,
      topRight: radius,
      bottomRight: literal(0),
      bottomLeft: literal(0),
    });
  });

  it("leaves a variable that CSS scales in some mode unmapped", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 24,
      },
    ]);
    const { variant } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "size-[36px] rounded-t-(--radius)" }),
      {
        variables,
      }
    );
    expect(variant?.root.cornerRadius).toEqual(literal(0));
  });

  it.each([
    "size-[36px] rounded-tl-full",
    "size-[36px] rounded-tl-[30px]",
    "size-[36px] rounded-tl-[30px] rounded-tr-[10px]",
    "rounded-s-full",
    "size-[36px] rounded-[4px] rounded-s-[8px]",
  ])("leaves %s unmapped", async (classes) => {
    const { variant, coverage } = await buildChip(classes);
    expect(variant?.root.cornerRadius).toEqual(literal(0));
    expect(coverage.some((row) => row.outcome === "unmapped" && row.property.endsWith("radius"))).toBe(true);
  });
});

// Oracle: CSS Logical Properties 1 §4, CSS Cascade 5 §6 and CSS Backgrounds 3 §3.3. In a
// left-to-right horizontal page `border-inline-start-color` and `border-inline-color` set the left
// side's color, and the declaration applied last wins it, so `border-s-*` or `border-x-*` after a
// `border-*` color paints the left side, as a chip segment's `border-transparent border-0 border-s
// border-s-border` draws a hairline. A side at a zero width draws nothing whatever its style.
describe("a stroke on some sides", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;

  it("takes the color its drawing side sets of its own", async () => {
    const { variant, coverage } = await buildChip(
      "border border-transparent border-0 border-s border-s-[#ff0000]"
    );
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 0, right: 0, bottom: 0, left: 1 } });
    expect(notesOf(coverage, "border-transparent")).toEqual([
      ["border-color", "dropped", "it colors only sides the border gives no width, which draw nothing"],
    ]);
  });

  it("takes the color of the axis shorthand that wins its drawing side", async () => {
    const { variant, coverage } = await buildChip("border-s border-transparent border-x-[#ff0000]");
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 0, right: 0, bottom: 0, left: 1 } });
    expect(notesOf(coverage, "border-transparent")).toEqual([
      ["border-color", "dropped", "it colors only sides the border gives no width, which draw nothing"],
    ]);
  });

  it.each([
    "border-s-0 border-transparent",
    "border-s-0 [border-inline-start-style:dashed] border-s-[#ff0000]",
    "border-t-0 border-r-0 border-b-0 border-l-0 border-transparent",
  ])("draws no stroke from %s, whose sides have no width", async (classes) => {
    const { variant, coverage } = await buildChip(classes);
    expect(variant?.root.stroke).toBeUndefined();
    const color = classes.split(" ").at(-1) ?? "";
    expect(notesOf(coverage, color).map(([, outcome, detail]) => [outcome, detail])).toEqual([
      ["dropped", "it colors only sides the border gives no width, which draw nothing"],
    ]);
  });

  it("leaves the stroke unmapped where a border shorthand wins its drawing side's color", async () => {
    // `border-left` comes after `border-inline-color`, so its blue wins the left side's color, and
    // the left side's own width and style, after both, draw it.
    const { variant, coverage } = await buildChip(
      "[border-inline-color:#ff0000] [border-left:0_solid_#0000ff] border-l [border-left-style:solid]"
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "[border-left:0_solid_#0000ff]")).toEqual([
      [
        "border-left",
        "unmapped",
        "a border shorthand colors a side that draws, and the build does not read it",
      ],
    ]);
    expect(notesOf(coverage, "[border-inline-color:#ff0000]")).toEqual([
      [
        "border-inline-color",
        "dropped",
        "it colors only sides the border gives no width, which draw nothing",
      ],
    ]);
  });

  it("leaves a side's color unmapped where its style does not map", async () => {
    const { variant, coverage } = await buildChip(
      "border-s [border-inline-start-style:dashed] border-transparent border-s-[#ff0000]"
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "border-s-[#ff0000]").map(([property, outcome]) => [property, outcome])).toEqual(
      [["border-inline-start-color", "unmapped"]]
    );
  });

  it("leaves the stroke out where the sides that draw take two colors", async () => {
    const { variant, coverage } = await buildChip(
      "border-0 border-s border-e border-s-[#ff0000] border-e-[#0000ff]"
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "border-s-[#ff0000]")).toEqual([
      [
        "border-inline-start-color",
        "unmapped",
        "Figma strokes every side in one color, and the sides that draw take two",
      ],
    ]);
  });
});
