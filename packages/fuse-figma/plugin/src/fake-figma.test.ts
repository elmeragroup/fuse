/**
 * The layout, text, image, property, rotation and stroke rules of the in-memory file in
 * `fake-figma.ts`, each on a few nodes built by hand. The oracle is what the test file `Elmera Fuse -
 * Import test` read back in net-zero probes on 2026-10-22, named P0 to P9b, PB, PR and PD as the
 * fake's header names them, the PNG signature, the hashes `shasum -a 1` gives the fixture images,
 * and the typings where no probe ran. The planners' tests converge against these rules, so a rule
 * that drifts from the real file would let a plan pass that Figma would not keep.
 */
import { describe, expect, it } from "vitest";

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

  it("keeps the fields behind the shorthand hidden, so the plugin writes only the shorthand", () => {
    const child = childOf(autoLayout("HORIZONTAL"));
    expect(() => child.layoutGrow).toThrow("does not model FrameNode.layoutGrow");
    expect(() => child.layoutAlign).toThrow("does not model FrameNode.layoutAlign");
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
