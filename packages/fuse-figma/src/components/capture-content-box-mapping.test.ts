/**
 * How the build draws a part whose `box-sizing` is `content-box`, as Selection item's control slot
 * sets `box-content` on a height of one first line with 14px of padding above and below. The unit
 * under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Oracles: CSS Box Sizing 3 §4.1, under which `content-box` makes a
 * box's `height` its content box's, so a 20px height with 14px of padding each way draws a box 48px
 * tall, where a Figma frame's height holds its padding; so the part draws as a frame that hugs its
 * height around its padding and an inner frame of the 20px height, which takes the part's layout, its
 * layers centred as `items-center` centres them; a box with no padding or border draws alike under
 * both sizings, where no limit or percentage sits on the axis either, since CSS resolves those for the
 * content box too; a radius that takes its length from the box's size halves the border box, which
 * the inner frame would not be; a fixed height of a frame inside may be a percentage of the content box, which the
 * build would have resolved inside a padding that sits outside it, and a mapped frame's fixed height
 * does not say which; and the coverage contract, under which a content box the build does not draw
 * keeps its `box-sizing` unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, frameOf, literal, notesOf, part, rest } from "../../test/capture-fixtures";

/** A row whose `slot` part has the given classes and holds a dot of the given classes. */
function buildSlot(classes: string, dot = "flex p-[8px]") {
  return buildCaptured(
    chip({ parts: [part({ key: "slot", slot: "slot", parts: [part({ key: "dot", slot: "dot" })] })] }),
    rest({
      slot: "chip",
      classes: "flex",
      children: [{ slot: "slot", classes, children: [{ slot: "dot", classes: dot }] }],
    })
  );
}

describe("a part whose box-sizing is content-box", () => {
  it("draws its padding around an inner frame that takes its height and its layout", async () => {
    const { variant, coverage } = await buildSlot("box-content flex items-center h-[20px] py-[14px]");
    const slot = frameOf(variant?.root);
    const inner = frameOf(slot);
    expect([
      slot?.sizing.vertical,
      slot?.paddingTop,
      slot?.paddingBottom,
      inner?.key,
      inner?.sizing.vertical,
      inner?.counterAlign,
      inner?.children.map((child) => child.key),
      notesOf(coverage, "box-content").map(([property, outcome]) => [property, outcome]),
    ]).toEqual([
      { kind: "hug" },
      literal(14),
      literal(14),
      "content",
      { kind: "fixed", length: literal(20) },
      "CENTER",
      ["dot"],
      [["box-sizing", "literal"]],
    ]);
  });

  it("draws as it reads where no padding or border sits outside its height", async () => {
    const { variant, coverage } = await buildSlot("box-content flex items-center h-[20px]");
    const slot = frameOf(variant?.root);
    expect([
      slot?.sizing.vertical,
      slot?.children.map((child) => child.key),
      notesOf(coverage, "box-content").map(([property, outcome]) => [property, outcome]),
    ]).toEqual([{ kind: "fixed", length: literal(20) }, ["dot"], [["box-sizing", "dropped"]]]);
  });

  it("stays unmapped where it holds a frame of a fixed height, which a share of its content box may set", async () => {
    const { variant, coverage } = await buildSlot(
      "box-content flex items-center h-[20px] py-[14px]",
      "w-[16px] h-[16px]"
    );
    expect([
      frameOf(variant?.root)?.children.map((child) => child.key),
      notesOf(coverage, "box-content").map(([property, outcome]) => [property, outcome]),
    ]).toEqual([["dot"], [["box-sizing", "unmapped"]]]);
  });

  // Each sets its length on the content box, which the build reads on the border box: a 20px
  // minimum inside 14px of padding is 48px in Chromium where Figma's limit holds 20; a full width
  // inside 10px of padding is 220px in a 200px column where Figma's fill is 200; and a pill corner
  // takes half of the 48px it draws, which the build halved from the content's 20px.
  it.each([
    ["sets a minimum height", "box-content flex min-h-[20px] py-[14px]"],
    ["sets a percentage width", "box-content flex w-full h-[20px] p-[10px]"],
    [
      "rounds its corners from its own size",
      "box-content flex items-center h-[20px] w-[100px] py-[14px] rounded-full",
    ],
  ])("keeps its box-sizing unmapped where it %s", async (_case, classes) => {
    const { coverage } = await buildSlot(classes);
    expect(notesOf(coverage, "box-content").map(([property, outcome]) => [property, outcome])).toEqual([
      ["box-sizing", "unmapped"],
    ]);
  });
});
