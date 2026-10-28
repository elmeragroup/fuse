/**
 * The layout, text, image, property, rotation and stroke rules of the in-memory file in
 * `fake-figma.ts`, each on a few nodes built by hand. The oracle is what the test file `Elmera Fuse -
 * Import test` read back in net-zero probes from 2026-10-22 to 2026-10-25, named P0 to P9b, PB, PR,
 * PD, PL, PF, PH, PZ, NH, N9, PS and PS2 as the fake's header names them, PS3 and PS4 on the owner's
 * file `Untitled` on 2026-10-26, the PNG signature, the hashes `shasum -a 1` gives the fixture images,
 * and the typings where no probe ran. The planners' tests converge against these rules, so a rule
 * that drifts from the real file would let a plan pass that Figma would not keep.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma, paintsAbove } from "./fake-figma.ts";
import {
  BLUE_PIXEL,
  childNamed,
  color,
  fixtureFile,
  float,
  PNG_SIGNATURE,
  PORTRAIT_HEAD,
  RED_PIXEL,
} from "./fake-fixtures.ts";

const file = fixtureFile([float("Fuse density", "control-h-xs", 24)]);
const { figma } = file;

/** An auto layout frame of the given direction, on the current page. */
function autoLayout(direction: "HORIZONTAL" | "VERTICAL"): FrameNode {
  const frame = figma.createFrame();
  frame.layoutMode = direction;
  return frame;
}

/** A frame without auto layout inside `parent`. */
function childOf(parent: FrameNode | ComponentNode): FrameNode {
  const child = figma.createFrame();
  parent.appendChild(child);
  return child;
}

/** A text layer in `parent`, its font loaded, auto-resizing as given. */
async function textIn(parent: FrameNode, autoResize: TextNode["textAutoResize"]): Promise<TextNode> {
  const text = figma.createText();
  parent.appendChild(text);
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  text.textAutoResize = autoResize;
  return text;
}

const sizing = (node: LayoutMixin): readonly string[] => [
  node.layoutSizingHorizontal,
  node.layoutSizingVertical,
];

describe("rule 12: layout sizing reads as a projection of the sizing modes, the text's auto resize and the fill a parent gives", () => {
  it("reads a Button root, its label, its icon and its set as the real kit did (P0)", () => {
    const root = figma.createComponent();
    root.layoutMode = "HORIZONTAL";
    root.primaryAxisSizingMode = "AUTO";
    root.counterAxisSizingMode = "FIXED";
    const set = figma.combineAsVariants([root], figma.currentPage);
    const icon = figma.createComponent().createInstance();
    root.appendChild(icon);
    const label = figma.createText();
    root.appendChild(label);

    expect(sizing(root)).toEqual(["HUG", "FIXED"]);
    expect(sizing(label)).toEqual(["HUG", "HUG"]);
    expect(sizing(icon)).toEqual(["FIXED", "FIXED"]);
    expect(sizing(set)).toEqual(["FIXED", "FIXED"]);
  });

  it("reads a fixed-width text as fixed across and hugging down, and a fixed text box as fixed (P3)", async () => {
    const row = autoLayout("HORIZONTAL");
    expect(sizing(await textIn(row, "HEIGHT"))).toEqual(["FIXED", "HUG"]);
    expect(sizing(await textIn(row, "NONE"))).toEqual(["FIXED", "FIXED"]);
  });

  it("fills a row along its direction and a column across it, and turns the child's own hug fixed (P1)", () => {
    const row = autoLayout("HORIZONTAL");
    const inRow = childOf(row);
    inRow.layoutSizingHorizontal = "FILL";
    expect(sizing(inRow)).toEqual(["FILL", "FIXED"]);

    const column = autoLayout("VERTICAL");
    const inColumn = autoLayout("HORIZONTAL");
    column.appendChild(inColumn);
    inColumn.primaryAxisSizingMode = "AUTO";
    expect(sizing(inColumn)).toEqual(["HUG", "FIXED"]);
    inColumn.layoutSizingHorizontal = "FILL";
    expect(sizing(inColumn)).toEqual(["FILL", "FIXED"]);
    expect(inColumn.primaryAxisSizingMode).toBe("FIXED");
  });

  it("gives up the fill for the hug or fixed size written after it", () => {
    const column = autoLayout("VERTICAL");
    const child = autoLayout("HORIZONTAL");
    column.appendChild(child);
    child.layoutSizingHorizontal = "FILL";
    child.layoutSizingVertical = "FILL";
    expect(sizing(child)).toEqual(["FILL", "FILL"]);
    child.layoutSizingHorizontal = "HUG";
    child.layoutSizingVertical = "FIXED";
    expect(sizing(child)).toEqual(["HUG", "FIXED"]);
    expect([child.primaryAxisSizingMode, child.counterAxisSizingMode]).toEqual(["AUTO", "FIXED"]);
  });

  it("reads the fields behind the shorthand and takes no write of them, so the plugin writes only the shorthand", () => {
    const child = childOf(autoLayout("HORIZONTAL"));
    child.layoutSizingHorizontal = "FILL";
    expect([child.layoutGrow, child.layoutAlign]).toEqual([1, "INHERIT"]);
    expect(() => {
      child.layoutGrow = 0;
    }).toThrow("FrameNode.layoutGrow is read-only");
    expect(() => {
      child.layoutAlign = "STRETCH";
    }).toThrow("FrameNode.layoutAlign is read-only");
  });
});

describe("rule 13: a sizing Figma cannot apply throws the error the real file threw", () => {
  it("refuses fill outside any auto layout, as the real file did (P1), and hug there too", () => {
    const loose = figma.createFrame();
    expect(() => {
      loose.layoutSizingHorizontal = "FILL";
    }).toThrow(
      "in set_layoutSizingHorizontal: node must be an auto-layout frame or a child of an auto-layout frame"
    );
    expect(() => {
      loose.layoutSizingVertical = "HUG";
    }).toThrow(
      "in set_layoutSizingVertical: node must be an auto-layout frame or a child of an auto-layout frame"
    );
  });

  it("refuses hug on a frame without auto layout inside one (P1)", () => {
    const child = childOf(autoLayout("HORIZONTAL"));
    expect(() => {
      child.layoutSizingHorizontal = "HUG";
    }).toThrow(
      "in set_layoutSizingHorizontal: HUG can only be set on auto-layout frames or text children of auto-layout frames"
    );
  });

  it("refuses fill on a variant root, whose set has no auto layout, and lets it hug (P1)", () => {
    const root = figma.createComponent();
    root.layoutMode = "HORIZONTAL";
    figma.combineAsVariants([root], figma.currentPage);
    expect(() => {
      root.layoutSizingHorizontal = "FILL";
    }).toThrow("in set_layoutSizingHorizontal: FILL can only be set on children of auto-layout frames");
    root.layoutSizingHorizontal = "HUG";
    expect(sizing(root)).toEqual(["HUG", "FIXED"]);
  });
});

describe("rule 14: a resize or a width or height binding turns a filling or hugging axis fixed", () => {
  /** A frame that fills both axes of a column. */
  function filling(): FrameNode {
    const child = autoLayout("HORIZONTAL");
    autoLayout("VERTICAL").appendChild(child);
    child.layoutSizingHorizontal = "FILL";
    child.layoutSizingVertical = "FILL";
    return child;
  }

  it("turns a filling child fixed on resize, and a hugging frame too (P2)", () => {
    const child = filling();
    child.resize(40, 20);
    expect(sizing(child)).toEqual(["FIXED", "FIXED"]);

    const hugging = autoLayout("HORIZONTAL");
    hugging.layoutSizingHorizontal = "HUG";
    hugging.layoutSizingVertical = "HUG";
    hugging.resize(40, 20);
    expect(sizing(hugging)).toEqual(["FIXED", "FIXED"]);
  });

  it("turns a filling child fixed at the variable's value when its width binds one (P2)", () => {
    const child = filling();
    child.setBoundVariable("width", file.variable("Fuse density", "control-h-xs"));
    expect(child.layoutSizingHorizontal).toBe("FIXED");
    expect(child.width).toBe(24);
  });
});

describe("rule 15: a direction change keeps each sizing mode's axis role", () => {
  it("moves a row's hug from its width to its height when it turns into a column (P6)", () => {
    const frame = autoLayout("HORIZONTAL");
    frame.primaryAxisSizingMode = "AUTO";
    frame.counterAxisSizingMode = "FIXED";
    expect(sizing(frame)).toEqual(["HUG", "FIXED"]);
    frame.layoutMode = "VERTICAL";
    expect([frame.primaryAxisSizingMode, frame.counterAxisSizingMode]).toEqual(["AUTO", "FIXED"]);
    expect(sizing(frame)).toEqual(["FIXED", "HUG"]);
  });
});

describe("rule 16: a box keeps its limits, which apply to auto layout frames and their children", () => {
  const limits = (node: FrameNode | TextNode): readonly (number | null)[] => [
    node.minWidth,
    node.maxWidth,
    node.minHeight,
    node.maxHeight,
  ];

  it("keeps each limit on a column, on a frame in it and on a text in it, and clears it with null (P7)", async () => {
    const column = autoLayout("VERTICAL");
    const frame = childOf(column);
    const text = await textIn(column, "WIDTH_AND_HEIGHT");
    for (const node of [column, frame, text]) {
      node.minWidth = 16;
      node.maxWidth = 150;
      node.minHeight = 64;
      node.maxHeight = 200;
      expect(limits(node)).toEqual([16, 150, 64, 200]);
      node.maxWidth = null;
      node.minHeight = null;
      expect(limits(node)).toEqual([16, null, null, 200]);
    }
  });

  it("refuses a limit outside auto layout, and one that is not positive", () => {
    const loose = figma.createFrame();
    expect(() => {
      loose.maxHeight = 40;
    }).toThrow("maxHeight applies only to auto layout frames and their children");
    const row = autoLayout("HORIZONTAL");
    expect(() => {
      row.minHeight = 0;
    }).toThrow("minHeight must be positive");
  });

  it("binds a limit to a FLOAT variable and reads the variable's value (P7)", () => {
    const row = autoLayout("HORIZONTAL");
    row.setBoundVariable("maxWidth", file.variable("Fuse density", "control-h-xs"));
    expect(row.maxWidth).toBe(24);
    expect(row.boundVariables?.maxWidth?.id).toBe(file.variable("Fuse density", "control-h-xs").id);
  });
});

describe("rule 17: the counter alignment takes no stretch, and a baseline only in a row", () => {
  it("refuses STRETCH anywhere and BASELINE on a column, as the typings say", () => {
    const column = autoLayout("VERTICAL");
    expect(() => {
      // SAFETY: the typings leave STRETCH out of the counter alignment, which this write checks.
      column.counterAxisAlignItems = "STRETCH" as FrameNode["counterAxisAlignItems"];
    }).toThrow("counterAxisAlignItems takes no STRETCH");
    expect(() => {
      column.counterAxisAlignItems = "BASELINE";
    }).toThrow("BASELINE can only be set on horizontal auto-layout frames");
    const row = autoLayout("HORIZONTAL");
    row.counterAxisAlignItems = "BASELINE";
    expect(row.counterAxisAlignItems).toBe("BASELINE");
  });
});

describe("rule 18: space between survives the item spacing", () => {
  it("keeps SPACE_BETWEEN through a literal spacing and a bound one (P5)", () => {
    const row = autoLayout("HORIZONTAL");
    row.primaryAxisAlignItems = "SPACE_BETWEEN";
    row.itemSpacing = 8;
    expect(row.primaryAxisAlignItems).toBe("SPACE_BETWEEN");
    row.setBoundVariable("itemSpacing", file.variable("Fuse density", "control-h-xs"));
    expect([row.primaryAxisAlignItems, row.itemSpacing]).toEqual(["SPACE_BETWEEN", 24]);
  });
});

describe("rule 19: a text's layout sizing and its auto resize move together as the real file's did", () => {
  it("switches a hugging text to a fixed width and auto height when it fills a row, and keeps it filling when its auto resize asks to hug (P3)", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    text.layoutSizingHorizontal = "FILL";
    expect([text.textAutoResize, ...sizing(text)]).toEqual(["HEIGHT", "FILL", "HUG"]);
    text.textAutoResize = "WIDTH_AND_HEIGHT";
    expect([text.textAutoResize, ...sizing(text)]).toEqual(["HEIGHT", "FILL", "HUG"]);
  });

  it("fixes a filling text's width on resize, and keeps its height on its lines (P3)", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    // P3's text held three lines, so it had a width when it filled. Rule 31 covers an empty one.
    text.characters = "Three lines of text";
    text.layoutSizingHorizontal = "FILL";
    text.resize(80, 14);
    expect([text.textAutoResize, text.width, ...sizing(text)]).toEqual(["HEIGHT", 80, "FIXED", "HUG"]);
  });

  // No probe wrote a hug or a fixed size on a text, or a fill down one, so the fake refuses each
  // write that would change the text's auto resize, rather than guess what Figma does.
  it("lets a hug or fixed size stop a fill only where the auto resize already reads it", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    text.layoutSizingHorizontal = "FILL";
    text.layoutSizingHorizontal = "FIXED";
    expect([text.textAutoResize, ...sizing(text)]).toEqual(["HEIGHT", "FIXED", "HUG"]);
    expect(() => {
      text.layoutSizingHorizontal = "HUG";
    }).toThrow("does not model layoutSizingHorizontal HUG on a text whose auto resize is HEIGHT");
    expect(() => {
      text.layoutSizingVertical = "FILL";
    }).toThrow("does not model layoutSizingVertical FILL on a text");
    const loose = figma.createText();
    expect(() => {
      loose.layoutSizingHorizontal = "FILL";
    }).toThrow(
      "in set_layoutSizingHorizontal: node must be an auto-layout frame or a child of an auto-layout frame"
    );
  });
});

describe("rule 20: a text ends in an ellipsis after its maximum lines only while it truncates", () => {
  it("ignores maxLines while truncation is off, reads one line once it truncates, and takes null back (P4)", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    text.maxLines = 2;
    expect([text.textTruncation, text.maxLines]).toEqual(["DISABLED", null]);
    text.textTruncation = "ENDING";
    expect(text.maxLines).toBe(1);
    text.maxLines = 3;
    expect(text.maxLines).toBe(3);
    text.maxLines = null;
    expect(text.maxLines).toBeNull();
    expect(() => {
      text.maxLines = 0;
    }).toThrow("maxLines must be at least 1");
  });
});

describe("rules 19 to 21: the text writes need the text's fonts loaded", () => {
  it("refuses a sizing, truncation or alignment write while the text's font is not loaded", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    expect([text.textAlignHorizontal, text.textAlignVertical]).toEqual(["LEFT", "TOP"]);
    file.reopen();
    const writes: readonly (readonly [string, () => void])[] = [
      ["layoutSizingHorizontal", () => (text.layoutSizingHorizontal = "FILL")],
      ["textTruncation", () => (text.textTruncation = "ENDING")],
      ["maxLines", () => (text.maxLines = 2)],
      ["textAlignHorizontal", () => (text.textAlignHorizontal = "CENTER")],
      ["textAlignVertical", () => (text.textAlignVertical = "CENTER")],
    ];
    for (const [member, write] of writes) {
      expect(write, member).toThrow(
        `Cannot write ${member} of ${text.id} with unloaded font "Inter Regular"`
      );
    }
  });
});

/** The bytes of an ASCII text. */
function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

/** The signature every PNG file opens with (PNG specification §5.2). */
const PNG_SIGNATURE_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The error a real file threw for bytes without a PNG header (P9b). */
const UNSUPPORTED = "in createImage: Image type is unsupported";

describe("rule 22: an image with a whole PNG header is stored under the SHA-1 of its bytes", () => {
  it("decodes base64, names the image by the SHA-1 of its bytes, and finds it by that hash (P9, P9b)", () => {
    const bytes = figma.base64Decode(RED_PIXEL.bytes);
    expect([...bytes.slice(0, 8)]).toEqual(PNG_SIGNATURE_BYTES);
    expect(figma.createImage(bytes).hash).toBe(RED_PIXEL.sha1);
    expect(figma.createImage(figma.base64Decode(BLUE_PIXEL.bytes)).hash).toBe(BLUE_PIXEL.sha1);
    expect(figma.getImageByHash(RED_PIXEL.sha1)?.hash).toBe(RED_PIXEL.sha1);
    expect(figma.getImageByHash("0".repeat(40))).toBeNull();
  });

  it("stores a PNG cut off after its header and refuses the signature alone, as the real file did (P9b)", () => {
    expect(figma.createImage(figma.base64Decode(PORTRAIT_HEAD.bytes)).hash).toBe(PORTRAIT_HEAD.sha1);
    expect(() => figma.createImage(figma.base64Decode(PNG_SIGNATURE.bytes))).toThrow(UNSUPPORTED);
    expect(() => figma.createImage(ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toThrow(UNSUPPORTED);
  });

  it("logs storing an image as a write, though an image is no node", () => {
    const before = file.writes.length;
    figma.createImage(figma.base64Decode(RED_PIXEL.bytes));
    expect(file.writes.slice(before)).toEqual([`store the image ${RED_PIXEL.sha1}`]);
  });
});

describe("rule 23: an image paint reads back with the defaults the real file filled in", () => {
  it("fills in the defaults P9 read, and reads the same after its readback is written again (P9)", () => {
    const frame = figma.createFrame();
    const { hash } = figma.createImage(figma.base64Decode(RED_PIXEL.bytes));
    frame.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: hash }];
    const readback = frame.fills;
    expect(readback).toEqual([
      {
        type: "IMAGE",
        scaleMode: "FILL",
        imageHash: hash,
        visible: true,
        opacity: 1,
        blendMode: "NORMAL",
        scalingFactor: 1,
        rotation: 0,
        filters: {
          exposure: 0,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          tint: 0,
          highlights: 0,
          shadows: 0,
        },
        imageTransform: [
          [1, 0, 0],
          [0, 1, 0],
        ],
      },
    ]);
    frame.fills = readback;
    expect(frame.fills).toEqual(readback);
  });

  it("refuses an image paint whose hash names no image the file holds", () => {
    const frame = figma.createFrame();
    expect(() => {
      frame.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: "no such image" }];
    }).toThrow("holds no image no such image");
  });
});

describe("rule 24: an absolute layer sits outside its parent's auto layout and follows its constraints", () => {
  /**
   * The child P8 built: absolute in a 200 × 6 row at the row's top left, 170 wide, scaling across
   * and stretching down.
   */
  function absoluteChild() {
    const row = autoLayout("HORIZONTAL");
    row.resize(200, 6);
    const child = autoLayout("HORIZONTAL");
    row.appendChild(child);
    child.layoutPositioning = "ABSOLUTE";
    child.x = 0;
    child.y = 0;
    child.resize(170, 6);
    child.constraints = { horizontal: "SCALE", vertical: "STRETCH" };
    return { row, child };
  }

  it("keeps the place, size and constraints written on an absolute child, where an auto child ignores its place (P8)", () => {
    const { row, child } = absoluteChild();
    expect([child.layoutPositioning, child.width, child.height, child.constraints]).toEqual([
      "ABSOLUTE",
      170,
      6,
      { horizontal: "SCALE", vertical: "STRETCH" },
    ]);
    child.x = 12;
    child.y = 3;
    expect([child.x, child.y]).toEqual([12, 3]);
    const flowing = childOf(row);
    flowing.x = 12;
    expect([flowing.layoutPositioning, flowing.x]).toEqual(["AUTO", 0]);
  });

  it("scales the child's width and stretches its height with the row, keeping it at the top left (P8)", () => {
    const { row, child } = absoluteChild();
    row.resize(400, 6);
    expect([child.x, child.width]).toEqual([0, 340]);
    row.resize(400, 12);
    expect([child.y, child.height]).toEqual([0, 12]);
  });

  it("refuses FILL on an absolute child with the real file's error (P8)", () => {
    const { child } = absoluteChild();
    expect(() => {
      child.layoutSizingHorizontal = "FILL";
    }).toThrow(
      "in set_layoutSizingHorizontal: FILL cannot be set on absolute positioned auto-layout children"
    );
  });

  it("refuses to turn a layer absolute where no probe showed what Figma does", () => {
    const loose = childOf(figma.createFrame());
    expect(() => {
      loose.layoutPositioning = "ABSOLUTE";
    }).toThrow("does not model layoutPositioning ABSOLUTE");
    const filling = childOf(autoLayout("HORIZONTAL"));
    filling.layoutSizingHorizontal = "FILL";
    expect(() => {
      filling.layoutPositioning = "ABSOLUTE";
    }).toThrow("does not model layoutPositioning ABSOLUTE");
  });
});

describe("rule 25: a BOOLEAN property shows or hides the layers that link their visibility to it", () => {
  /**
   * The set PB built: two variants, each a row holding a `Title` and a `Detail` text, and a BOOLEAN
   * property `Optional` that starts as `defaultValue` and that each variant's `Detail` links.
   */
  function optionalDetail(defaultValue = true) {
    const variants = ["kind=a", "kind=b"].map((name) => {
      const variant = figma.createComponent();
      variant.name = name;
      variant.layoutMode = "HORIZONTAL";
      for (const layer of ["Title", "Detail"]) {
        const text = figma.createText();
        text.name = layer;
        variant.appendChild(text);
      }
      return variant;
    });
    const set = figma.combineAsVariants(variants, figma.currentPage);
    const id = set.addComponentProperty("Optional", "BOOLEAN", defaultValue);
    for (const variant of variants) {
      childNamed(variant, "TEXT", "Detail").componentPropertyReferences = { visible: id };
    }
    const [first] = variants;
    if (first === undefined) {
      throw new Error("the set holds no variant");
    }
    return { set, id, variant: first, instance: first.createInstance() };
  }

  /** Each layer a node lists, with whether it shows. */
  const shown = (node: ChildrenMixin) => node.children.map((layer) => [layer.name, layer.visible]);

  // The typings list an instance's variant properties in `componentProperties` beside the others.
  it("adds the property as its name and an id, and lists it on an instance at its default (PB)", () => {
    const { set, id, instance } = optionalDetail();
    expect(id).toMatch(/^Optional#\d+:\d+$/);
    expect(set.componentPropertyDefinitions[id]).toEqual({ type: "BOOLEAN", defaultValue: true });
    expect(instance.componentProperties).toEqual({
      kind: { type: "VARIANT", value: "a" },
      [id]: { type: "BOOLEAN", value: true },
    });
    expect(shown(instance)).toEqual([
      ["Title", true],
      ["Detail", true],
    ]);
  });

  // The plugin never sets `skipInvisibleInstanceChildren`, so it runs with the default the typings
  // give, false, under which an instance lists its hidden layers.
  it("hides the linked layer in an instance set to false, which keeps listing it, and leaves the variant's shown (PB)", () => {
    const { id, variant, instance } = optionalDetail();
    expect(figma.skipInvisibleInstanceChildren).toBe(false);
    instance.setProperties({ [id]: false });
    expect(instance.componentProperties[id]).toEqual({ type: "BOOLEAN", value: false });
    expect(shown(instance)).toEqual([
      ["Title", true],
      ["Detail", false],
    ]);
    expect(shown(variant)).toEqual([
      ["Title", true],
      ["Detail", true],
    ]);
    instance.setProperties({ [id]: true });
    expect(shown(instance)).toEqual([
      ["Title", true],
      ["Detail", true],
    ]);
  });

  it("leaves the hidden layer out of the instance's children while skipInvisibleInstanceChildren is set (PB, correction)", () => {
    const { id, variant, instance } = optionalDetail();
    instance.setProperties({ [id]: false });
    figma.skipInvisibleInstanceChildren = true;
    try {
      expect(shown(instance)).toEqual([["Title", true]]);
      expect(shown(variant)).toEqual([
        ["Title", true],
        ["Detail", true],
      ]);
    } finally {
      figma.skipInvisibleInstanceChildren = false;
    }
  });

  it("hides the variant's own layer and an instance's while the property starts false (PQ)", () => {
    const { id, variant, instance } = optionalDetail(false);
    expect(shown(variant)).toEqual([
      ["Title", true],
      ["Detail", false],
    ]);
    expect(shown(instance)).toEqual([
      ["Title", true],
      ["Detail", false],
    ]);
    instance.setProperties({ [id]: true });
    expect(shown(instance)).toEqual([
      ["Title", true],
      ["Detail", true],
    ]);
  });

  it("refuses to set a property the instance's set does not define, and a layer's own visibility, where no probe ran", () => {
    const { instance } = optionalDetail();
    expect(() => {
      instance.setProperties({ "Missing#9:9": false });
    }).toThrow("shows no property Missing#9:9");
    const [title] = instance.children;
    expect(() => {
      if (title !== undefined) {
        title.visible = false;
      }
    }).toThrow("visible is read-only");
  });
});

describe("rule 42: a hidden child reads FIXED on an axis it fills, and keeps the fill in layoutGrow or layoutAlign (NH)", () => {
  /**
   * A variant of `direction`, fixed 300 × 100 unless it hugs, holding a frame whose visibility the
   * BOOLEAN `Shown` links, which starts false, so the frame starts hidden. `show` changes the default.
   */
  function hiddenChild(direction: "HORIZONTAL" | "VERTICAL", hugs = false) {
    const variant = figma.createComponent();
    variant.layoutMode = direction;
    variant.resize(300, 100);
    if (hugs) {
      variant.primaryAxisSizingMode = "AUTO";
      variant.counterAxisSizingMode = "AUTO";
    }
    const child = childOf(variant);
    const set = figma.combineAsVariants([variant], figma.currentPage);
    const id = set.addComponentProperty("Shown", "BOOLEAN", false);
    child.componentPropertyReferences = { visible: id };
    const show = (shown: boolean) => {
      set.editComponentProperty(id, { defaultValue: shown });
    };
    return { child, show };
  }

  it("reads a hidden fill across a fixed column FIXED with layoutAlign STRETCH, and FILL once shown", () => {
    const { child, show } = hiddenChild("VERTICAL");
    child.layoutSizingHorizontal = "FILL";
    expect([child.visible, child.layoutSizingHorizontal, child.layoutAlign]).toEqual([
      false,
      "FIXED",
      "STRETCH",
    ]);
    show(true);
    expect([child.visible, child.layoutSizingHorizontal]).toEqual([true, "FILL"]);
    show(false);
    expect([child.layoutSizingHorizontal, child.layoutAlign]).toEqual(["FIXED", "STRETCH"]);
  });

  it("reads a fill written while shown FIXED with STRETCH once hidden", () => {
    const { child, show } = hiddenChild("VERTICAL");
    show(true);
    child.layoutSizingHorizontal = "FILL";
    show(false);
    expect([child.layoutSizingHorizontal, child.layoutAlign]).toEqual(["FIXED", "STRETCH"]);
  });

  it("reads a hidden fill along a fixed row FIXED with layoutGrow 1, and FILL once shown", () => {
    const { child, show } = hiddenChild("HORIZONTAL");
    child.layoutSizingHorizontal = "FILL";
    expect([child.layoutSizingHorizontal, child.layoutGrow]).toEqual(["FIXED", 1]);
    show(true);
    expect(child.layoutSizingHorizontal).toBe("FILL");
  });

  it("reads a hidden fill down a hugging row FIXED with STRETCH, and FILL once shown", () => {
    const { child, show } = hiddenChild("HORIZONTAL", true);
    child.layoutSizingVertical = "FILL";
    expect([child.layoutSizingVertical, child.layoutAlign]).toEqual(["FIXED", "STRETCH"]);
    show(true);
    expect(child.layoutSizingVertical).toBe("FILL");
  });
});

describe("rule 26: auto layout keeps a rotated layer's box in its slot, and the layer's place moves with the turn", () => {
  /** The layer PR turned: a 16px icon instance in a row, 34px from the row's left. */
  function iconInRow(): InstanceNode {
    const row = autoLayout("HORIZONTAL");
    const icon = figma.createComponent().createInstance();
    icon.resize(16, 16);
    icon.x = 34;
    row.appendChild(icon);
    return icon;
  }

  it("moves the icon's place to its far corner at 180 and keeps its box, and moves it back at 0 (PR)", () => {
    const icon = iconInRow();
    const box = icon.absoluteBoundingBox;
    icon.rotation = 180;
    expect([icon.rotation, icon.x, icon.y]).toEqual([180, 50, 16]);
    expect(icon.absoluteBoundingBox).toEqual(box);
    icon.rotation = 0;
    expect([icon.rotation, icon.x, icon.y]).toEqual([0, 34, 0]);
  });

  // Oracle: the typings, which turn a layer about its top left and read its rotation from -180 to
  // 180 as `atan2(-m10, m00)` of its transform, and PQ, where a free frame at -90 turned about its
  // top left and read `relativeTransform` `[[0, -1], [1, 0]]`, its x axis pointing down.
  it("turns a layer outside auto layout about its top left, and reads a whole turn more as the same rotation", () => {
    const loose = figma.createFrame();
    loose.resize(20, 10);
    loose.x = 5;
    loose.y = 5;
    loose.rotation = -90;
    expect([loose.rotation, loose.x, loose.y]).toEqual([-90, 5, 5]);
    expect(loose.absoluteBoundingBox).toEqual({ x: -5, y: 5, width: 10, height: 20 });
    loose.rotation = 270;
    expect(loose.rotation).toBe(-90);
  });
});

describe("rule 27: a stroke's dash pattern sits apart from its paints", () => {
  it("keeps the pattern through a color binding, takes another with the binding kept, and clears it with [] (PD)", () => {
    const dashed = fixtureFile([color("Fuse tokens", "border", { r: 0.9, g: 0.9, b: 0.9, a: 1 })]);
    const border = dashed.variable("Fuse tokens", "border");
    // The frame PD built: a 1px SOLID stroke with the pattern `[4, 4]`.
    const frame = dashed.figma.createFrame();
    const solid: SolidPaint = { type: "SOLID", color: { r: 0, g: 0, b: 0 } };
    frame.strokes = [solid];
    frame.strokeWeight = 1;
    frame.dashPattern = [4, 4];
    expect(frame.dashPattern).toEqual([4, 4]);
    frame.strokes = [dashed.figma.variables.setBoundVariableForPaint(solid, "color", border)];
    expect(frame.dashPattern).toEqual([4, 4]);
    frame.dashPattern = [2, 2];
    expect(frame.dashPattern).toEqual([2, 2]);
    expect(frame.strokes).toMatchObject([{ boundVariables: { color: { id: border.id } } }]);
    frame.dashPattern = [];
    expect(frame.dashPattern).toEqual([]);
  });
});

describe("rule 46: a stroke's weight on each side", () => {
  it("writes each side alone and reads the stroke's weight mixed until one weight sets every side (N9)", () => {
    // N9's frame: a fixed column with a stroke whose weights are top 0, right 1, bottom 0, left 0.
    const frame = autoLayout("VERTICAL");
    frame.resize(120, 40);
    frame.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    frame.strokeTopWeight = 0;
    frame.strokeRightWeight = 1;
    frame.strokeBottomWeight = 0;
    frame.strokeLeftWeight = 0;
    frame.strokeAlign = "INSIDE";
    frame.strokesIncludedInLayout = false;
    expect([
      frame.strokeTopWeight,
      frame.strokeRightWeight,
      frame.strokeBottomWeight,
      frame.strokeLeftWeight,
      frame.strokeWeight === figma.mixed,
      frame.strokesIncludedInLayout,
    ]).toEqual([0, 1, 0, 0, true, false]);
    frame.strokeWeight = 2;
    expect([frame.strokeTopWeight, frame.strokeRightWeight, frame.strokeWeight]).toEqual([2, 2, 2]);
  });

  // PS's hugging frames: a column padded 10 on the left and right, around a 50 × 20 child, which the
  // fake lays out where the child is an instance of a set's variant (rule 32).
  it.each([
    [[0, 0, 0, 1], true, [71, 20]],
    [[2, 0, 0, 0], true, [70, 22]],
    [[0, 0, 0, 1], false, [70, 20]],
    [[2, 0, 0, 0], false, [70, 20]],
  ] as const)("hugs a column with weights %j, in the layout %s, at %j (PS)", (weights, included, size) => {
    const component = figma.createComponent();
    component.resize(50, 20);
    figma.combineAsVariants([component], figma.currentPage);
    const column = autoLayout("VERTICAL");
    column.primaryAxisSizingMode = "AUTO";
    column.counterAxisSizingMode = "AUTO";
    column.paddingLeft = 10;
    column.paddingRight = 10;
    column.appendChild(component.createInstance());
    column.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    const [top, right, bottom, left] = weights;
    // A nonzero side first on a never-written weight is unprobed (rule 49), so the weight comes first.
    column.strokeWeight = Math.max(...weights);
    column.strokeTopWeight = top;
    column.strokeRightWeight = right;
    column.strokeBottomWeight = bottom;
    column.strokeLeftWeight = left;
    column.strokesIncludedInLayout = included;
    expect([column.width, column.height]).toEqual(size);
  });
});

describe("rule 49: a 0 side on a never-written stroke weight sets every side", () => {
  type Weights = readonly [number, number, number, number];
  const SIDES = ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"] as const;
  const read = (frame: FrameNode) => SIDES.map((side) => frame[side]);
  const stroked = (direction: "VERTICAL" | "NONE") => {
    const frame = figma.createFrame();
    frame.layoutMode = direction;
    frame.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    return frame;
  };

  // PS2's isolated rows: a frame or an auto layout frame whose weight was never written.
  it.each(["NONE", "VERTICAL"] as const)("zeroes every side on the first 0, layout %s (PS2)", (direction) => {
    const frame = stroked(direction);
    expect(read(frame)).toEqual([1, 1, 1, 1]);
    frame.strokeTopWeight = 0;
    expect(read(frame)).toEqual([0, 0, 0, 0]);
    frame.strokeRightWeight = 0;
    expect(read(frame)).toEqual([0, 0, 0, 0]);
  });

  it("writes each side alone after an explicit strokeWeight (PS2)", () => {
    const frame = stroked("NONE");
    frame.strokeWeight = 1;
    frame.strokeTopWeight = 0;
    expect(read(frame)).toEqual([0, 1, 1, 1]);
    frame.strokeRightWeight = 0;
    expect(read(frame)).toEqual([0, 0, 1, 1]);
  });

  it("ends the plugin's old sequence at the one side written after the spill (PS2)", () => {
    const frame = stroked("VERTICAL");
    frame.strokeTopWeight = 0;
    frame.strokeRightWeight = 0;
    frame.strokeBottomWeight = 0;
    expect(read(frame)).toEqual([0, 0, 0, 0]);
    frame.strokeLeftWeight = 1;
    expect([...read(frame), frame.strokeWeight === figma.mixed]).toEqual([0, 0, 0, 1, true]);
  });

  // PS2's explicit table. Each start is a `strokeWeight` write, then the sides, nonzero last.
  it.each([
    [[1, 1, 1, 1], "strokeTopWeight", 0, [0, 1, 1, 1]],
    [[1, 1, 1, 1], "strokeLeftWeight", 0, [1, 1, 1, 0]],
    [[1, 1, 1, 1], "strokeTopWeight", 2, [2, 1, 1, 1]],
    [[2, 2, 2, 2], "strokeRightWeight", 1, [2, 1, 2, 2]],
    [[2, 1, 1, 1], "strokeRightWeight", 0, [2, 0, 1, 1]],
    [[0, 1, 0, 1], "strokeRightWeight", 0, [0, 0, 0, 1]],
    [[0, 0, 0, 1], "strokeLeftWeight", 0, [0, 0, 0, 0]],
    [[0, 0, 0, 0], "strokeLeftWeight", 1, [0, 0, 0, 1]],
  ] as const)("from %j, %s = %d reads %j (PS2)", (start: Weights, side, weight, result: Weights) => {
    const frame = stroked("VERTICAL");
    frame.strokeWeight = 1;
    const [top, right, bottom, left] = start;
    const writes = [
      ["strokeTopWeight", top],
      ["strokeRightWeight", right],
      ["strokeBottomWeight", bottom],
      ["strokeLeftWeight", left],
    ] as const;
    for (const [field, value] of [
      ...writes.filter(([, w]) => w === 0),
      ...writes.filter(([, w]) => w !== 0),
    ]) {
      frame[field] = value;
    }
    expect(read(frame)).toEqual(start);
    frame[side] = weight;
    expect(read(frame)).toEqual(result);
  });

  it("refuses a nonzero side first on a never-written weight, which no probe read", () => {
    const frame = stroked("VERTICAL");
    expect(() => {
      frame.strokeLeftWeight = 1;
    }).toThrow(/PS2/);
  });
});

describe("rule 57: turning auto layout on includes the strokes in the layout (PS3, PS4)", () => {
  it.each([
    ["frame", () => figma.createFrame()],
    ["component", () => figma.createComponent()],
  ] as const)("starts a new %s false and turns it true with a row or a column", (_, make) => {
    for (const direction of ["HORIZONTAL", "VERTICAL"] as const) {
      const node = make();
      expect(node.strokesIncludedInLayout).toBe(false);
      node.layoutMode = direction;
      expect(node.strokesIncludedInLayout).toBe(true);
    }
  });

  it("turns a new frame true with a grid (PS4)", () => {
    const frame = figma.createFrame();
    expect(frame.strokesIncludedInLayout).toBe(false);
    frame.layoutMode = "GRID";
    expect(frame.strokesIncludedInLayout).toBe(true);
  });

  // PS4's row: padding 0, hugging both axes, around a fixed 20 × 20 child, which the fake lays out
  // where the child is an instance of a set's variant (rule 32).
  it.each([
    ["no stroke paint, weight 1", false, 1, [20, 20]],
    ["no stroke paint, weight 4", false, 4, [20, 20]],
    ["a SOLID INSIDE stroke, weight 4", true, 4, [28, 28]],
  ] as const)("hugs a row in the layout with %s at %j (PS4)", (_, painted, weight, size) => {
    const component = figma.createComponent();
    component.resize(20, 20);
    figma.combineAsVariants([component], figma.currentPage);
    const row = autoLayout("HORIZONTAL");
    row.primaryAxisSizingMode = "AUTO";
    row.counterAxisSizingMode = "AUTO";
    row.appendChild(component.createInstance());
    if (painted) {
      row.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      row.strokeAlign = "INSIDE";
    }
    row.strokeWeight = weight;
    expect(row.strokesIncludedInLayout).toBe(true);
    expect([row.width, row.height]).toEqual(size);
  });

  it.each(["VERTICAL", "GRID", "HORIZONTAL", "NONE"] as const)(
    "keeps a row's false when it turns to %s",
    (direction) => {
      const frame = autoLayout("HORIZONTAL");
      frame.strokesIncludedInLayout = false;
      frame.layoutMode = direction;
      expect(frame.strokesIncludedInLayout).toBe(false);
    }
  );
});

describe("rule 58: strokesIncludedInLayout takes a write only in auto layout (PS3)", () => {
  it("refuses a write on a frame without auto layout with the real file's error", () => {
    const frame = figma.createFrame();
    expect(() => {
      frame.strokesIncludedInLayout = true;
    }).toThrow(
      "in set_strokesIncludedInLayout: Can only set strokesIncludedInLayout on nodes with layoutMode !== NONE"
    );
  });

  it("keeps a false written after the turn", () => {
    const frame = autoLayout("VERTICAL");
    frame.strokesIncludedInLayout = false;
    expect(frame.strokesIncludedInLayout).toBe(false);
  });
});

describe("rule 28: a text's letter spacing", () => {
  it("starts at 0%, keeps a percent as written and pixels as a 32-bit float (PL)", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    expect(text.letterSpacing).toEqual({ unit: "PERCENT", value: 0 });
    text.letterSpacing = { unit: "PERCENT", value: -2.5 };
    expect(text.letterSpacing).toEqual({ unit: "PERCENT", value: -2.5 });
    text.letterSpacing = { unit: "PIXELS", value: -0.45 };
    expect(text.letterSpacing).toEqual({ unit: "PIXELS", value: -0.44999998807907104 });
  });

  it("refuses a write while the text's font is not loaded", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    file.reopen();
    expect(() => {
      text.letterSpacing = { unit: "PERCENT", value: -2.5 };
    }).toThrow(`Cannot write letterSpacing of ${text.id} with unloaded font "Inter Regular"`);
  });
});

describe("rule 29: a layer that fills across a hugging row stretches to the height its other layers set", () => {
  /** PF's row: hugging both ways, a fixed 40 × 40 square, and a hugging 39 × 16 frame beside it. */
  function hugRow() {
    const row = autoLayout("HORIZONTAL");
    row.primaryAxisSizingMode = "AUTO";
    row.counterAxisSizingMode = "AUTO";
    const square = childOf(row);
    square.resize(40, 40);
    const box = autoLayout("HORIZONTAL");
    row.appendChild(box);
    box.resize(39, 16);
    box.primaryAxisSizingMode = "AUTO";
    box.counterAxisSizingMode = "AUTO";
    return { row, square, box };
  }

  it("stretches the filling frame to the square's 40, keeps the row hugging, and follows the square to 60 (PF)", () => {
    const { row, square, box } = hugRow();
    box.layoutSizingVertical = "FILL";
    expect([box.layoutSizingVertical, box.height, sizing(row)]).toEqual(["FILL", 40, ["HUG", "HUG"]]);
    square.resize(40, 60);
    expect([box.height, box.absoluteBoundingBox?.height]).toEqual([60, 60]);
  });

  it("keeps the frame's own height while it hugs", () => {
    expect(hugRow().box.height).toBe(16);
  });
});

describe("rule 31: a fill across never widens a text that is 0 wide, and a positive width lets it take over (PZ)", () => {
  /** A text in a fixed 384px row, its font loaded, auto-resizing as given. */
  async function inRow(autoResize: TextNode["textAutoResize"]): Promise<TextNode> {
    const row = autoLayout("HORIZONTAL");
    row.resize(384, 40);
    return textIn(row, autoResize);
  }

  it("leaves an empty text under HEIGHT 0 wide through a fill, its characters and the fill again", async () => {
    const text = await inRow("HEIGHT");
    expect(text.width).toBe(0);
    text.layoutSizingHorizontal = "FILL";
    text.characters = "Two words";
    text.layoutSizingHorizontal = "FILL";
    expect([text.width, ...sizing(text)]).toEqual([0, "FILL", "HUG"]);
  });

  it("gives a text its characters' width before a fill, which the fill keeps", async () => {
    const text = await inRow("WIDTH_AND_HEIGHT");
    text.characters = "Two words";
    text.layoutSizingHorizontal = "FILL";
    expect(sizing(text)).toEqual(["FILL", "HUG"]);
    expect(text.width).toBeGreaterThan(0);
  });

  it("keeps a 0-wide filling text filling through a positive resize, which gives it a width", async () => {
    const text = await inRow("HEIGHT");
    text.layoutSizingHorizontal = "FILL";
    text.characters = "Two words";
    text.resize(1, text.height);
    expect(sizing(text)).toEqual(["FILL", "HUG"]);
    expect(text.width).toBeGreaterThan(0);
  });
});

describe("rule 32: an instance takes its main component's new size when read, and a wrap frame sizes from its children as they stand (PI)", () => {
  /** A 100px wrap row that hugs its height, padded 4 and spaced 2, holding an instance of a 40px square. */
  function wrapped(api: PluginAPI = figma) {
    const component = api.createComponent();
    component.resize(40, 40);
    const row = api.createFrame();
    row.layoutMode = "HORIZONTAL";
    row.layoutWrap = "WRAP";
    row.resize(100, 10);
    row.layoutSizingVertical = "HUG";
    row.paddingTop = 4;
    row.paddingBottom = 4;
    row.counterAxisSpacing = 2;
    const instance = component.createInstance();
    row.appendChild(instance);
    return { component, row, instance };
  }

  it("keeps the instance and the frame at the old size until the instance is read", () => {
    const { component, row, instance } = wrapped();
    expect(row.height).toBe(48);
    component.resize(40, 20);
    expect(row.height).toBe(48);
    expect(instance.height).toBe(20);
    expect(row.height).toBe(28);
  });

  it("wraps the children into rows of the frame's width", () => {
    const { component, row } = wrapped();
    const second = component.createInstance();
    row.appendChild(second);
    const third = component.createInstance();
    row.appendChild(third);
    // Two 40px squares and a 0px gap fit 92px, and the third starts a row.
    expect(row.height).toBe(4 + 40 + 2 + 40 + 4);
  });

  it.each([
    ["resized", (instance: InstanceNode) => instance.resize(32, 32)],
    ["rescaled", (instance: InstanceNode) => instance.rescale(2)],
  ])("keeps the size of an instance a designer %s, in this run and the next", (_, change) => {
    const own = fixtureFile([]);
    const component = own.figma.createComponent();
    component.resize(16, 16);
    const instance = component.createInstance();
    change(instance);
    const read = [instance.width, instance.height];
    own.reopen();
    expect([...read, instance.width, instance.height]).toEqual([32, 32, 32, 32]);
  });

  it("gives an instance of a wrapping component the component's height on its first read", () => {
    const component = figma.createComponent();
    component.layoutMode = "HORIZONTAL";
    component.layoutWrap = "WRAP";
    component.resize(100, 10);
    component.layoutSizingVertical = "HUG";
    const child = childOf(component);
    child.resize(40, 40);
    expect(component.createInstance().height).toBe(40);
  });

  it("settles every instance in a new run", () => {
    const own = fixtureFile([]);
    const { component, row } = wrapped(own.figma);
    component.resize(40, 20);
    own.reopen();
    expect(row.height).toBe(28);
  });
});

describe("rule 33: an auto layout paints a later child above an earlier one, and the first on top with itemReverseZIndex (PZ2)", () => {
  /** A vertical stack of a header holding a ring and a panel below it, as an open Accordion item holds. */
  function stack() {
    const item = autoLayout("VERTICAL");
    const header = childOf(item);
    const ring = childOf(header);
    const panel = childOf(item);
    return { item, header, ring, panel };
  }

  it("paints the panel over the header's ring until the stack puts its first child on top", () => {
    const { item, header, ring, panel } = stack();
    expect([item.itemReverseZIndex, paintsAbove(ring, panel), paintsAbove(panel, header)]).toEqual([
      false,
      false,
      true,
    ]);
    item.itemReverseZIndex = true;
    expect([item.itemReverseZIndex, paintsAbove(ring, panel), paintsAbove(panel, header)]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("paints a layer above the frame that holds it, whatever the order", () => {
    const { item, header, ring } = stack();
    item.itemReverseZIndex = true;
    expect([paintsAbove(ring, header), paintsAbove(header, ring), paintsAbove(ring, item)]).toEqual([
      true,
      false,
      true,
    ]);
  });

  it.each([
    ["a horizontal auto layout", () => autoLayout("HORIZONTAL")],
    ["a frame with no auto layout", () => figma.createFrame()],
  ])("refuses the first child on top on %s, which no probe drew", (_, make) => {
    const frame = make();
    expect(() => {
      frame.itemReverseZIndex = true;
    }).toThrow("The fake Figma file models itemReverseZIndex only on a vertical auto layout (PZ2)");
  });
});

describe("rule 30: a text's percent line height", () => {
  it("keeps a percent as written, through a font size bound to a variable (PH)", async () => {
    const text = await textIn(autoLayout("HORIZONTAL"), "WIDTH_AND_HEIGHT");
    text.lineHeight = { unit: "PERCENT", value: 137.5 };
    expect(text.lineHeight).toEqual({ unit: "PERCENT", value: 137.5 });
    text.setBoundVariable("fontSize", file.variable("Fuse density", "control-h-xs"));
    expect([text.fontSize, text.lineHeight]).toEqual([24, { unit: "PERCENT", value: 137.5 }]);
  });
});

describe("rule 59: CENTER keeps a centre offset only through a whole-pixel shift (W5-P11b)", () => {
  /**
   * W5-P11b's popup: a 229px component holding a 10px arrow, ABSOLUTE at CENTER × MAX, its centre at
   * x 114.5, and an instance of it resized. The real file put the centre 0.5px off when the instance
   * narrowed by an odd 187px (42 wide, 20.5 where an exact half gives 21). One reading cannot tell
   * which way Figma rounds, so the fake refuses that read rather than approve a placement.
   */
  function arrowInPopup() {
    const api = createFakeFigma({ collections: [] }).figma;
    const popup = api.createComponent();
    popup.resize(229, 34);
    const arrow = api.createFrame();
    popup.appendChild(arrow);
    arrow.resize(10, 10);
    arrow.constraints = { horizontal: "CENTER", vertical: "MAX" };
    arrow.x = 114.5 - 5;
    arrow.y = 34 - 10;
    api.combineAsVariants([popup], api.currentPage);
    const instance = popup.createInstance();
    const [placed] = instance.children;
    if (placed?.type !== "FRAME") {
      throw new Error("the instance shows the arrow frame");
    }
    return { instance, placed };
  }

  it("keeps the exact centre where the instance's width changes by an even number of pixels", () => {
    const { instance, placed } = arrowInPopup();
    instance.resize(41, 34);
    expect(placed.x + placed.width / 2).toBe(20.5);
  });

  it("refuses the place where the width changes by an odd number of pixels", () => {
    const { instance, placed } = arrowInPopup();
    instance.resize(42, 34);
    expect(() => placed.x).toThrow("W5-P11b");
  });
});

describe("rule 47: an absolute instance at MAX × CENTER keeps its end inset and its centre offset", () => {
  /**
   * N11's item: a 200px component that hugs its height around a row instance whose height binds
   * `row-h`, 32 Dense and 36 Comfortable, and an absolute badge instance 23 × 19 at MAX × CENTER, 4px
   * from the end and centred on the row.
   */
  async function badgeInItem() {
    const own = createFakeFigma({
      collections: [
        {
          name: "Fuse density",
          modes: ["Dense", "Comfortable"],
          variables: [
            {
              name: "row-h",
              type: "FLOAT",
              scopes: [],
              webSyntax: undefined,
              description: "",
              values: new Map([
                ["Dense", { _tag: "Float", value: 32 }],
                ["Comfortable", { _tag: "Float", value: 36 }],
              ]),
            },
          ],
        },
      ],
    });
    const api = own.figma;
    const row = api.createComponent();
    row.layoutMode = "HORIZONTAL";
    row.resize(100, 32);
    row.setBoundVariable("height", own.variable("Fuse density", "row-h"));
    api.combineAsVariants([row], api.currentPage);
    const badge = api.createComponent();
    badge.resize(23, 19);
    api.combineAsVariants([badge], api.currentPage);
    const item = api.createComponent();
    item.layoutMode = "VERTICAL";
    item.resize(200, 10);
    item.primaryAxisSizingMode = "AUTO";
    const rowInstance = row.createInstance();
    item.appendChild(rowInstance);
    rowInstance.layoutSizingHorizontal = "FILL";
    const placed = badge.createInstance();
    item.appendChild(placed);
    placed.layoutPositioning = "ABSOLUTE";
    placed.constraints = { horizontal: "MAX", vertical: "CENTER" };
    placed.x = 200 - 4 - 23;
    placed.y = 32 / 2 - 19 / 2;
    const [density] = await api.variables.getLocalVariableCollectionsAsync();
    return { api, badge, item, rowInstance, placed, density };
  }

  it("keeps the end inset as the instance widens and its parent widens (N11)", async () => {
    const { badge, item, placed } = await badgeInItem();
    expect([placed.x, placed.y]).toEqual([173, 6.5]);
    badge.resize(39, 19);
    expect([placed.x, placed.y]).toEqual([157, 6.5]);
    item.resize(240, item.height);
    item.primaryAxisSizingMode = "AUTO";
    expect([placed.x, placed.y]).toEqual([197, 6.5]);
  });

  // An instance takes its new size when read (rule 32, PI), so the row settles before the item.
  it("keeps the centre offset through a density switch (N11)", async () => {
    const { item, rowInstance, placed, density } = await badgeInItem();
    const comfortable = density?.modes[1]?.modeId ?? "";
    if (density === undefined) {
      throw new Error("the file holds no density collection");
    }
    item.setExplicitVariableModeForCollection(density, comfortable);
    expect([rowInstance.height, item.height, placed.y]).toEqual([36, 36, 8.5]);
  });

  // An instance lays out as its main does, so a padding the main takes later reaches it (N2, N11).
  it("hugs an outer instance with the layout its main holds now", async () => {
    const { item } = await badgeInItem();
    const outer = item.createInstance();
    expect(outer.height).toBe(32);
    item.paddingTop = 4;
    expect(outer.height).toBe(36);
  });

  // N11: an outer instance's badge followed the main's badge from 197 to 221 with no override.
  it("moves an outer instance's badge with the main's, as no override of its own", async () => {
    const { item, placed } = await badgeInItem();
    const outer = item.createInstance();
    const [, outerBadge] = outer.children;
    const inset = (badge: SceneNode | undefined) =>
      badge === undefined ? undefined : outer.width - badge.x - badge.width;
    expect(inset(outerBadge)).toBe(4);
    placed.x = 200 - 8 - 23;
    expect([inset(outerBadge), outer.overrides]).toEqual([8, []]);
  });

  it("lists `layoutPositioning` as the instance's override, and never its place or constraints (N11)", async () => {
    const { placed } = await badgeInItem();
    expect(placed.overrides).toEqual([{ id: placed.id, overriddenFields: ["layoutPositioning"] }]);
  });
});
