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
import { diffInstance } from "./instance-diff";

// Oracle: CSS Backgrounds 3 §3.7 and §5.2, and the Figma plugin typings. `padding-box` paints the
// background inside the border only, and the corner there is the outer radius less the border width,
// at least 0. Figma paints a frame's fill under the whole frame and an INSIDE stroke over it: the two
// draw alike where the box has no border, or a solid border that hides the fill under it because it
// is opaque. A translucent or dashed border shows what lies behind the box, so the fill draws on a
// layer inset by the border, unless its corner would be elliptical, which no Figma radius holds.
describe("background-clip: padding-box", () => {
  const WHITE = { kind: "literal", color: { r: 1, g: 1, b: 1, a: 1 } } as const;
  const PLACED = { horizontal: { kind: "placed" }, vertical: { kind: "placed" } } as const;
  const DRAWN =
    "the fill draws on the `padding box` layer, inset by the border under the stroke, so the border shows what lies behind the box";
  const EMPTY =
    "the border leaves no padding box at the length the main component takes, so an instance resized larger would have no layer to fill inside the border";

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
  ])("on %s is %s", async (classes, outcome, detail) => {
    const { coverage, variant } = await buildChip(classes);
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", outcome, detail]]);
    expect(variant?.root.fill).toEqual(WHITE);
  });

  it.each([
    ["border border-[#00000080]", { top: 1, right: 1, bottom: 1, left: 1 }, literal(0)],
    ["border border-dashed border-[#000000]", { top: 1, right: 1, bottom: 1, left: 1 }, literal(0)],
    ["border-0 border-s border-[#00000080]", { top: 0, right: 0, bottom: 0, left: 1 }, literal(0)],
    ["rounded-[8px] border-2 border-[#00000080]", { top: 2, right: 2, bottom: 2, left: 2 }, literal(6)],
    ["rounded-[1px] border-2 border-[#00000080]", { top: 2, right: 2, bottom: 2, left: 2 }, literal(0)],
  ])("beside %s draws the fill inside the border", async (border, insets, corner) => {
    const { coverage, variant } = await buildChip(`bg-clip-padding bg-[#ffffff] ${border} size-[40px]`);
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", "literal", DRAWN]]);
    const layer = frameOf(variant?.root);
    expect(variant?.root.fill).toBeUndefined();
    expect({
      key: layer?.key,
      fill: layer?.fill,
      placement: layer?.placement,
      sizing: layer?.sizing,
      cornerRadius: layer?.cornerRadius,
    }).toEqual({
      key: "padding box",
      fill: WHITE,
      placement: {
        kind: "edges",
        within: "parent",
        horizontal: { kind: "stretch", start: insets.left, end: insets.right },
        vertical: { kind: "stretch", start: insets.top, end: insets.bottom },
      },
      sizing: PLACED,
      cornerRadius: corner,
    });
  });

  it("stays unmapped beside a round corner between borders of two widths, whose inner corner is elliptical", async () => {
    const { coverage, variant } = await buildChip(
      "bg-clip-padding bg-[#ffffff] rounded-[8px] border-0 border-s border-[#00000080]"
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      [
        "background-clip",
        "unmapped",
        "a round corner between borders of two widths has an elliptical inner corner (CSS Backgrounds 3 §5.2), which no Figma corner radius holds",
      ],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
  });

  // CSS Box Sizing 3 §4.1: under `border-box` the content box is the width less the borders, at
  // least 0. A 2px box with 2px borders and a 4px one both leave no padding box, and an `inline-flex`
  // box with no content and no padding hugs its 1px borders, 2px across. Nothing paints inside the
  // border there, but an instance resized wider paints inside it, where a main with no layer has none
  // to stretch, so the box keeps its fill.
  it.each([
    "border-2 border-[#00000080] size-[2px]",
    "border-2 border-[#00000080] size-[4px]",
    "inline-flex h-[100px] border border-[#00000080]",
  ])("stays unmapped beside borders that leave the box %s no padding box", async (classes) => {
    const { coverage, variant } = await buildChip(`bg-clip-padding bg-[#ffffff] ${classes}`);
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", "unmapped", EMPTY]]);
    expect(variant?.root.fill).toEqual(WHITE);
    expect(variant?.root.children).toEqual([]);
  });

  // CSS Box Sizing 3 §4.1: at a 16px font `p-[1em]` pads each side 16px, so `size-[4px] p-[1em]
  // border-2` lays out a 36px box whose padding box Chromium fills 32px across. The kit reads no `em`
  // padding, so it cannot tell that the padding box is not empty.
  it("stays unmapped beside a padding the box does not read, which could leave room inside the border", async () => {
    const { coverage, variant } = await buildChip(
      "bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] p-[1em] size-[4px]"
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      [
        "background-clip",
        "unmapped",
        "the box sets a padding the kit does not read, which could lay the box out larger than the length its frame takes, so the kit cannot size the padding box",
      ],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
  });

  // CSS Backgrounds 3 §4.3: a side whose style is `none` or `hidden` has a border width of 0, so
  // Chromium paints the fill out to that edge, where the stroke's one weight would inset it there.
  it.each([
    "[border-left-style:none]",
    "[border-left-style:hidden]",
    "[border-inline-start-style:none]",
    "[border-block-end-style:hidden]",
  ])("stays unmapped beside %s, which leaves that side no border", async (side) => {
    const { coverage, variant } = await buildChip(
      `bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] ${side} size-[40px]`
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      [
        "background-clip",
        "unmapped",
        "a side's own border style draws no border on that side, so the kit cannot tell where the padding box starts on it",
      ],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
    expect(variant?.root.children).toEqual([]);
  });

  // CSS Box Sizing 3 §4.1: under `border-box` the padding and borders floor the used size, so
  // `size-[4px] p-[2px] border-2` lays out an 8px box, and its 4px padding box paints. The frame keeps
  // the 4px the box sets, so the kit cannot draw that padding box.
  it("stays unmapped where the padding and borders lay out a box larger than its size", async () => {
    const { coverage, variant } = await buildChip(
      "bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] p-[2px] size-[4px]"
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      [
        "background-clip",
        "unmapped",
        "the padding and borders lay the box out larger than the length its frame takes, so the kit cannot size the padding box",
      ],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
    expect(variant?.root.children).toEqual([]);
  });

  it("draws the fill in a box that hugs its padding inside its borders", async () => {
    const { coverage, variant } = await buildChip(
      "bg-clip-padding bg-[#ffffff] inline-flex h-[100px] px-[2px] border border-[#00000080]"
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", "literal", DRAWN]]);
    expect(frameOf(variant?.root)?.key).toBe("padding box");
  });

  // At device scale 1 Chromium draws both a 0.5px and a 1.5px border 1px wide, where the capture holds
  // the authored width, so the kit cannot tell where the padding box starts.
  it.each(["border-[0.5px]", "border-[1.5px]"])(
    "stays unmapped beside a %s border, which Chromium snaps to whole device pixels",
    async (border) => {
      const { coverage, variant } = await buildChip(
        `bg-clip-padding bg-[#ffffff] ${border} border-[#00000080] size-[40px]`
      );
      expect(notesOf(coverage, "bg-clip-padding")).toEqual([
        [
          "background-clip",
          "unmapped",
          "Chromium snaps a fractional border width to whole device pixels, and the capture holds the authored width, so the kit cannot tell where the padding box starts",
        ],
      ]);
      expect(variant?.root.fill).toEqual(WHITE);
    }
  );

  // CSS Backgrounds 3 §5.2: inside 1px borders a 20px top left corner is 19px, on a padding box 22px
  // wide beside a 17px right border. Figma caps a corner at half the shorter side (probe P10), 11px
  // there, where CSS draws all 19px. A 12px corner leaves 11px inside, which Figma draws as written.
  it("stays unmapped where Figma would cap the corner inside the border", async () => {
    const { coverage, variant } = await buildChip(
      "bg-clip-padding bg-[#ffffff] border-0 border-t border-b border-l border-r-[17px] border-[#00000080] rounded-tl-[20px] size-[40px]"
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      [
        "background-clip",
        "unmapped",
        "the corner inside the border is more than half the padding box's shorter side, which Figma caps it at",
      ],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
  });

  it("rounds the fill by a corner inside the border within half the padding box", async () => {
    const { variant } = await buildChip(
      "bg-clip-padding bg-[#ffffff] border-0 border-t border-b border-l border-r-[17px] border-[#00000080] rounded-tl-[12px] size-[40px]"
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual({
      kind: "corners",
      topLeft: literal(11),
      topRight: literal(0),
      bottomRight: literal(0),
      bottomLeft: literal(0),
    });
  });

  // Figma's STRETCH constraint resizes the layer with its parent, so an instance of a 160px component
  // resized to 240px carries no override for the layer, and nothing about it stays unmapped.
  it("draws a layer that an instance at another width resizes with no override", async () => {
    const classes = "bg-clip-padding bg-[#ffffff] border border-[#00000080] h-[40px]";
    const component = await buildChip(`${classes} w-[160px]`);
    const resized = await buildChip(`${classes} w-[240px]`);
    const [main, inPlace] = [component.variant?.root, resized.variant?.root];
    if (main === undefined || inPlace === undefined) {
      throw new Error("the chip set builds no variant");
    }
    expect(frameOf(main)).toMatchObject({ key: "padding box", fill: WHITE });
    const diff = diffInstance(inPlace, main);
    expect({ overrides: diff.overrides, unmapped: diff.unmapped }).toEqual({ overrides: [], unmapped: [] });
  });

  // CSS Box Sizing 3 §4.1: under `content-box` a 40px width sets the content box, so 2px borders make
  // the box 44px and its padding box 40px.
  it("insets the fill by the border of a content box, around the 40px it sets", async () => {
    const { coverage, variant } = await buildChip(
      "flex",
      [
        {
          slot: "chip-dot",
          classes: "box-content size-[40px] border-2 border-[#00000080] bg-clip-padding bg-[#ffffff]",
        },
      ],
      { parts: [part()] }
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", "literal", DRAWN]]);
    const dot = frameOf(variant?.root);
    expect(dot?.children.map((child) => child.key)).toEqual(["padding box", "content"]);
    const [layer, content] = dot?.children ?? [];
    expect({
      outer: dot?.sizing,
      placement: layer?.kind === "frame" ? layer.placement : layer,
      content: content?.kind === "frame" ? content.sizing : content,
    }).toEqual({
      outer: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
      placement: {
        kind: "edges",
        within: "parent",
        horizontal: { kind: "stretch", start: 2, end: 2 },
        vertical: { kind: "stretch", start: 2, end: 2 },
      },
      content: fixedSize(literal(40), literal(40)),
    });
  });

  // A root draws no inner frame for its content box, so its 40px frame is the content box, where the
  // border box CSS insets the fill from is 44px (CSS Box Sizing 3 §4.1).
  it("stays unmapped on a content box root, whose frame is not its border box", async () => {
    const { coverage, variant } = await buildChip(
      "box-content size-[40px] border-2 border-[#00000080] bg-clip-padding bg-[#ffffff]"
    );
    expect(notesOf(coverage, "bg-clip-padding").map(([property, outcome]) => [property, outcome])).toEqual([
      ["background-clip", "unmapped"],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
  });

  // CSS Backgrounds 3 §5.2: the padding box sits in by each side's border width, 4px on the left
  // under `border-l-4`, and a 50% corner on a 40px box is 20px, 18px inside a 2px border. Where the
  // kit cannot read the width or the corner that shapes the padding box, it cannot draw the clip.
  it.each([
    "border-2 border-l-4 border-l-[#00000080] border-[#00000080]",
    "rounded-[50%] border-2 border-[#00000080]",
  ])("stays unmapped where %s shapes the padding box in a way the box does not map", async (border) => {
    const { coverage, variant } = await buildChip(`bg-clip-padding bg-[#ffffff] ${border} size-[40px]`);
    expect(notesOf(coverage, "bg-clip-padding").map(([property, outcome]) => [property, outcome])).toEqual([
      ["background-clip", "unmapped"],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
    expect(variant?.root.children).toEqual([]);
  });

  // CSS Logical Properties 1 §6.2: on a left-to-right page `rounded-ss-*` rounds the top left corner.
  // The corner inside a 1px border is that radius less 1px, at least 0 (CSS Backgrounds 3 §5.2),
  // which the synced variable spelling that binds.
  it("binds the inner corner of a radius a logical longhand sets", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 16,
      },
      {
        ref: { collection: "Fuse tokens", name: "radius-inner/border" },
        webSyntax: "max(0px, var(--radius) - 1px)",
        minimum: 3,
        maximum: 15,
      },
    ]);
    const { coverage, variant } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "bg-clip-padding bg-[#ffffff] border border-[#00000080] size-[40px] rounded-ss-(--radius)",
      }),
      { variables }
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", "literal", DRAWN]]);
    expect(frameOf(variant?.root)?.cornerRadius).toEqual({
      kind: "corners",
      topLeft: { kind: "variable", variable: { collection: "Fuse tokens", name: "radius-inner/border" } },
      topRight: literal(0),
      bottomRight: literal(0),
      bottomLeft: literal(0),
    });
  });

  it.each([
    [true, "dropped"],
    [false, "literal"],
  ])("beside a border bound to a variable opaque in every mode (%s) is %s", async (opaque, outcome) => {
    const variables = makeVariableIndex([
      { ref: { collection: "Fuse tokens", name: "border" }, webSyntax: "var(--border)", opaque },
    ]);
    const { coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "bg-clip-padding bg-[#ffffff] border border-(--border) size-[40px]" }),
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
