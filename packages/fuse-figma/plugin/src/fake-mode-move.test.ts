/**
 * A bound number in the in-memory file as the modes its layer reads change, rule 8 in
 * `fake/modes.ts`, and the lengths an instance lists as its own, rule 56 in `fake/layout.ts`. Unit
 * under test: the fake in `fake-figma.ts`. Oracle: the owner's readings of a live file through the
 * Plugin API on 2026-11-20 (FM1 and FM2 on #522), with a FLOAT variable 40 in Comfortable and 24 in
 * Dense. In FM1 a rectangle's width, an auto layout row's `paddingLeft` and `itemSpacing`, and a
 * component's width bound it, beside an instance of that component, in an unpinned frame. Moved
 * into a frame pinned to Dense, every bound number read 24, and the hugging row went from 100 to 68
 * wide. Moved back, they read 40, and pinning the unpinned frame to Dense gave 24 again. In FM2
 * `paddingLeft = 7` over a bound padding read 7 with no binding, and still 7 under the Dense frame,
 * and an instance whose width followed its main read 24 under Dense and 40 back, with no overrides
 * listed either time. The other cases hold the fake to FM1's finding that a bound number reads the
 * modes its layer reads now, on the paths the plugin takes: a sublayer an instance shows, a limit,
 * `combineAsVariants`, and a set moved to another page as `pages.ts` moves one. The fake has no
 * rectangle, so a frame takes its place, and the row's two 10-wide layers are this test's choice
 * that reproduces FM1's 100 and 68.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** A file whose one collection holds `space`, 40 in Comfortable, its default mode, and 24 in Dense. */
function densityFile() {
  return createFakeFigma({
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
}

/** The file's `space` variable and its collection's Dense mode, read through the API. */
async function spaceVariable(figma: PluginAPI) {
  const [collection] = await figma.variables.getLocalVariableCollectionsAsync();
  const [space] = await figma.variables.getLocalVariablesAsync("FLOAT");
  const dense = collection?.modes.find((mode) => mode.name === "Dense");
  if (collection === undefined || space === undefined || dense === undefined) {
    throw new Error("The file holds no Dense mode of a FLOAT variable.");
  }
  return { collection, space, dense: dense.modeId };
}

/** A file with `space`, an unpinned frame and a frame pinned to Dense. */
async function pinnedFile() {
  const { figma } = densityFile();
  const { collection, space, dense } = await spaceVariable(figma);
  const unpinned = figma.createFrame();
  const pinned = figma.createFrame();
  pinned.setExplicitVariableModeForCollection(collection, dense);
  return { figma, collection, space, dense, unpinned, pinned };
}

/** A horizontal auto layout component whose `itemSpacing` binds `space`. */
function spacedComponent(figma: PluginAPI, space: Variable) {
  const component = figma.createComponent();
  component.layoutMode = "HORIZONTAL";
  component.setBoundVariable("itemSpacing", space);
  return component;
}

/** A variant of a set made in `parent`, 10 × 10, for the fake to lay a hugging row out around (rule 32). */
function variantIn(figma: PluginAPI, parent: FrameNode) {
  const variant = figma.createComponent();
  variant.name = "size=sm";
  variant.resize(10, 10);
  figma.combineAsVariants([variant], parent);
  return variant;
}

/**
 * A component that hugs a horizontal row of two 10-wide variant instances, its gap, left padding and
 * corners bound to `space`, holding beside them a frame that binds the same three.
 */
function hugging(figma: PluginAPI, space: Variable, parent: FrameNode) {
  const variant = variantIn(figma, parent);
  const component = spacedComponent(figma, space);
  component.primaryAxisSizingMode = "AUTO";
  component.setBoundVariable("paddingLeft", space);
  component.setBoundVariable("cornerRadius", space);
  component.appendChild(variant.createInstance());
  component.appendChild(variant.createInstance());
  const inner = figma.createFrame();
  inner.layoutMode = "HORIZONTAL";
  component.appendChild(inner);
  inner.layoutPositioning = "ABSOLUTE";
  inner.setBoundVariable("itemSpacing", space);
  inner.setBoundVariable("paddingLeft", space);
  inner.setBoundVariable("cornerRadius", space);
  parent.appendChild(component);
  return component;
}

/** The gap, left padding and corner a frame-like layer shows. */
function spacing(layer: SceneNode | undefined) {
  return layer !== undefined && "itemSpacing" in layer
    ? { gap: layer.itemSpacing, padding: layer.paddingLeft, radius: layer.cornerRadius }
    : undefined;
}

/**
 * FM1's layers in an unpinned frame, `space` bound on each, and a frame beside it pinned to Dense.
 * The row's two 10-wide layers are instances of a set's variant, the one kind of layer the fake
 * lays out a hugging row around (rule 32).
 */
async function boundLayers() {
  const { figma, collection, space, dense, unpinned, pinned } = await pinnedFile();

  const box = figma.createFrame();
  box.setBoundVariable("width", space);
  const variant = figma.createComponent();
  variant.name = "size=sm";
  variant.resize(10, 10);
  figma.combineAsVariants([variant], unpinned);
  const row = figma.createFrame();
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.appendChild(variant.createInstance());
  row.appendChild(variant.createInstance());
  row.setBoundVariable("paddingLeft", space);
  row.setBoundVariable("itemSpacing", space);
  const component = figma.createComponent();
  component.setBoundVariable("width", space);
  const instance = component.createInstance();
  const moved = [box, row, component, instance];
  for (const layer of moved) {
    unpinned.appendChild(layer);
  }

  const readBound = () => ({
    box: box.width,
    padding: row.paddingLeft,
    gap: row.itemSpacing,
    row: row.width,
    component: component.width,
    instance: instance.width,
  });
  const moveInto = (frame: FrameNode) => {
    for (const layer of moved) {
      frame.appendChild(layer);
    }
  };
  const pin = () => unpinned.setExplicitVariableModeForCollection(collection, dense);
  return { unpinned, pinned, readBound, moveInto, pin };
}

const COMFORTABLE = { box: 40, padding: 40, gap: 40, row: 100, component: 40, instance: 40 };
const DENSE = { box: 24, padding: 24, gap: 24, row: 68, component: 24, instance: 24 };

describe("a bound number as its layer's modes change", () => {
  it("reads the pinned mode's value once its layer moves under the pin, and the default once back", async () => {
    const { unpinned, pinned, readBound, moveInto } = await boundLayers();
    const before = readBound();
    moveInto(pinned);
    const under = readBound();
    moveInto(unpinned);
    expect({ before, under, back: readBound() }).toEqual({
      before: COMFORTABLE,
      under: DENSE,
      back: COMFORTABLE,
    });
  });

  it("reads the pinned mode's value once a frame above it pins that mode", async () => {
    const { readBound, pin } = await boundLayers();
    const before = readBound();
    pin();
    expect({ before, pinned: readBound() }).toEqual({ before: COMFORTABLE, pinned: DENSE });
  });

  it("reads a sublayer's bound gap in its instance's modes, whether or not it was read before the move", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const component = figma.createComponent();
    const row = figma.createFrame();
    component.appendChild(row);
    row.layoutMode = "HORIZONTAL";
    row.setBoundVariable("itemSpacing", space);
    const [readFirst, readAfter] = [component.createInstance(), component.createInstance()];
    unpinned.appendChild(component);
    unpinned.appendChild(readFirst);
    unpinned.appendChild(readAfter);
    const gapOf = (instance: InstanceNode) => {
      const [row] = instance.children;
      return row !== undefined && "itemSpacing" in row ? row.itemSpacing : undefined;
    };
    gapOf(readFirst);
    pinned.appendChild(readFirst);
    pinned.appendChild(readAfter);
    expect([gapOf(readFirst), gapOf(readAfter)]).toEqual([24, 24]);
  });

  it("stores a bound minimum width under its new parent's modes, where a written one would be refused", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    unpinned.layoutMode = "VERTICAL";
    const box = figma.createFrame();
    unpinned.appendChild(box);
    box.setBoundVariable("minWidth", space);
    pinned.appendChild(box);
    expect(box.minWidth).toBe(24);
  });

  it("keeps a literal written over a bound padding, unbound, through a reorder and a move", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const row = figma.createFrame();
    unpinned.appendChild(row);
    unpinned.appendChild(figma.createFrame());
    row.layoutMode = "HORIZONTAL";
    row.setBoundVariable("paddingLeft", space);
    const bound = row.paddingLeft;
    row.paddingLeft = 7;
    unpinned.insertChild(1, row);
    const reordered = row.paddingLeft;
    pinned.appendChild(row);
    expect({ bound, reordered, moved: row.paddingLeft, binding: row.boundVariables?.paddingLeft }).toEqual({
      bound: 40,
      reordered: 7,
      moved: 7,
      binding: undefined,
    });
  });

  it("reads a bound gap in the modes of the frame combineAsVariants puts its set in", async () => {
    const { figma, space, pinned } = await pinnedFile();
    const variant = spacedComponent(figma, space);
    variant.name = "size=sm";
    figma.combineAsVariants([variant], pinned);
    expect(variant.itemSpacing).toBe(24);
  });

  it("lists no length of an instance whose width follows its bound main under a pin and back", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const component = figma.createComponent();
    component.setBoundVariable("width", space);
    const instance = component.createInstance();
    unpinned.appendChild(component);
    unpinned.appendChild(instance);
    const read = () => ({ width: instance.width, overrides: instance.overrides });
    pinned.appendChild(instance);
    const under = read();
    unpinned.appendChild(instance);
    expect({ under, back: read() }).toEqual({
      under: { width: 24, overrides: [] },
      back: { width: 40, overrides: [] },
    });
  });

  it("reads a set's bound gap and hug width in the modes of the page it moves to", async () => {
    const { figma, collection, space, dense, unpinned } = await pinnedFile();
    const variant = figma.createComponent();
    variant.name = "size=sm";
    variant.resize(10, 10);
    figma.combineAsVariants([variant], unpinned);
    const row = spacedComponent(figma, space);
    row.name = "kind=row";
    row.primaryAxisSizingMode = "AUTO";
    row.appendChild(variant.createInstance());
    row.appendChild(variant.createInstance());
    const set = figma.combineAsVariants([row], figma.currentPage);
    const before = { gap: row.itemSpacing, width: row.width };
    const page = figma.createPage();
    page.setExplicitVariableModeForCollection(collection, dense);
    await page.loadAsync();
    page.appendChild(set);
    expect({ before, after: { gap: row.itemSpacing, width: row.width } }).toEqual({
      before: { gap: 40, width: 60 },
      after: { gap: 24, width: 44 },
    });
  });

  it.each(["row first", "instances first"])(
    "hugs a row of instances whose main binds its width by their lengths under the pin, reading the %s",
    async (order) => {
      const { figma, space, unpinned, pinned } = await pinnedFile();
      const variant = variantIn(figma, unpinned);
      variant.setBoundVariable("width", space);
      const row = spacedComponent(figma, space);
      row.primaryAxisSizingMode = "AUTO";
      const instances = [variant.createInstance(), variant.createInstance()];
      for (const instance of instances) {
        row.appendChild(instance);
      }
      unpinned.appendChild(row);
      pinned.appendChild(row);
      const width = order === "row first" ? row.width : undefined;
      const lengths = instances.map((instance) => instance.width);
      expect({ width: width ?? row.width, lengths }).toEqual({ width: 72, lengths: [24, 24] });
    }
  );

  it("reads an instance's bound numbers, its sublayer's and its hug width in its own modes, apart from its main's", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const component = hugging(figma, space, unpinned);
    const instance = component.createInstance();
    pinned.appendChild(instance);
    expect({
      instance: { ...spacing(instance), width: instance.width },
      sublayer: spacing(instance.children[2]),
      main: { ...spacing(component), width: component.width },
    }).toEqual({
      instance: { gap: 24, padding: 24, radius: 24, width: 68 },
      sublayer: { gap: 24, padding: 24, radius: 24 },
      main: { gap: 40, padding: 40, radius: 40, width: 100 },
    });
  });

  it("keeps a sublayer's corner written equal to its bound main's as its own, unbound, under a pin", async () => {
    const { figma, space, unpinned, pinned } = await pinnedFile();
    const instance = hugging(figma, space, unpinned).createInstance();
    unpinned.appendChild(instance);
    const sublayer = instance.children[2];
    if (sublayer?.type !== "FRAME") {
      throw new Error("The instance shows no frame sublayer.");
    }
    sublayer.cornerRadius = 40;
    pinned.appendChild(instance);
    expect({
      radius: sublayer.cornerRadius,
      binding: sublayer.boundVariables?.topLeftRadius,
      listed: instance.overrides
        .find((entry) => entry.id === sublayer.id)
        ?.overriddenFields.includes("cornerRadius"),
    }).toEqual({ radius: 40, binding: undefined, listed: true });
  });

  it("reads a removed component's bound gap in the default modes", async () => {
    const { figma, space, pinned } = await pinnedFile();
    const component = spacedComponent(figma, space);
    pinned.appendChild(component);
    const under = component.itemSpacing;
    component.remove();
    expect({ under, removed: component.itemSpacing }).toEqual({ under: 24, removed: 40 });
  });

  it("lists the collection an instance's sublayer reads through its main layer's binding", async () => {
    const { figma, collection, space, unpinned } = await pinnedFile();
    const component = figma.createComponent();
    const row = figma.createFrame();
    component.appendChild(row);
    row.layoutMode = "HORIZONTAL";
    row.setBoundVariable("itemSpacing", space);
    const instance = component.createInstance();
    unpinned.appendChild(instance);
    expect(Object.keys(instance.resolvedVariableModes)).toEqual([collection.id]);
  });
});
