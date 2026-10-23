/**
 * `reconcileKit` with the one-variant kit of `button-kit-fixture.ts` on the in-memory file in
 * `fake-figma.ts`, for a file whose kit page holds a stale preview and no component set. The
 * oracles are the change lines Plan lists and the writes the file took.
 */
import { describe, expect, it } from "vitest";

import { NO_LIMITS } from "../../src/components/kit-spec.ts";
import type { FrameLayerSpec, KitSpec, StrokeSpec, TextLayerSpec } from "../../src/components/kit-spec.ts";
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
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import {
  BLUE_PIXEL,
  childNamed,
  JPEG_HEAD,
  PNG_4097_WIDE,
  PNG_SIGNATURE,
  PORTRAIT_HEAD,
  RED_PIXEL,
} from "./fake-fixtures.ts";
import type { ImageFixture } from "./fake-fixtures.ts";
import { keyOf, setKey } from "./identity.ts";
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
      "Fuse components: place Button and Icons in a row",
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

  it("fails Plan, and stops Apply before any write, for a file without the kit page", async () => {
    const { file, setup } = fixture("Comic Sans", false);
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});

describe("the kit check", () => {
  const OTHER_PAGE = { key: "page/other", name: "Other" };
  const PREVIEW_ELSEWHERE: KitSpec = {
    ...KIT,
    pages: [...KIT.pages, OTHER_PAGE],
    previews: [
      {
        key: "preview/other",
        name: "Other / Light",
        page: OTHER_PAGE.key,
        modes: [],
        groups: [
          {
            key: "preview/other/button",
            name: "Button",
            componentSet: "button",
            variants: ["button/size=md"],
          },
        ],
      },
    ],
  };

  it.each([
    [
      "a page key listed twice",
      { ...KIT, pages: [...KIT.pages, ...KIT.pages] },
      "The kit lists the page key page twice.",
    ],
    [
      "a preview of a set on another page",
      PREVIEW_ELSEWHERE,
      "Other / Light places Button, which sits on another page.",
    ],
    [
      "a text two frames down that links a property the set lacks",
      nestedKit([
        frame("button/control", "Control", [
          frame("button/indicator", "Indicator", [{ ...LABEL, textProperty: "Label" }]),
        ]),
      ]),
      "Button: the variant button/size=md links Label, which the set does not define.",
    ],
    [
      "an icon two frames down whose color binds a string variable",
      nestedKit([
        frame("button/control", "Control", [
          frame("button/indicator", "Indicator", [
            {
              ...CHECK,
              color: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
            },
          ]),
        ]),
      ]),
      "Fuse tokens/font-sans is a STRING variable, and the kit binds it to a field that takes a COLOR.",
    ],
    [
      "a root that fills its width, which its component set cannot give it",
      kitWithRoot((root) => ({ ...root, sizing: { ...root.sizing, horizontal: FILL } })),
      "Button: the variant button/size=md fills its width, and a variant sits in its component set, which has no auto layout. Give it a fixed width.",
    ],
    [
      "a frame that fills the width of a root that hugs it",
      nestedKit([
        {
          ...frame("button/control", "Control", [LABEL]),
          sizing: { horizontal: FILL, vertical: { kind: "hug" } },
        },
      ]),
      "Button: Control in the variant button/size=md fills the width of a parent that hugs it, so Figma would shrink it to its smallest width.",
    ],
    [
      "a text that fills the width of a frame that hugs it",
      nestedKit([
        frame("button/control", "Control", [
          { ...LABEL, sizing: { horizontal: FILL, vertical: { kind: "hug" } } },
        ]),
      ]),
      "Button: Label in the variant button/size=md fills the width of a parent that hugs it, so Figma would shrink it to its smallest width.",
    ],
    [
      "a text whose fixed width binds a string variable",
      kitWithRoot((root) => ({
        ...root,
        children: [
          {
            ...LABEL,
            sizing: {
              horizontal: {
                kind: "fixed",
                length: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
              },
              vertical: { kind: "hug" },
            },
          },
        ],
      })),
      "Fuse tokens/font-sans is a STRING variable, and the kit binds it to a field that takes a FLOAT.",
    ],
    [
      "a limit that binds a string variable",
      kitWithRoot((root) => ({
        ...root,
        limits: {
          ...root.limits,
          maxWidth: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
        },
      })),
      "Fuse tokens/font-sans is a STRING variable, and the kit binds it to a field that takes a FLOAT.",
    ],
    [
      "a root that limits its fixed height",
      kitWithRoot((root) => ({ ...root, limits: { ...root.limits, minHeight: literal(40) } })),
      "Button: button in the variant button/size=md sets minHeight on its fixed height. Fold the limit into the height, as CSS resolves a height against its own limits.",
    ],
    [
      "a frame that limits its fixed width",
      nestedKit([
        {
          ...frame("button/control", "Control", [LABEL]),
          sizing: { horizontal: { kind: "fixed", length: literal(100) }, vertical: { kind: "hug" } },
          limits: { ...NO_LIMITS, maxWidth: literal(24) },
        },
      ]),
      "Button: Control in the variant button/size=md sets maxWidth on its fixed width. Fold the limit into the width, as CSS resolves a width against its own limits.",
    ],
  ])("stops Plan before any write for %s", async (_, kit, message) => {
    const { file, setup } = fixture("Roboto");
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  // Unit under test: the kit check of an image fill. Oracle: the PNG specification's signature and
  // IHDR chunk (§5.2, §11.2.2), the 4096px limit Figma's `createImage` reference states, P9b, where
  // a real file refused a PNG signature alone and stored the first 100 bytes of a PNG, and the
  // SHA-1 `shasum -a 1` gives each fixture.
  const IMAGE = "Button: Image in the variant button/size=md fills with";
  it.each([
    [
      "a PNG signature alone",
      imageFrame(PNG_SIGNATURE),
      `${IMAGE} a PNG whose header stops before a whole IHDR chunk.`,
    ],
    [
      "the start of a JPEG",
      imageFrame(JPEG_HEAD),
      `${IMAGE} an image that is no PNG file, the one format the kit ships.`,
    ],
    [
      "a PNG 4097 pixels wide",
      imageFrame(PNG_4097_WIDE),
      `${IMAGE} a 4097 × 1 image, and Figma stores images from 1 to 4096 pixels on a side.`,
    ],
    [
      "a hash that is not the SHA-1 of the bytes",
      imageFrame(RED_PIXEL, BLUE_PIXEL.sha1),
      `${IMAGE} an image whose bytes hash to ${RED_PIXEL.sha1}, where the kit names ${BLUE_PIXEL.sha1}. Build the plugin again.`,
    ],
  ])("stops Plan and Apply before any write for an image fill with %s", async (_, layer, message) => {
    const { file, setup } = fixture("Roboto");
    await expect(reconcileKit(file.figma, nestedKit([layer]), false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, nestedKit([layer]), true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("passes a PNG cut off after its header, which a real file stored, and Apply converges", async () => {
    const { file } = fixture("Roboto");
    const kit = nestedKit([imageFrame(PORTRAIT_HEAD)]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });
});

describe("a set that moves to a page pinning other modes", () => {
  const GRAY = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
  const RED = { r: 1, g: 0, b: 0, a: 1 };
  const LEGACY = { key: "page/components", name: "Fuse components" };
  const BUTTON = { key: "page/button", name: "Button" };
  const [set] = KIT.componentSets;
  if (set === undefined) {
    throw new Error("the kit has no component set");
  }
  /** A ring bound to `ring`, which is gray in the light mode and red in the dark one. */
  const ringed = {
    ...set,
    variants: set.variants.map((variant) => ({
      ...variant,
      root: {
        ...variant.root,
        children: [],
        shadows: [
          {
            color: { kind: "variable", variable: { collection: "Fuse tokens", name: "ring" } },
            offsetX: 0,
            offsetY: 0,
            radius: literal(0),
            spread: literal(2),
          } as const,
        ],
      },
    })),
  };
  const kitOn = (page: typeof BUTTON): KitSpec => ({
    ...KIT,
    pages: [page],
    fonts: [],
    icons: { ...KIT.icons, page: page.key },
    componentSets: [{ ...ringed, page: page.key }],
  });

  it("plans the set in its new page's modes, so one Apply converges", async () => {
    const file = createFakeFigma({
      collections: [
        {
          name: "Fuse tokens",
          modes: ["Light", "Dark"],
          variables: [
            ["background", { r: 1, g: 1, b: 1, a: 1 }, { r: 0, g: 0, b: 0, a: 1 }] as const,
            ["ring", GRAY, RED] as const,
          ].map(([name, light, dark]) => ({
            name,
            type: "COLOR",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([
              ["Light", { _tag: "Color", color: light }],
              ["Dark", { _tag: "Color", color: dark }],
            ]),
          })),
        },
      ],
    });
    const [tokens] = await file.figma.variables.getLocalVariableCollectionsAsync();
    const dark = tokens?.modes.find((mode) => mode.name === "Dark");
    if (tokens === undefined || dark === undefined) {
      throw new Error("the file has no dark mode");
    }
    const legacy = file.figma.createPage();
    legacy.name = LEGACY.name;
    setKey(legacy, LEGACY.key);
    legacy.setExplicitVariableModeForCollection(tokens, dark.modeId);
    await reconcileKit(file.figma, kitOn(LEGACY), true);
    file.reopen();
    await legacy.loadAsync();
    const variant = legacy.children.find((node) => node.type === "COMPONENT_SET")?.children[0];
    const ring = () => (variant?.type === "COMPONENT" ? variant.effects[0] : undefined);
    expect(ring()).toMatchObject({ type: "DROP_SHADOW", color: RED });

    await reconcileKit(file.figma, kitOn(BUTTON), true);
    file.reopen();
    expect(await reconcileKit(file.figma, kitOn(BUTTON), false)).toEqual({ changes: [], warnings: [] });
    expect(ring()).toMatchObject({ type: "DROP_SHADOW", color: GRAY });
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
type LayerTree = {
  readonly type: SceneNode["type"];
  readonly name: string;
  readonly key: string;
  readonly children?: readonly LayerTree[];
};

/** The layers below a node, each frame with the layers it holds. */
function layerTree(parent: ChildrenMixin): LayerTree[] {
  return parent.children.map((node): LayerTree => {
    const layer = { type: node.type, name: node.name, key: keyOf(node) };
    return node.type === "FRAME" ? { ...layer, children: layerTree(node) } : layer;
  });
}

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
  it("creates both frames, the icon and the label in one Apply, and the next Plan lists nothing", async () => {
    const { file, control } = await nestedFile();
    expect(await reconcileKit(file.figma, nestedKit(), false)).toEqual({ changes: [], warnings: [] });
    expect(layerTree(await buttonVariant(file))).toEqual([
      {
        type: "FRAME",
        name: "Control",
        key: "button/control",
        children: [
          {
            type: "FRAME",
            name: "Indicator",
            key: "button/indicator",
            children: [
              { type: "INSTANCE", name: "Check", key: "button/check" },
              { type: "TEXT", name: "Label", key: "button/label" },
            ],
          },
        ],
      },
    ]);
    // A part below the root shows its overflow and paints nothing its spec does not ask for.
    expect([control.clipsContent, control.fills]).toEqual([false, []]);
  });

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
    absolute: { x: 0, y: 0, constraints: { horizontal: "SCALE", vertical: "STRETCH" } },
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
      "Button / size=md / Bar / Fill: layoutPositioning → ABSOLUTE, constraints → SCALE STRETCH, x → 0, y → 0",
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

// Unit under test: `reconcileKit` on a variant whose root strokes a dashed border, as the dashed
// Empty does. Oracle: the fake's rule 27, after what a real file read on 2026-10-22 (PD): a dash
// pattern sits apart from the stroke's paints, so the color binding the stroke takes keeps it, a new
// pattern replaces it, and `[]` clears it. The pattern matches only with the same lengths, and the
// next Plan lists nothing.
describe("a variant whose root strokes a dashed border", () => {
  const SOLID_STROKE: StrokeSpec = {
    color: { kind: "variable", variable: { collection: "Fuse tokens", name: "background" } },
    weight: literal(1),
  };
  const stroked = (stroke: StrokeSpec) => kitWithRoot((root) => ({ ...root, stroke }));
  const DASHED = stroked({ ...SOLID_STROKE, dashPattern: [3, 2] });
  const SOLID = stroked(SOLID_STROKE);

  it("draws the dashes over the bound color in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, DASHED, true);
    file.reopen();
    expect(await reconcileKit(file.figma, DASHED, false)).toEqual({ changes: [], warnings: [] });
    const root = await buttonVariant(file);
    expect(root.dashPattern).toEqual([3, 2]);
    expect(root.strokes).toMatchObject([
      { type: "SOLID", boundVariables: { color: { id: file.variable("Fuse tokens", "background").id } } },
    ]);
  });

  it("plans a pattern a designer changed back to the kit's, and clears it for a solid stroke", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, DASHED, true);
    file.reopen();
    (await buttonVariant(file)).dashPattern = [4, 4];
    expect((await reconcileKit(file.figma, DASHED, false)).changes).toEqual([
      "Button / size=md: dashPattern → 3, 2 (holds 4, 4)",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, DASHED, true);
    file.reopen();
    expect((await reconcileKit(file.figma, SOLID, false)).changes).toEqual([
      "Button / size=md: dashPattern → none (holds 3, 2)",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, SOLID, true);
    file.reopen();
    expect(await reconcileKit(file.figma, SOLID, false)).toEqual({ changes: [], warnings: [] });
    expect((await buttonVariant(file)).dashPattern).toEqual([]);
  });
});
