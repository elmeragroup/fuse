/**
 * The layout rules of the in-memory file in `fake-figma.ts`, each on a few nodes built by hand.
 * The oracle is what the test file `Elmera Fuse - Import test` read back in net-zero probes on
 * 2026-10-22, named P0 to P7 as the fake's header names them, and the typings where no probe ran.
 * The planners' tests converge against these rules, so a rule that drifts from the real file
 * would let a plan pass that Figma would not keep.
 */
import { describe, expect, it } from "vitest";

import { fixtureFile, float } from "./fake-fixtures.ts";

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
