/**
 * `reconcileKit` with the one-variant kit of `button-kit-fixture.ts` on the in-memory file in
 * `fake-figma.ts`, for a file whose kit page holds a stale preview and no component set. The
 * oracles are the change lines Plan lists and the writes the file took.
 */
import { describe, expect, it } from "vitest";

import { NO_LIMITS } from "../../src/components/kit-spec.ts";
import type { FrameLayerSpec, KitSpec, TextLayerSpec } from "../../src/components/kit-spec.ts";
import {
  buttonVariant,
  CHECK,
  FILL,
  fixture,
  frame,
  KIT,
  kitWithRoot,
  LABEL,
  literal,
  nestedKit,
  RELAYOUT,
} from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { BLUE_PIXEL, childNamed, PORTRAIT_HEAD, RED_PIXEL } from "./fake-fixtures.ts";
import type { ImageFixture } from "./fake-fixtures.ts";
import { setKey } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

/**
 * A 16px frame that an image covers, as an avatar's `<img>` covers its circle, with the hash the
 * build would write for its bytes unless the case names another.
 */
function imageFrame(image: ImageFixture, hash = image.sha1): FrameLayerSpec {
  return {
    ...frame("button/image", "Image", []),
    sizing: {
      horizontal: { kind: "fixed", length: literal(16) },
      vertical: { kind: "fixed", length: literal(16) },
    },
    fill: { kind: "image", bytes: image.bytes, hash, scaleMode: "FILL" },
  };
}

describe("reconcileKit on a file without the component set", () => {
  it("plans to delete the stale preview and create the set when the family loads", async () => {
    const { file, setup } = fixture("Roboto");
    const report = await reconcileKit(file.figma, KIT, false);
    expect(report.changes).toEqual([
      "Fuse components: delete Old preview",
      "Fuse components: create the Icons frame with 0 icons",
      "Fuse components: create the component set Button with 1 variants",
      "Text styles: create Caption",
      "Fuse components: create the text Fuse components",
      "Fuse components: create the description",
      "Fuse components: create the text View documentation",
      "Fuse components: create the rule",
      "Fuse components: create the labels Button labels",
      "Fuse components: create the text Themes",
      "Fuse components: create the text Examples",
      "Fuse components: create the example Example",
      "Fuse components: place Button and Icons, with their labels and the page's title and example, in sections",
    ]);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("fails Plan, and stops Apply before any write, when the file's family cannot load", async () => {
    const { file, setup } = fixture("Comic Sans");
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  // The page docs bind variables no set binds, so a file synced before the kit grew docs can lack
  // them. Plan must refuse before Apply writes the thousands of nodes ahead of the docs.
  const BORDER = { kind: "variable", variable: { collection: "Fuse tokens", name: "border" } } as const;
  const [docs] = KIT.docs;
  if (docs === undefined) {
    throw new Error("The fixture kit documents no page.");
  }
  const { docsLink, rule } = docs;
  it.each([
    ["the docs link's fill", { docsLink: { ...docsLink, color: BORDER } }],
    [
      "the docs link's underline",
      { docsLink: { ...docsLink, underline: { ...docsLink.underline, color: BORDER } } },
    ],
    ["the rule's fill", { rule: { ...rule, color: BORDER } }],
  ])(
    "fails Plan, and stops Apply before any write, when %s binds a variable the file lacks",
    async (_, edit) => {
      const { file, setup } = fixture("Roboto");
      const kit: KitSpec = { ...KIT, docs: [{ ...docs, ...edit }] };
      const message = "The Fuse tokens collection has no variable named border.";
      await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
      await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow(message);
      expect(file.writes.slice(setup)).toEqual([]);
    }
  );

  it("fails Plan, and stops Apply before any write, for a file without the kit page", async () => {
    const { file, setup } = fixture("Comic Sans", false);
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});

/** A hugging frame around the label, as Item's actions hold their text. */
const BOX = frame("button/box", "Box", [LABEL]);

/** A fixed 40 × 40 frame, as Item's image media sets a row's height. */
const SQUARE: FrameLayerSpec = {
  ...frame("button/square", "Square", []),
  sizing: {
    horizontal: { kind: "fixed", length: literal(40) },
    vertical: { kind: "fixed", length: literal(40) },
  },
};

describe("the kit check", () => {
  it("passes a PNG cut off after its header, which a real file stored, and Apply converges", async () => {
    const { file } = fixture("Roboto");
    const kit = nestedKit([imageFrame(PORTRAIT_HEAD)]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });

  // Oracle: PF, where a real file stretched a frame that filled down a row hugging its height to the
  // height of the fixed square beside it, and kept the row hugging (fake rule 29).
  it("passes a frame that fills the height of a hugging row beside a fixed square, and Apply converges", async () => {
    const { file } = fixture("Roboto");
    const kit = nestedKit([
      frame("button/row", "Row", [
        SQUARE,
        { ...BOX, sizing: { horizontal: { kind: "hug" }, vertical: FILL } },
      ]),
    ]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    const row = childNamed(await buttonVariant(file), "FRAME", "Row");
    const box = childNamed(row, "FRAME", "Box");
    expect([box.layoutSizingVertical, box.height, row.layoutSizingVertical]).toEqual(["FILL", 40, "HUG"]);
  });
});

// Oracle: PM, where a real file drew a column that hugs both ways with a `minWidth` of 128, whose
// sections all fill across, 128 wide with its sections 128 wide.
describe("a column that hugs its width from a minimum, every layer filling across", () => {
  it("passes the kit check, and Apply converges", async () => {
    const { file } = fixture("Roboto");
    const kit = nestedKit([
      {
        ...frame("button/column", "Column", [
          { ...BOX, sizing: { horizontal: FILL, vertical: { kind: "hug" } } },
        ]),
        direction: "VERTICAL",
        limits: { ...NO_LIMITS, minWidth: literal(128) },
      },
    ]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });
});

// Unit under test: `reconcileKit` on a file without the set. Oracle: the fake's rules 19 and 20,
// which follow what a real file read on 2026-10-22 (P3, P4), and an empty second Plan. The value
// fills a fixed row and ends in an ellipsis after one line, as Input's value does. The hint fills a
// column that fills the root, and wraps from the top, as a field description does.
describe("a variant whose two parts each hold a label that fills its part", () => {
  const FILL_WIDTH = { horizontal: FILL, vertical: { kind: "hug" } } as const;
  const VALUE: TextLayerSpec = {
    ...LABEL,
    key: "field/value",
    name: "Value",
    characters: "name@example.com",
    textProperty: "Value",
    sizing: FILL_WIDTH,
    align: { horizontal: "LEFT", vertical: "CENTER" },
    truncation: { maxLines: 1 },
  };
  const HINT: TextLayerSpec = {
    ...LABEL,
    key: "field/hint",
    name: "Hint",
    characters: "We never share it.",
    textProperty: "Hint",
    sizing: FILL_WIDTH,
  };
  const ROW: FrameLayerSpec = {
    ...frame("field/control", "Control", [VALUE]),
    sizing: {
      horizontal: { kind: "fixed", length: literal(200) },
      vertical: { kind: "fixed", length: literal(36) },
    },
    paddingLeft: literal(10),
    paddingRight: literal(10),
  };
  const COLUMN: FrameLayerSpec = {
    ...frame("field/description", "Description", [HINT]),
    direction: "VERTICAL",
    sizing: FILL_WIDTH,
    primaryAlign: "MIN",
    counterAlign: "MIN",
  };
  const withRoot = kitWithRoot((root) => ({
    ...root,
    direction: "VERTICAL",
    sizing: { horizontal: { kind: "fixed", length: literal(240) }, vertical: { kind: "hug" } },
    primaryAlign: "MIN",
    counterAlign: "MIN",
    children: [ROW, COLUMN],
  }));
  const fieldKit: KitSpec = {
    ...withRoot,
    componentSets: withRoot.componentSets.map((set) => ({
      ...set,
      textProperties: [
        { name: "Value", defaultValue: "name@example.com" },
        { name: "Hint", defaultValue: "We never share it." },
      ],
    })),
  };

  it("draws both labels in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, fieldKit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, fieldKit, false)).toEqual({ changes: [], warnings: [] });

    const variant = await buttonVariant(file);
    const value = childNamed(childNamed(variant, "FRAME", "Control"), "TEXT", "Value");
    const hint = childNamed(childNamed(variant, "FRAME", "Description"), "TEXT", "Hint");
    const layout = (text: TextNode) => [
      text.textAutoResize,
      text.layoutSizingHorizontal,
      text.layoutSizingVertical,
      text.textTruncation,
      text.maxLines,
      text.textAlignVertical,
      text.characters,
    ];
    expect(layout(value)).toEqual(["HEIGHT", "FILL", "HUG", "ENDING", 1, "CENTER", "name@example.com"]);
    expect(layout(hint)).toEqual(["HEIGHT", "FILL", "HUG", "DISABLED", null, "TOP", "We never share it."]);
  });
});

/** A layer the plugin keyed, and the layers a frame among them holds. */

/** A file the nested kit was applied to, opened for the next run, and its two frames. */
async function nestedFile(): Promise<{
  readonly file: FakeFigma;
  readonly control: FrameNode;
  readonly indicator: FrameNode;
}> {
  const { file } = fixture("Roboto");
  await reconcileKit(file.figma, nestedKit(), true);
  file.reopen();
  const control = childNamed(await buttonVariant(file), "FRAME", "Control");
  return { file, control, indicator: childNamed(control, "FRAME", "Indicator") };
}

describe("a variant whose layers sit in a frame inside a frame", () => {
  it("fails Plan, and stops Apply before any write, when the label's family cannot load", async () => {
    const { file, setup } = fixture("Comic Sans");
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, nestedKit(), false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, nestedKit(), true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("requires the label's font for a frame it creates again, and for a variant it creates again", async () => {
    const message = "Button / size=md / Label needs the font Roboto Medium, which Figma cannot load.";
    const deletedFrame = await nestedFile();
    deletedFrame.control.remove();
    deletedFrame.file.reopen({ unavailableFonts: [{ family: "Roboto" }] });
    await expect(reconcileKit(deletedFrame.file.figma, nestedKit(), false)).rejects.toThrow(message);

    const deletedVariant = await nestedFile();
    (await buttonVariant(deletedVariant.file)).remove();
    deletedVariant.file.reopen({ unavailableFonts: [{ family: "Roboto" }] });
    await expect(reconcileKit(deletedVariant.file.figma, nestedKit(), false)).rejects.toThrow(message);
  });

  it("keeps the keys of a renamed frame and a renamed label inside it, and plans only their names back", async () => {
    const { file, indicator } = await nestedFile();
    const label = childNamed(indicator, "TEXT", "Label");
    indicator.name = "Dot";
    label.name = "Caption";
    expect((await reconcileKit(file.figma, nestedKit(), false)).changes).toEqual([
      "Button / size=md / Control / Indicator: name → Indicator",
      "Button / size=md / Control / Indicator / Label: name → Label",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, nestedKit(), true);
    expect([indicator.name, label.name]).toEqual(["Indicator", "Label"]);
    const control = childNamed(await buttonVariant(file), "FRAME", "Control");
    expect([childNamed(control, "FRAME", "Indicator"), childNamed(indicator, "TEXT", "Label")]).toEqual([
      indicator,
      label,
    ]);
  });

  it("deletes a label the spec moves to another frame and creates it there, then converges", async () => {
    const { file } = await nestedFile();
    const moved = [
      frame("button/control", "Control", [frame("button/indicator", "Indicator", [CHECK]), LABEL]),
    ];
    expect((await reconcileKit(file.figma, nestedKit(moved), false)).changes).toEqual([
      "Button / size=md / Control / Indicator: delete the layer Label",
      "Button / size=md / Control: create the text layer Label",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, nestedKit(moved), true);
    file.reopen();
    expect(await reconcileKit(file.figma, nestedKit(moved), false)).toEqual({ changes: [], warnings: [] });
  });

  it("stops Plan and Apply before any write when a designer duplicates the label inside a frame", async () => {
    const { file, indicator } = await nestedFile();
    const copy = file.figma.createText();
    indicator.appendChild(copy);
    setKey(copy, LABEL.key);
    const before = file.writes.length;
    const message = "Button / size=md / Control / Indicator holds 2 layers with the key button/label.";
    await expect(reconcileKit(file.figma, nestedKit(), false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, nestedKit(), true)).rejects.toThrow(message);
    expect(file.writes.slice(before)).toEqual([]);
  });
});

// Unit under test: `reconcileKit` on a variant whose frame fills with an image. Oracle: the fake's
// rules 22 and 23, which follow what a real file read on 2026-10-22 (P9, P9b): Figma names an image
// by the SHA-1 of its bytes, an image paint reads back with that hash and Figma's defaults, and
// storing an image changes the file. The next Plan lists nothing, other bytes plan the one fill
// write, and Plan stores no image.
describe("a variant whose frame fills with an image", () => {
  it("draws the image in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    const kit = nestedKit([imageFrame(RED_PIXEL)]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    expect(childNamed(await buttonVariant(file), "FRAME", "Image").fills).toMatchObject([
      { type: "IMAGE", scaleMode: "FILL", imageHash: RED_PIXEL.sha1 },
    ]);
  });

  it("plans the one fill write when the image's bytes change, stores nothing in Plan, and converges", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, nestedKit([imageFrame(RED_PIXEL)]), true);
    file.reopen();
    const blue = nestedKit([imageFrame(BLUE_PIXEL)]);
    const before = file.writes.length;
    expect((await reconcileKit(file.figma, blue, false)).changes).toEqual([
      `Button / size=md / Image: fill → image ${BLUE_PIXEL.sha1.slice(0, 8)} at FILL (holds image ${RED_PIXEL.sha1.slice(0, 8)} at FILL)`,
      ...RELAYOUT,
    ]);
    expect(file.writes.slice(before)).toEqual([]);
    await reconcileKit(file.figma, blue, true);
    file.reopen();
    expect(await reconcileKit(file.figma, blue, false)).toEqual({ changes: [], warnings: [] });
  });
});

// Unit under test: `reconcileKit` on a variant whose bar holds an absolute fill, as a meter's bar
// holds its fill. Oracle: the fake's rules 9 and 24, which follow what a real file read on
// 2026-10-22 (P8), and an empty second Plan. A fill at 85% of a 256px bar is 217.6 wide at the bar's
// top left, scales across and stretches down, so it keeps 85% of the bar and the bar's height when
// the bar resizes.
describe("a variant whose bar holds an absolute fill", () => {
  const fixedSides = (width: number, height: number) =>
    ({
      horizontal: { kind: "fixed", length: literal(width) },
      vertical: { kind: "fixed", length: literal(height) },
    }) as const;
  const FLOWING: FrameLayerSpec = { ...frame("button/fill", "Fill", []), sizing: fixedSides(217.6, 6) };
  const ABSOLUTE: FrameLayerSpec = {
    ...FLOWING,
    placement: {
      kind: "edges",
      within: "parent",
      horizontal: { kind: "scale", start: 0 },
      vertical: { kind: "stretch", start: 0, end: 0 },
    },
  };
  const barKit = (fill: FrameLayerSpec, width = 256) =>
    nestedKit([{ ...frame("button/bar", "Bar", [fill]), sizing: fixedSides(width, 6) }]);

  async function appliedBar(fill: FrameLayerSpec, width = 256) {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, barKit(fill, width), true);
    file.reopen();
    const bar = childNamed(await buttonVariant(file), "FRAME", "Bar");
    return { file, bar, fill: childNamed(bar, "FRAME", "Fill") };
  }

  // The fake stores numbers as 32-bit floats, as Figma does, so 217.6 reads back a few millionths off.
  const placement = (node: FrameNode) => [
    node.layoutPositioning,
    ...[node.x, node.y, node.width, node.height].map((value) => Math.round(value * 1000) / 1000),
  ];

  it("places the fill at the bar's top left in one Apply, and the next Plan lists nothing", async () => {
    const { file, fill } = await appliedBar(ABSOLUTE);
    expect(await reconcileKit(file.figma, barKit(ABSOLUTE), false)).toEqual({ changes: [], warnings: [] });
    expect([...placement(fill), fill.constraints]).toEqual([
      "ABSOLUTE",
      0,
      0,
      217.6,
      6,
      { horizontal: "SCALE", vertical: "STRETCH" },
    ]);
  });

  it("keeps the fill at 85% of the bar's width and at its height when the bar resizes", async () => {
    const { bar, fill } = await appliedBar(ABSOLUTE);
    bar.resize(512, 12);
    expect(placement(fill)).toEqual(["ABSOLUTE", 0, 0, 435.2, 12]);
  });

  it("turns a fill the auto layout placed absolute, writing its place whatever it reads, and converges", async () => {
    const { file } = await appliedBar(FLOWING);
    expect((await reconcileKit(file.figma, barKit(ABSOLUTE), false)).changes).toEqual([
      "Button / size=md / Bar / Fill: layoutPositioning → ABSOLUTE",
      "Button / size=md / Bar / Fill: constraints → SCALE STRETCH",
      "Button / size=md / Bar / Fill: place → 0px from the left, scaling, 0px from the top to 0px from the bottom",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, barKit(ABSOLUTE), true);
    file.reopen();
    expect(await reconcileKit(file.figma, barKit(ABSOLUTE), false)).toEqual({ changes: [], warnings: [] });
  });

  // The bar's resize runs first and scales the fill it holds to 278.528px (rule 9), so the fill's own
  // writes must follow whatever the fill read before the run.
  it("writes the fill's place and size after the run resizes its bar, so one Apply converges", async () => {
    const { file, fill } = await appliedBar(ABSOLUTE, 200);
    expect(placement(fill)).toEqual(["ABSOLUTE", 0, 0, 217.6, 6]);
    await reconcileKit(file.figma, barKit(ABSOLUTE), true);
    file.reopen();
    expect(await reconcileKit(file.figma, barKit(ABSOLUTE), false)).toEqual({ changes: [], warnings: [] });
    expect(placement(fill)).toEqual(["ABSOLUTE", 0, 0, 217.6, 6]);
  });

  it("stops Plan and Apply before any write when the absolute fill fills the bar's width", async () => {
    const { file, setup } = fixture("Roboto");
    const filling = barKit({ ...ABSOLUTE, sizing: { ...ABSOLUTE.sizing, horizontal: FILL } });
    const message = "Fill in the variant button/size=md is absolute and fills its width";
    await expect(reconcileKit(file.figma, filling, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, filling, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});

// Oracle: the placement's definition. A line 4px from its parent's left, stretched from 8px below its
// top to 8px above its bottom, in a 100 × 40 parent, is 24px tall, a length the spec leaves to the
// place, as the build leaves a stretch beside a parent whose height it cannot tell.
describe("a frame its placement stretches to a length the spec leaves it", () => {
  const LINE: FrameLayerSpec = {
    ...frame("button/line", "Line", []),
    sizing: { horizontal: { kind: "fixed", length: literal(1) }, vertical: { kind: "placed" } },
    placement: {
      kind: "edges",
      within: "parent",
      horizontal: { kind: "start", start: 4 },
      vertical: { kind: "stretch", start: 8, end: 8 },
    },
  };
  const parentKit = () =>
    nestedKit([
      {
        ...frame("button/bar", "Bar", [LINE]),
        sizing: {
          horizontal: { kind: "fixed", length: literal(100) },
          vertical: { kind: "fixed", length: literal(40) },
        },
      },
    ]);

  it("takes the parent's height less both distances in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, parentKit(), true);
    file.reopen();
    const line = childNamed(childNamed(await buttonVariant(file), "FRAME", "Bar"), "FRAME", "Line");
    expect([line.layoutPositioning, line.x, line.y, line.width, line.height]).toEqual([
      "ABSOLUTE",
      4,
      8,
      1,
      24,
    ]);
    expect(await reconcileKit(file.figma, parentKit(), false)).toEqual({ changes: [], warnings: [] });
  });
});

// Unit under test: `reconcileKit` on a label with letter spacing, as Empty's title has. Oracle: the
// fake's rule 28, after what a real file read on 2026-10-23 (PL): a new text holds 0%, and -2.5% reads
// back as written. The next Plan lists nothing, and a label with no spacing in the spec plans none, so
// a published label keeps whatever a designer gave it.
describe("a label with letter spacing", () => {
  const SPACED = kitWithRoot((root) => ({
    ...root,
    children: [{ ...LABEL, letterSpacing: { unit: "PERCENT", value: -2.5 } }],
  }));
  const labelOf = async (file: FakeFigma) => childNamed(await buttonVariant(file), "TEXT", "Label");

  it("writes the spacing in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, SPACED, true);
    file.reopen();
    expect(await reconcileKit(file.figma, SPACED, false)).toEqual({ changes: [], warnings: [] });
    expect((await labelOf(file)).letterSpacing).toEqual({ unit: "PERCENT", value: -2.5 });
  });

  it("plans a spacing a designer changed back, and none for a label the spec gives no spacing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, SPACED, true);
    file.reopen();
    await file.figma.loadFontAsync({ family: "Roboto", style: "Medium" });
    (await labelOf(file)).letterSpacing = { unit: "PIXELS", value: 1 };
    expect((await reconcileKit(file.figma, SPACED, false)).changes).toEqual([
      "Button / size=md / Label: letterSpacing → -2.5%",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, SPACED, true);
    file.reopen();
    expect(await reconcileKit(file.figma, SPACED, false)).toEqual({ changes: [], warnings: [] });
    expect(await reconcileKit(file.figma, KIT, false)).toEqual({ changes: [], warnings: [] });
  });
});

// Unit under test: `reconcileKit` on a label with a percent line height, as Alert's title and body
// have over the bound `label-text`. Oracle: the fake's rule 30, after what a real file read on
// 2026-10-23 (PH): a percent line height reads back as written. The next Plan lists nothing, and a
// line height a designer set in pixels plans the percent back.
describe("a label with a percent line height", () => {
  const PERCENT = kitWithRoot((root) => ({
    ...root,
    children: [{ ...LABEL, lineHeight: { kind: "percent", value: 137.5 } }],
  }));
  const labelOf = async (file: FakeFigma) => childNamed(await buttonVariant(file), "TEXT", "Label");

  it("writes the percent in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, PERCENT, true);
    file.reopen();
    expect(await reconcileKit(file.figma, PERCENT, false)).toEqual({ changes: [], warnings: [] });
    expect((await labelOf(file)).lineHeight).toEqual({ unit: "PERCENT", value: 137.5 });
  });

  it("plans the percent back over a line height in pixels", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, PERCENT, true);
    file.reopen();
    await file.figma.loadFontAsync({ family: "Roboto", style: "Medium" });
    (await labelOf(file)).lineHeight = { unit: "PIXELS", value: 137.5 };
    expect((await reconcileKit(file.figma, PERCENT, false)).changes).toEqual([
      "Button / size=md / Label: lineHeight → 137.5%",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, PERCENT, true);
    file.reopen();
    expect(await reconcileKit(file.figma, PERCENT, false)).toEqual({ changes: [], warnings: [] });
  });
});

// Unit under test: `reconcileKit` on a hugging label with a max width, as Empty's title and
// description wrap under the header's `max-w-sm`. Oracle: the fake's rule 16, after what a real file
// read on 2026-10-22 (P7): a text in auto layout keeps a `maxWidth`, and `null` clears it. The next
// Plan lists nothing.
describe("a label that wraps at a max width", () => {
  const CAPPED = kitWithRoot((root) => ({
    ...root,
    children: [{ ...LABEL, maxWidth: literal(72) }],
  }));
  const labelOf = async (file: FakeFigma) => childNamed(await buttonVariant(file), "TEXT", "Label");

  it("writes the max width in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, CAPPED, true);
    file.reopen();
    expect(await reconcileKit(file.figma, CAPPED, false)).toEqual({ changes: [], warnings: [] });
    expect((await labelOf(file)).maxWidth).toBe(72);
  });

  it("clears the max width for a label the spec gives none, and converges", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, CAPPED, true);
    file.reopen();
    expect((await reconcileKit(file.figma, KIT, false)).changes).toEqual([
      "Button / size=md / Label: maxWidth → none",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, KIT, true);
    file.reopen();
    expect(await reconcileKit(file.figma, KIT, false)).toEqual({ changes: [], warnings: [] });
    expect((await labelOf(file)).maxWidth).toBeNull();
  });
});

// Unit under test: `reconcileKit` on a variant whose frame the spec draws hidden, as a part under
// `visibility: hidden` draws. Oracle: the plugin typings, where any scene node's `visible` is
// writable and reads back what was written, and an empty second Plan. Showing the frame again plans
// the one `visible` write back.
describe("a variant whose frame the spec hides", () => {
  const hidden: FrameLayerSpec = { ...frame("button/hidden", "Hidden", []), hidden: true };

  it("draws the frame hidden in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    const kit = nestedKit([hidden]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    expect(childNamed(await buttonVariant(file), "FRAME", "Hidden").visible).toBe(false);
  });

  it("plans the one visible write when the spec shows the frame again, and converges", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, nestedKit([hidden]), true);
    file.reopen();
    const { hidden: _hidden, ...shown } = hidden;
    const kit = nestedKit([shown]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([
      "Button / size=md / Hidden: visible → true",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });
});

// Unit under test: `reconcileKit` on a variant whose frame rounds its corners differently, as a
// range's first day rounds its start corners. Oracle: the plugin typings, where each of
// `topLeftRadius`, `topRightRadius`, `bottomRightRadius` and `bottomLeftRadius` is writable and reads
// back what was written, and an empty second Plan.
describe("a variant whose frame rounds each corner on its own", () => {
  const rounded: FrameLayerSpec = {
    ...frame("button/rounded", "Rounded", []),
    cornerRadius: {
      kind: "corners",
      topLeft: literal(18),
      topRight: literal(0),
      bottomRight: literal(0),
      bottomLeft: literal(18),
    },
  };

  it("draws the four corners in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    const kit = nestedKit([rounded]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    const drawn = childNamed(await buttonVariant(file), "FRAME", "Rounded");
    expect([
      drawn.topLeftRadius,
      drawn.topRightRadius,
      drawn.bottomRightRadius,
      drawn.bottomLeftRadius,
    ]).toEqual([18, 0, 0, 18]);
  });
});
