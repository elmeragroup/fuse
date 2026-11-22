/**
 * How the build draws a fill that `background-clip: padding-box` stops at the border
 * (`padding-box-fill.ts`). The unit under test is `buildSetsInOrder` on hand-built captures of
 * one-cell `chip` sets (`test/capture-fixtures.ts`), and `diffInstance` on the roots it builds. Each
 * case names its oracle: the CSS specification that says what the browser draws, or the Figma plugin
 * typings that say what Figma draws, under the coverage contract, where a declaration that does not
 * reach Figma is `unmapped` and one with nothing to draw is `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  buildChip,
  chip,
  fixedSize,
  frameOf,
  instanceOf,
  literal,
  notesOf,
  part,
  rest,
} from "../../test/capture-fixtures";
import { makeVariableIndex, pinnedIndex } from "./css-values";
import { settleInstanceRoot } from "./hugging-rows";
import { diffInstance } from "./instance-diff";
import type { VariableRef } from "./kit-spec";

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
    ["border-2 border-l-4 border-[#00000080]", { top: 2, right: 2, bottom: 2, left: 4 }, literal(0)],
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
    const diff = diffInstance(
      inPlace,
      main,
      settleInstanceRoot(inPlace, main, "elsewhere", { neverWraps: () => false, fitsItsLine: false })
    );
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

  // CSS Backgrounds 3 §5.2: a 50% corner on a 40px box is 20px, 18px inside a 2px border. Where the
  // kit cannot read the corner that shapes the padding box, it cannot draw the clip.
  it("stays unmapped where a corner the box does not map shapes the padding box", async () => {
    const { coverage, variant } = await buildChip(
      "bg-clip-padding bg-[#ffffff] rounded-[50%] border-2 border-[#00000080] size-[40px]"
    );
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

  // A layer of the box already takes the key the fill's layer would take, and two layers of one box
  // under one key would give one key path to both, so the box keeps its fill.
  it("stays unmapped on a box that holds a layer keyed `padding box`", async () => {
    const { coverage, variant } = await buildChip(
      "flex bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] p-[4px]",
      [{ slot: "chip-dot", classes: "size-[12px] bg-[#0000ff]" }],
      { parts: [part({ key: "padding box" })] }
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      [
        "background-clip",
        "unmapped",
        "the box holds a layer keyed `padding box`, the key the layer that draws its fill inside the border takes",
      ],
    ]);
    expect(variant?.root.fill).toEqual(WHITE);
    expect(variant?.root.children.map((child) => child.key)).toEqual(["padding box"]);
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

// Oracle: Figma's instance model, under which an instance carries a fill override at a layer's key
// path, and CSS Backgrounds 3 §3.7, under which a transparent background paints nothing inside the
// border either. The tag's main draws its white fill on its `padding box` layer, so a composite that
// clears the fill clears that layer's, and the composite's row reaches Figma through that override.
describe("an instance whose composite clears a fill the main draws inside the border", () => {
  const tag = chip({ key: "review-tag", name: "Review tag", slot: "tag" });
  const TAG_CLASSES = "size-[20px] bg-[#ffffff] bg-clip-padding border-2 border-[#00000080]";

  it("clears the fill of the main's `padding box` layer", async () => {
    const clear = "data-on:bg-transparent";
    const { variant, coverage } = await buildCaptured(
      chip({ parts: [instanceOf("tag", tag)] }),
      rest({
        slot: "chip",
        classes: "flex w-[200px]",
        children: [{ slot: "tag", classes: `${TAG_CLASSES} ${clear}` }],
      }),
      { inner: [{ manifest: tag, cells: rest({ slot: "tag", classes: TAG_CLASSES, carried: clear }) }] }
    );
    const [instance] = variant?.root.children ?? [];
    expect(instance?.kind === "instance" ? instance.overrides : instance).toEqual([
      { path: ["padding box"], field: "fill", color: undefined },
    ]);
    expect(notesOf(coverage, clear).map(([property, outcome]) => [property, outcome])).toEqual([
      ["background-color", "literal"],
    ]);
  });

  /** The tag drawn as an instance of a main that wins `main`, its composite adding `composite`. */
  const instanceOfTag = (main: string, composite: string) =>
    buildCaptured(
      chip({ parts: [instanceOf("tag", tag)] }),
      rest({
        slot: "chip",
        classes: "flex w-[200px]",
        children: [{ slot: "tag", classes: `${main} ${composite}` }],
      }),
      { inner: [{ manifest: tag, cells: rest({ slot: "tag", classes: main, carried: composite }) }] }
    );

  /** The outcome of each row a class gives. */
  const outcomes = (coverage: Awaited<ReturnType<typeof buildCaptured>>["coverage"], className: string) =>
    notesOf(coverage, className).map(([, outcome]) => outcome);

  /** The overrides of the chip's first layer, the tag instance. */
  const overridesOf = (variant: Awaited<ReturnType<typeof buildCaptured>>["variant"]) => {
    const [instance] = variant?.root.children ?? [];
    return instance?.kind === "instance" ? (instance.overrides ?? []) : instance;
  };

  // An opaque border needs no clip, so the instance in place paints its red fill on its frame. The
  // main's layer still paints white over that frame inside the border, which no root fill override
  // reaches.
  it("leaves a fill the instance moves onto its frame unmapped", async () => {
    const red = "data-on:bg-[#ff0000]";
    const { variant, coverage } = await instanceOfTag(TAG_CLASSES, `${red} data-on:border-[#000000]`);
    expect(outcomes(coverage, red)).toEqual(["unmapped"]);
    expect(overridesOf(variant)).not.toContainEqual(expect.objectContaining({ path: [], field: "fill" }));
  });

  // The main paints no fill, so it holds no layer, and the instance's red fill draws on a layer of
  // its own, which no override of the main adds.
  it("leaves a fill the instance draws inside the border of a main with none unmapped", async () => {
    const red = "data-on:bg-[#ff0000]";
    const { variant, coverage } = await instanceOfTag(
      "size-[20px] bg-clip-padding border-2 border-[#00000080]",
      red
    );
    expect(outcomes(coverage, red)).toEqual(["unmapped"]);
    expect(overridesOf(variant)).toEqual([]);
  });

  // The instance's border on the left side only would inset its padding box from that side only,
  // but the main's layer keeps its 2px insets on every side, which no override moves.
  it("leaves border widths that move the padding box unmapped", async () => {
    const sides = "data-on:border-0 data-on:border-l-2";
    const { variant, coverage } = await instanceOfTag(TAG_CLASSES, sides);
    const widths = [...notesOf(coverage, "data-on:border-0"), ...notesOf(coverage, "data-on:border-l-2")]
      .filter(([property]) => String(property).endsWith("-width"))
      .map(([property, outcome]) => [property, outcome]);
    expect(widths).toEqual([
      ["border-bottom-width", "unmapped"],
      ["border-right-width", "unmapped"],
      ["border-top-width", "unmapped"],
      ["border-left-width", "unmapped"],
    ]);
    expect(overridesOf(variant)).not.toContainEqual(expect.objectContaining({ field: "strokeSides" }));
  });

  // At a 4px border the instance's padding box sits 4px in, rounded by 4px, where the main's layer
  // sits 2px in, rounded by 6px. An override of that layer's fill or corner would paint red at the
  // main's insets, so neither reaches the layer.
  it("leaves the fill and corner of a layer the instance insets anew unmapped", async () => {
    const red = "data-on:bg-[#ff0000]";
    const { variant, coverage } = await instanceOfTag(
      `${TAG_CLASSES} rounded-[8px]`,
      `data-on:border-4 ${red}`
    );
    expect(outcomes(coverage, red)).toEqual(["unmapped"]);
    expect(overridesOf(variant)).toEqual([]);
  });

  // A spread ring gives the dot a clear fill of its own (`ringFill`), which paints nothing, so the
  // composite's `bg-transparent` still clears the white the main's layer paints inside the border.
  it("clears the layer of a dot whose ring gives it a clear fill", async () => {
    const clear = "data-on:bg-transparent";
    const dot = "size-[12px] bg-[#ffffff] bg-clip-padding border-2 border-[#00000080] ring-2 ring-[#ff0000]";
    const dotted = chip({ key: "review-tag", name: "Review tag", slot: "tag", parts: [part()] });
    const { variant, coverage } = await buildCaptured(
      chip({ parts: [instanceOf("tag", dotted)] }),
      rest({
        slot: "chip",
        classes: "flex w-[200px] p-[8px]",
        children: [
          {
            slot: "tag",
            classes: "flex p-[4px]",
            children: [{ slot: "chip-dot", classes: `${dot} ${clear}` }],
          },
        ],
      }),
      {
        inner: [
          {
            manifest: dotted,
            cells: rest({
              slot: "tag",
              classes: "flex p-[4px]",
              children: [{ slot: "chip-dot", classes: dot, carried: clear }],
            }),
          },
        ],
      }
    );
    expect(outcomes(coverage, clear)).toEqual(["literal"]);
    expect(overridesOf(variant)).toEqual([{ path: ["dot", "padding box"], field: "fill", color: undefined }]);
  });

  // The opaque border in place needs no clip, so the tag paints its fill on its frame where the main
  // paints it on its layer, which stays unmapped. The dot beside that layer is the main's dot, so its
  // red fill and the border's black still reach the instance as overrides.
  it("carries an override of a layer beside a fill layer only the main draws", async () => {
    const black = "data-on:border-[#000000]";
    const red = "data-on:bg-[#ff0000]";
    const dotted = chip({ key: "review-tag", name: "Review tag", slot: "tag", parts: [part()] });
    const tagClasses = "flex p-[4px] bg-[#ffffff] bg-clip-padding border-2 border-[#00000080]";
    const dot = "size-[12px] bg-[#0000ff]";
    const { variant, coverage } = await buildCaptured(
      chip({ parts: [instanceOf("tag", dotted)] }),
      rest({
        slot: "chip",
        classes: "flex w-[200px]",
        children: [
          {
            slot: "tag",
            classes: `${tagClasses} ${black}`,
            children: [{ slot: "chip-dot", classes: `${dot} ${red}` }],
          },
        ],
      }),
      {
        inner: [
          {
            manifest: dotted,
            cells: rest({
              slot: "tag",
              classes: tagClasses,
              carried: black,
              children: [{ slot: "chip-dot", classes: dot, carried: red }],
            }),
          },
        ],
      }
    );
    expect(overridesOf(variant)).toEqual([
      { path: [], field: "strokeColor", color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } },
      { path: ["dot"], field: "fill", color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } },
    ]);
    expect(outcomes(coverage, red)).toEqual(["literal"]);
  });

  // The main's opaque fill sits on its frame, under the translucent border. A composite clip would
  // move it onto a `padding box` layer, which no override adds to the main.
  it("leaves a clip that only the composite sets unmapped", async () => {
    const clip = "data-on:bg-clip-padding";
    const { variant, coverage } = await instanceOfTag(
      "size-[20px] bg-[#ffffff] border-2 border-[#00000080]",
      clip
    );
    expect(outcomes(coverage, clip)).toEqual(["unmapped"]);
    expect(overridesOf(variant)).toEqual([]);
  });

  // The main paints no fill of its own, and its dot keyed `padding box` sits in its auto layout, so
  // it is no layer that paints the main's fill inside the border. The composite's `bg-transparent`
  // repeats the main, whatever the dot's own fill does.
  it("drops a clear fill whose box holds an ordinary layer keyed `padding box`", async () => {
    const clear = "data-on:bg-transparent";
    const red = "data-on:bg-[#ff0000]";
    const plain = chip({
      key: "review-tag",
      name: "Review tag",
      slot: "tag",
      parts: [part({ key: "padding box" })],
    });
    const dot = "size-[12px] bg-[#ffffff]";
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("tag", plain)] }),
      rest({
        slot: "chip",
        classes: "flex w-[200px]",
        children: [
          {
            slot: "tag",
            classes: `flex p-[4px] ${clear}`,
            children: [{ slot: "chip-dot", classes: `${dot} ${red}` }],
          },
        ],
      }),
      {
        inner: [
          {
            manifest: plain,
            cells: rest({
              slot: "tag",
              classes: "flex p-[4px]",
              carried: clear,
              children: [{ slot: "chip-dot", classes: dot, carried: red }],
            }),
          },
        ],
      }
    );
    expect(outcomes(coverage, clear)).toEqual(["dropped"]);
    expect(outcomes(coverage, red)).toEqual(["literal"]);
  });
});

// Oracle: CSS Transforms 2 §5.1, under which `scale` paints the box, its border and its background at
// the scaled size about its center, so a 16px box at 75% paints 12px, its 1px border 0.75px wide and
// its padding box inset 0.75px, rounded by the 7px corner inside the border scaled to 5.25px.
describe("a part that scales and draws its fill inside the border", () => {
  it("draws the dot, its stroke and its `padding box` layer at the scaled size", async () => {
    const { variant, coverage } = await buildChip(
      "inline-flex",
      [
        {
          slot: "chip-dot",
          classes:
            "size-[16px] rounded-[8px] border border-[#00000080] bg-clip-padding bg-[#ffffff] scale-75",
        },
      ],
      { parts: [part()] }
    );
    const dot = frameOf(frameOf(variant?.root));
    const layer = frameOf(dot);
    expect({
      dot: dot?.key,
      sizing: dot?.sizing,
      stroke: dot?.stroke,
      fill: dot?.fill,
      layer: layer?.key,
      placement: layer?.placement,
      cornerRadius: layer?.cornerRadius,
    }).toEqual({
      dot: "dot",
      sizing: fixedSize(literal(12), literal(12)),
      stroke: {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 128 / 255 } },
        weight: literal(0.75),
      },
      fill: undefined,
      layer: "padding box",
      placement: {
        kind: "edges",
        within: "parent",
        horizontal: { kind: "stretch", start: 0.75, end: 0.75 },
        vertical: { kind: "stretch", start: 0.75, end: 0.75 },
      },
      cornerRadius: literal(5.25),
    });
    expect(coverage.filter((row) => row.property === "scale").map((row) => row.outcome)).toEqual(["literal"]);
  });
});

// Oracle: CSS Box Sizing 3 §4.1. Under `border-box` the padding and borders floor the used size in
// each mode on its own, so a box whose length is a variable lays out its padding box at that mode's
// length, or at its padding where that is more, which a Figma frame bound to the variable does not
// follow. The clip draws only where every mode leaves the frame the length CSS lays out.
describe("a padding box whose length a mode sets", () => {
  const FLOORED = [
    "background-clip",
    "unmapped",
    "the padding and borders lay the box out larger than the length its frame takes, so the kit cannot size the padding box",
  ];
  const EMPTY_ROW = [
    "background-clip",
    "unmapped",
    "the border leaves no padding box at the length the main component takes, so an instance resized larger would have no layer to fill inside the border",
  ];
  const DENSITY = "Density";
  const ref = (name: string): VariableRef => ({ collection: DENSITY, name });
  const variable = (name: string, minimum: number, maximum: number) => ({
    ref: ref(name),
    webSyntax: `var(--${name})`,
    minimum,
    maximum,
  });

  // At the 4px mode the box lays out 8px, its 2px padding and 2px borders, with a 4px padding box.
  it("stays unmapped where one mode's length is less than the padding and borders", async () => {
    const variables = makeVariableIndex([variable("w", 4, 40)]);
    const { coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] p-[2px] size-(--w)",
      }),
      { variables }
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([FLOORED]);
  });

  /** Each Density mode, each variable at its value there. */
  const densityModes = (
    variables: ReturnType<typeof makeVariableIndex>,
    values: Readonly<Record<string, readonly [number, number]>>
  ) =>
    (["Regular", "Compact"] as const).map((mode, index) => ({
      name: `${DENSITY} / ${mode}`,
      collection: DENSITY,
      variables: pinnedIndex(variables, (at) => {
        const value = values[at.name]?.[index];
        return value === undefined ? undefined : { minimum: value, maximum: value };
      }),
    }));

  // The Compact frame takes 32px, where its 16px paddings and 2px borders lay the box out 36px.
  it("stays unmapped where the compact length is less than the padding and borders", async () => {
    const variables = makeVariableIndex([variable("h", 32, 36)]);
    const { coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] p-[16px] size-(--h)",
      }),
      { variables, modes: densityModes(variables, { h: [36, 32] }) }
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([FLOORED]);
  });

  // Regular is 40px around 16px paddings and Compact 32px around 12px ones, so each mode's length
  // holds its padding and borders, though the least length is less than the greatest padding.
  it("draws the fill where each mode's length holds that mode's padding and borders", async () => {
    const variables = makeVariableIndex([variable("h", 32, 40), variable("p", 12, 16)]);
    const { coverage, variant } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] p-(--p) size-(--h)",
      }),
      { variables, modes: densityModes(variables, { h: [40, 32], p: [16, 12] }) }
    );
    expect(notesOf(coverage, "bg-clip-padding").map(([property, outcome]) => [property, outcome])).toEqual([
      ["background-clip", "literal"],
    ]);
    expect(frameOf(variant?.root)?.key).toBe("padding box");
  });

  // An empty `inline-flex` box hugs its padding and borders, so at the mode with no padding its 1px
  // borders take its whole width.
  it("stays unmapped where one mode leaves a hugging box no padding inside its borders", async () => {
    const variables = makeVariableIndex([variable("p", 0, 4)]);
    const { coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "bg-clip-padding bg-[#ffffff] inline-flex h-[100px] px-(--p) border border-[#00000080]",
      }),
      { variables }
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([EMPTY_ROW]);
  });

  // An empty `inline-flex` box hugs its borders, or its least width where that is more, so at the
  // 2px mode its 1px borders take its whole width.
  it("stays unmapped where one mode's least width leaves a hugging box no room inside its borders", async () => {
    const variables = makeVariableIndex([variable("m", 2, 40)]);
    const { coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "bg-clip-padding bg-[#ffffff] inline-flex h-[100px] min-w-(--m) border border-[#00000080]",
      }),
      { variables, modes: densityModes(variables, { m: [40, 2] }) }
    );
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([EMPTY_ROW]);
  });

  // Density sets the width and the side paddings, Size the height and the top and bottom ones. Each
  // mode's width holds its side paddings and borders, 40px around 16px paddings or 32px around 12px
  // ones, and each mode's height its own, so every pair of a Density and a Size mode fits.
  it("draws the fill where each axis fits in each mode of the collection that sets it", async () => {
    const SIZE = "Size";
    const inCollection = (collection: string, name: string, minimum: number, maximum: number) => ({
      ref: { collection, name },
      webSyntax: `var(--${name})`,
      minimum,
      maximum,
    });
    const variables = makeVariableIndex([
      inCollection(DENSITY, "w", 32, 40),
      inCollection(DENSITY, "px", 12, 16),
      inCollection(SIZE, "h", 32, 40),
      inCollection(SIZE, "py", 12, 16),
    ]);
    const values = new Map<string, readonly [number, number]>([
      ["w", [40, 32]],
      ["px", [16, 12]],
      ["h", [40, 32]],
      ["py", [16, 12]],
    ]);
    const modes = [DENSITY, SIZE].flatMap((collection) =>
      (["Large", "Small"] as const).map((mode, index) => ({
        name: `${collection} / ${mode}`,
        collection,
        variables: pinnedIndex(variables, (at) => {
          const value = at.collection === collection ? values.get(at.name)?.[index] : undefined;
          return value === undefined ? undefined : { minimum: value, maximum: value };
        }),
      }))
    );
    const { coverage, variant } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes:
          "bg-clip-padding bg-[#ffffff] border-2 border-[#00000080] w-(--w) h-(--h) px-(--px) py-(--py)",
      }),
      { variables, modes }
    );
    expect(notesOf(coverage, "bg-clip-padding").map(([property, outcome]) => [property, outcome])).toEqual([
      ["background-clip", "literal"],
    ]);
    expect(frameOf(variant?.root)?.key).toBe("padding box");
  });
});
