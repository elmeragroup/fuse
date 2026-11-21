/**
 * Which layer owns a bound number in the in-memory file, and what a layer measures from the numbers
 * its modes give, rule 8 in `fake/modes.ts` with rules 37, 38, 49 and 64. Unit under test: the fake in
 * `fake-figma.ts`. Oracles: FM1 and FM2 on #522, read through the Plugin API on 2026-11-20 with a
 * FLOAT variable 40 in Comfortable and 24 in Dense, where a bound number read the modes of its layer
 * and a literal write unbound it, and FM3, where an instance that bound its main's own variable kept
 * that binding as its own, listed, after the main took a literal. The first 0 written to one side of a stroke never
 * written sets every side (rule 49, PS2). The typings' `removeOverrides` "removes all direct
 * overrides", and a reset padding follows its source again (rule 64). A wrapping
 * row breaks its layers into rows of the width it is given, and a FLEX column takes the grid's width
 * (rules 32 and 61, PG9). An unread instance keeps its last settled size after a literal edit to its
 * main, and its hugging parent sizes from it (rule 32, PI).
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** A file with `space`, 40 in Comfortable, its default mode, and 24 in Dense, an unpinned frame and a frame pinned to Dense. */
async function pinnedFile() {
  const { figma } = createFakeFigma({
    collections: [
      {
        name: "Fuse density",
        modes: ["Comfortable", "Dense"],
        variables: [
          {
            name: "space",
            type: "FLOAT",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([
              ["Comfortable", { _tag: "Float", value: 40 }],
              ["Dense", { _tag: "Float", value: 24 }],
            ]),
          },
        ],
      },
    ],
  });
  const [collection] = await figma.variables.getLocalVariableCollectionsAsync();
  const [space] = await figma.variables.getLocalVariablesAsync("FLOAT");
  const dense = collection?.modes.find((mode) => mode.name === "Dense");
  if (collection === undefined || space === undefined || dense === undefined) {
    throw new Error("The file holds no Dense mode of a FLOAT variable.");
  }
  const unpinned = figma.createFrame();
  const pinned = figma.createFrame();
  pinned.setExplicitVariableModeForCollection(collection, dense.modeId);
  return { figma, space, unpinned, pinned };
}

/** A component in `parent` holding one auto layout frame, and an instance of it in `place`. */
function framedInstance(figma: PluginAPI, parent: FrameNode, place: FrameNode) {
  const component = figma.createComponent();
  const inner = figma.createFrame();
  component.appendChild(inner);
  inner.layoutMode = "HORIZONTAL";
  parent.appendChild(component);
  const instance = component.createInstance();
  place.appendChild(instance);
  const sublayer = (): FrameNode => {
    const [layer] = instance.children;
    if (layer?.type !== "FRAME") {
      throw new Error("The instance shows no frame sublayer.");
    }
    return layer;
  };
  return { component, inner, instance, sublayer };
}

/** A variant of a set made in `parent`, `width` × 10. */
function variantIn(figma: PluginAPI, parent: FrameNode, name: string, width: number) {
  const variant = figma.createComponent();
  variant.name = name;
  variant.resize(width, 10);
  figma.combineAsVariants([variant], parent);
  return variant;
}

describe("a bound number's owner", () => {
  it.each([
    ["topLeftRadius", "topLeftRadius", ["topLeftRadius"]],
    ["itemSpacing", "itemSpacing", ["itemSpacing"]],
    [
      "strokeWeight",
      "strokeTopWeight",
      ["strokeWeight", "stokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"],
    ],
    ["paddingLeft", "paddingLeft", ["paddingLeft"]],
  ] as const)(
    "keeps an instance's %s bound to its main's variable as its own, listed, after the main's literal",
    async (field, target, names) => {
      const { figma, space, unpinned } = await pinnedFile();
      const component = figma.createComponent();
      component.layoutMode = "HORIZONTAL";
      component.setBoundVariable(field, space);
      unpinned.appendChild(component);
      const instance = component.createInstance();
      unpinned.appendChild(instance);
      instance[field] = 7;
      instance.setBoundVariable(field, space);
      component[field] = 6;
      const listed = instance.overrides.find((entry) => entry.id === instance.id)?.overriddenFields ?? [];
      expect({
        value: instance[target],
        binding: instance.boundVariables?.[target]?.id,
        listed: [...names, "boundVariables"].filter((name) =>
          listed.some((listedField) => listedField === name)
        ),
      }).toEqual({ value: 40, binding: space.id, listed: [...names, "boundVariables"] });
    }
  );

  /** FM3's hugging row, a stroke around two 10px children, its gap bound, and an instance beside it. */
  async function fm3Row(children: "variant instances" | "fixed frames") {
    const { figma, space, unpinned } = await pinnedFile();
    const leaf = variantIn(figma, unpinned, "size=sm", 10);
    const row = figma.createComponent();
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "AUTO";
    row.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    for (const _ of [0, 1]) {
      const child = children === "variant instances" ? leaf.createInstance() : figma.createFrame();
      child.resize(10, 10);
      row.appendChild(child);
    }
    row.setBoundVariable("itemSpacing", space);
    unpinned.appendChild(row);
    const instance = row.createInstance();
    unpinned.appendChild(instance);
    const listed = () => {
      const fields = instance.overrides.find((entry) => entry.id === instance.id)?.overriddenFields ?? [];
      return (["itemSpacing", "boundVariables", "width", "height"] as const).filter((name) =>
        fields.some((listedField) => listedField === name)
      );
    };
    return { space, instance, listed };
  }

  it.each(["variant instances", "fixed frames"] as const)(
    "lists a hugging instance's width and height once a gap it writes changes its size, around %s",
    async (children) => {
      const { instance, listed } = await fm3Row(children);
      instance.itemSpacing = 7;
      expect(listed()).toEqual(["itemSpacing", "boundVariables", "width", "height"]);
    }
  );

  it("hugs its own gap and its rebound one in the mode it shares with its main, holding neither", async () => {
    const { space, instance } = await fm3Row("variant instances");
    const before = instance.width;
    instance.itemSpacing = 7;
    const written = instance.width;
    instance.setBoundVariable("itemSpacing", space);
    // The fake includes the stroke in the layout (rule 57), 1px a side.
    expect([before, written, instance.width]).toEqual([62, 29, 62]);
  });

  it("claims no length for a resize Figma refuses", async () => {
    const { figma, unpinned } = await pinnedFile();
    const { inner, instance, sublayer } = framedInstance(figma, unpinned, unpinned);
    expect(() => sublayer().resize(0, 10)).toThrow();
    expect(() => instance.resize(0, 10)).toThrow();
    inner.resize(30, inner.height);
    expect({ sublayer: sublayer().width, overrides: instance.overrides }).toEqual({
      sublayer: 30,
      overrides: [],
    });
  });

  it("keeps a sublayer's inherited height binding when it binds its own width", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const { inner, sublayer } = framedInstance(figma, unpinned, pinned);
    inner.setBoundVariable("width", space);
    inner.setBoundVariable("height", space);
    sublayer().setBoundVariable("width", space);
    expect({ height: sublayer().height, binding: sublayer().boundVariables?.height?.id }).toEqual({
      height: 24,
      binding: space.id,
    });
  });

  it("keeps a minimum width its main cleared null when an instance unbinds it", async () => {
    const { figma, unpinned } = await pinnedFile();
    const component = figma.createComponent();
    component.layoutMode = "HORIZONTAL";
    component.minWidth = 10;
    unpinned.appendChild(component);
    const instance = component.createInstance();
    unpinned.appendChild(instance);
    component.minWidth = null;
    const cleared = instance.minWidth;
    instance.setBoundVariable("minWidth", null);
    expect({ cleared, unbound: instance.minWidth }).toEqual({ cleared: null, unbound: null });
  });

  it("keeps a sublayer's other corners when one rebinds to the variable it showed", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const { inner, sublayer } = framedInstance(figma, unpinned, pinned);
    inner.setBoundVariable("cornerRadius", space);
    sublayer().setBoundVariable("topLeftRadius", space);
    expect({
      topRight: sublayer().topRightRadius,
      bound: sublayer().boundVariables?.topRightRadius?.id,
    }).toEqual({ topRight: 24, bound: space.id });
  });

  it("keeps an instance's unbound stroke side and its other sides' binding back in its main's modes", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const component = figma.createComponent();
    component.setBoundVariable("strokeWeight", space);
    unpinned.appendChild(component);
    const instance = component.createInstance();
    pinned.appendChild(instance);
    instance.setBoundVariable("strokeTopWeight", null);
    unpinned.appendChild(instance);
    expect({
      top: instance.strokeTopWeight,
      topBound: instance.boundVariables?.strokeTopWeight,
      bottom: instance.strokeBottomWeight,
      bottomBound: instance.boundVariables?.strokeBottomWeight?.id,
    }).toEqual({ top: 24, topBound: undefined, bottom: 40, bottomBound: space.id });
  });

  it.each(["frame", "instance"] as const)(
    "keeps the width a moved %s showed once it unbinds it",
    async (kind) => {
      const { figma, space, unpinned, pinned } = await pinnedFile();
      const box = kind === "frame" ? figma.createFrame() : figma.createComponent().createInstance();
      unpinned.appendChild(box);
      box.setBoundVariable("width", space);
      pinned.appendChild(box);
      const bound = box.width;
      box.setBoundVariable("width", null);
      expect({ bound, width: box.width, binding: box.boundVariables?.width }).toEqual({
        bound: 24,
        width: 24,
        binding: undefined,
      });
    }
  );

  it.each(["read first", "unread"] as const)(
    "keeps the laid-out width of a moved hugging instance it unbinds, %s",
    async (order) => {
      const { figma, space, unpinned, pinned } = await pinnedFile();
      const leaf = variantIn(figma, unpinned, "size=sm", 10);
      const variant = variantIn(figma, unpinned, "kind=row", 10);
      variant.layoutMode = "HORIZONTAL";
      variant.primaryAxisSizingMode = "AUTO";
      variant.appendChild(leaf.createInstance());
      variant.setBoundVariable("paddingLeft", space);
      const instance = variant.createInstance();
      unpinned.appendChild(instance);
      const comfortable = instance.width;
      // A width binding keeps a hugging instance's hug length (rule 40).
      instance.setBoundVariable("width", space);
      pinned.appendChild(instance);
      const before = order === "read first" ? instance.width : 34;
      instance.setBoundVariable("width", null);
      expect({ comfortable, before, after: instance.width }).toEqual({
        comfortable: 50,
        before: 34,
        after: 34,
      });
    }
  );

  it("shows its source's bound number again on a sublayer after removeOverrides", async () => {
    const { figma, space, unpinned } = await pinnedFile();
    const { inner, instance, sublayer } = framedInstance(figma, unpinned, unpinned);
    inner.setBoundVariable("itemSpacing", space);
    sublayer().itemSpacing = 7;
    instance.removeOverrides();
    expect({ gap: sublayer().itemSpacing, binding: sublayer().boundVariables?.itemSpacing?.id }).toEqual({
      gap: 40,
      binding: space.id,
    });
  });

  it("unbinds every side the first 0 spills to", async () => {
    const { figma, space } = await pinnedFile();
    const frame = figma.createFrame();
    frame.setBoundVariable("strokeLeftWeight", space);
    frame.strokeTopWeight = 0;
    expect({ left: frame.strokeLeftWeight, binding: frame.boundVariables?.strokeLeftWeight }).toEqual({
      left: 0,
      binding: undefined,
    });
  });
});

describe("a measure from the numbers a layer's modes give", () => {
  it.each(["parent", "child"])(
    "hugs a variant instance by its own bound padding under a pin, reading the %s first",
    async (first) => {
      const { figma, space, unpinned, pinned } = await pinnedFile();
      const leaf = variantIn(figma, unpinned, "size=sm", 10);
      const variant = variantIn(figma, unpinned, "kind=row", 10);
      variant.layoutMode = "HORIZONTAL";
      variant.primaryAxisSizingMode = "AUTO";
      variant.appendChild(leaf.createInstance());
      variant.setBoundVariable("paddingLeft", space);
      const parent = figma.createFrame();
      parent.layoutMode = "HORIZONTAL";
      parent.primaryAxisSizingMode = "AUTO";
      const child = variant.createInstance();
      parent.appendChild(child);
      unpinned.appendChild(parent);
      const before = parent.width;
      pinned.appendChild(parent);
      const reads =
        first === "parent" ? [parent.width, child.width, parent.width] : [child.width, parent.width];
      expect({ before, reads }).toEqual({ before: 50, reads: reads.map(() => 34) });
    }
  );

  it("keeps an unread instance's settled hug after a literal edit to its main until it is read", async () => {
    const { figma, unpinned } = await pinnedFile();
    const leaf = variantIn(figma, unpinned, "size=sm", 10);
    const variant = variantIn(figma, unpinned, "kind=row", 10);
    variant.layoutMode = "HORIZONTAL";
    variant.primaryAxisSizingMode = "AUTO";
    variant.appendChild(leaf.createInstance());
    const parent = figma.createFrame();
    parent.layoutMode = "HORIZONTAL";
    parent.primaryAxisSizingMode = "AUTO";
    const child = variant.createInstance();
    parent.appendChild(child);
    unpinned.appendChild(parent);
    const settledWidth = child.width;
    variant.paddingLeft = 20;
    const stale = parent.width;
    const read = child.width;
    expect({ settledWidth, stale, read, parent: parent.width }).toEqual({
      settledWidth: 10,
      stale: 10,
      read: 30,
      parent: 30,
    });
  });

  it("hugs an instance's sublayer around its nested instances in the instance's modes", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const leaf = variantIn(figma, unpinned, "size=sm", 10);
    const component = figma.createComponent();
    const strip = figma.createFrame();
    component.appendChild(strip);
    strip.layoutMode = "HORIZONTAL";
    strip.primaryAxisSizingMode = "AUTO";
    strip.appendChild(leaf.createInstance());
    strip.setBoundVariable("paddingLeft", space);
    unpinned.appendChild(component);
    const instance = component.createInstance();
    pinned.appendChild(instance);
    const [sublayer] = instance.children;
    expect({ main: strip.width, sublayer: sublayer?.width }).toEqual({ main: 50, sublayer: 34 });
  });

  it("wraps a row that fills a FLEX column at the width the column gives it", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const grid = figma.createFrame();
    grid.layoutMode = "GRID";
    grid.gridItemsPositioning = "ROW_AUTO_FLOW";
    grid.gridColumnCount = 1;
    grid.gridRowCount = 1;
    grid.gridColumnSizes = [{ type: "FLEX", value: 1 }];
    grid.gridRowSizes = [{ type: "HUG" }];
    const row = figma.createFrame();
    grid.appendChild(row);
    row.layoutMode = "HORIZONTAL";
    row.layoutWrap = "WRAP";
    for (const _ of [0, 1]) {
      const box = figma.createFrame();
      box.resize(16, 10);
      row.appendChild(box);
    }
    row.layoutSizingHorizontal = "FILL";
    row.counterAxisSizingMode = "AUTO";
    unpinned.appendChild(grid);
    grid.setBoundVariable("width", space);
    const before = row.height;
    pinned.appendChild(grid);
    expect({ before, width: row.width, height: row.height }).toEqual({ before: 10, width: 24, height: 20 });
  });

  it("keeps an unread instance's size from before a resize of its main, measured first by its parent", async () => {
    const { figma, unpinned } = await pinnedFile();
    const variant = variantIn(figma, unpinned, "size=sm", 10);
    const row = figma.createFrame();
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "AUTO";
    row.appendChild(variant.createInstance());
    unpinned.appendChild(row);
    variant.resize(20, 10);
    expect(row.width).toBe(10);
  });

  it("keeps an unread instance's first measured hug after a literal edit to its main", async () => {
    const { figma, unpinned } = await pinnedFile();
    const leaf = variantIn(figma, unpinned, "size=sm", 10);
    const variant = variantIn(figma, unpinned, "kind=row", 10);
    variant.layoutMode = "HORIZONTAL";
    variant.primaryAxisSizingMode = "AUTO";
    variant.appendChild(leaf.createInstance());
    const parent = figma.createFrame();
    parent.layoutMode = "HORIZONTAL";
    parent.primaryAxisSizingMode = "AUTO";
    parent.appendChild(variant.createInstance());
    unpinned.appendChild(parent);
    const first = parent.width;
    variant.paddingLeft = 20;
    expect([first, parent.width]).toEqual([10, 10]);
  });

  it("hugs a nested instance in the modes of the instance that shows it", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const leaf = variantIn(figma, unpinned, "size=sm", 10);
    const variant = variantIn(figma, unpinned, "kind=row", 10);
    variant.layoutMode = "HORIZONTAL";
    variant.primaryAxisSizingMode = "AUTO";
    variant.appendChild(leaf.createInstance());
    variant.setBoundVariable("paddingLeft", space);
    const component = figma.createComponent();
    component.appendChild(variant.createInstance());
    unpinned.appendChild(component);
    const instance = component.createInstance();
    pinned.appendChild(instance);
    const [nested] = instance.children;
    expect(nested?.width).toBe(34);
  });

  it("shares a nested grid's FLEX space out of the width its outer column gives it", async () => {
    const { figma } = await pinnedFile();
    const oneFlexColumn = (frame: FrameNode) => {
      frame.layoutMode = "GRID";
      frame.gridItemsPositioning = "ROW_AUTO_FLOW";
      frame.gridColumnCount = 1;
      frame.gridRowCount = 1;
      frame.gridColumnSizes = [{ type: "FLEX", value: 1 }];
      frame.gridRowSizes = [{ type: "HUG" }];
    };
    const outer = figma.createFrame();
    oneFlexColumn(outer);
    outer.resize(24, 20);
    const inner = figma.createFrame();
    outer.appendChild(inner);
    oneFlexColumn(inner);
    inner.resize(100, 20);
    inner.layoutSizingHorizontal = "FILL";
    const filling = figma.createFrame();
    inner.appendChild(filling);
    filling.layoutSizingHorizontal = "FILL";
    expect({ inner: inner.width, filling: filling.width }).toEqual({ inner: 24, filling: 24 });
  });

  it("follows a main layer's width as it stands once the main layer unbinds it", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const { inner, sublayer } = framedInstance(figma, unpinned, pinned);
    inner.setBoundVariable("width", space);
    const bound = sublayer().width;
    inner.setBoundVariable("width", null);
    inner.resize(30, inner.height);
    expect({ bound, width: sublayer().width, binding: sublayer().boundVariables?.width }).toEqual({
      bound: 24,
      width: 30,
      binding: undefined,
    });
  });

  it("wraps a row into the width its modes give", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const row = figma.createFrame();
    row.layoutMode = "HORIZONTAL";
    row.layoutWrap = "WRAP";
    for (const _ of [0, 1]) {
      const box = figma.createFrame();
      box.resize(16, 10);
      row.appendChild(box);
    }
    unpinned.appendChild(row);
    row.setBoundVariable("width", space);
    // A width binding fixes both axes (rule 5), so the row hugs its height once bound.
    row.counterAxisSizingMode = "AUTO";
    const before = row.height;
    pinned.appendChild(row);
    expect({ before, width: row.width, height: row.height }).toEqual({ before: 10, width: 24, height: 20 });
  });

  it("fills a FLEX column of the width its grid's modes give", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const grid = figma.createFrame();
    grid.layoutMode = "GRID";
    grid.gridItemsPositioning = "ROW_AUTO_FLOW";
    grid.gridColumnCount = 1;
    grid.gridRowCount = 1;
    grid.gridColumnSizes = [{ type: "FLEX", value: 1 }];
    grid.gridRowSizes = [{ type: "HUG" }];
    const filling = figma.createFrame();
    grid.appendChild(filling);
    filling.layoutSizingHorizontal = "FILL";
    unpinned.appendChild(grid);
    grid.setBoundVariable("width", space);
    const before = filling.width;
    pinned.appendChild(grid);
    expect({ before, grid: grid.width, filling: filling.width }).toEqual({
      before: 40,
      grid: 24,
      filling: 24,
    });
  });
});
