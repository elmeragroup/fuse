/**
 * The layers a file the plugin applied the whole kit to places by their distances to their parent's
 * edges, on the in-memory file in `fake-figma.ts`. Unit under test: `planLeaving` and `planPlace`
 * through Apply and Plan. Oracles, written by hand from the Timeline list's CSS: an item's dot sits
 * 0px from its left and 8px from its top (`absolute top-2 left-0`), and its connector 4px from its
 * left, from 32px below its top to 32px past its bottom (`before:top-8 before:left-[4px]
 * before:h-full`), so it is as tall as the item; MIN keeps a start distance, STRETCH both; and both
 * paint over the item's text, after it, as CSS paints positioned boxes (CSS 2.1 Appendix E). The fake
 * lays out no hugging frame, so an item stays 100px tall, its height before the kit's first write.
 * Dialog's and Sheet's corner closes keep 16px from their popup's right and top in every preview,
 * Toast's close 8px from the toast's, and a placement wrapper still hugs its height after Apply;
 * their oracles sit beside them.
 */
import { describe, expect, it } from "vitest";

import type { ChildLayerSpec, KitSpec } from "../../src/components/kit-spec.ts";
import { createFakeFigma } from "./fake-figma.ts";
import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** A layer below a node by its keys, one level at a time. */
function below(node: BaseNode, ...keys: readonly string[]): FrameNode {
  let found: BaseNode = node;
  for (const key of keys) {
    const next = "children" in found ? found.children.find((child) => keyOf(child) === key) : undefined;
    if (next === undefined) {
      throw new Error(`${found.name} holds no layer ${key}`);
    }
    found = next;
  }
  if (found.type !== "FRAME") {
    throw new Error(`${found.name} is no frame`);
  }
  return found;
}

describe("a timeline item's dot and connector", () => {
  it("sit where their distances to the item's edges put them, absolute and constrained", async () => {
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/timeline-list"), "Timeline list");
    const item = below(set, "timeline-list/state=rest", "item-1", "box");
    const dot = below(item, "dot");
    const line = below(item, "::before");
    expect([dot.layoutPositioning, dot.constraints, dot.x, dot.y]).toEqual([
      "ABSOLUTE",
      { horizontal: "MIN", vertical: "MIN" },
      0,
      8,
    ]);
    expect([line.layoutPositioning, line.constraints, line.x, line.y]).toEqual([
      "ABSOLUTE",
      { horizontal: "MIN", vertical: "STRETCH" },
      4,
      32,
    ]);
    expect(item.children.map((child) => keyOf(child))).toEqual([
      "title",
      "time",
      "description",
      "::before",
      "dot",
    ]);
  });

  it("takes the item's height again where a designer resized the connector", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/timeline-list"), "Timeline list");
    const item = below(set, "timeline-list/state=rest", "item-1", "box");
    below(item, "::before").resize(1, 5);
    file.reopen();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect([item.height, below(item, "::before").height]).toEqual([100, 100]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it("go back where they sit when a designer moves one", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/timeline-list"), "Timeline list");
    const line = below(set, "timeline-list/state=rest", "item-2", "box", "::before");
    line.x = 0;
    line.y = 0;
    file.reopen();
    const changes = (await reconcileKit(file.figma, kit, false)).changes;
    expect(changes.filter((change) => change.includes("::before"))).toEqual([
      "Timeline list / state=rest / timeline-list-item / box / ::before: place → 4px from the left, 32px from the top to -32px from the bottom",
    ]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});

/** Every layer at or below a node, depth first. */
function layersOf(node: BaseNode): readonly BaseNode[] {
  return [node, ...("children" in node ? node.children.flatMap(layersOf) : [])];
}

/** Whether a layer and every layer above it, up to its page, is visible. */
function shown(node: BaseNode): boolean {
  for (let each: BaseNode | null = node; each !== null && each.type !== "PAGE"; each = each.parent) {
    if ("visible" in each && !each.visible) {
      return false;
    }
  }
  return true;
}

/**
 * Each shown instance below a page's preview frames whose key is `key`, with the box it is placed in: the
 * nearest layer above it that sits in its own parent's flow, so a placement wrapper is passed over.
 */
function placedInPreviews(page: PageNode, key: string): readonly { part: SceneNode; holder: SceneNode }[] {
  const previews = page.children.filter((node) => keyOf(node).startsWith("preview/"));
  return previews.flatMap(layersOf).flatMap((part) => {
    if (keyOf(part) !== key || part.type !== "INSTANCE" || !part.visible) {
      return [];
    }
    let holder = part.parent;
    while (holder !== null && "layoutPositioning" in holder && holder.layoutPositioning === "ABSOLUTE") {
      holder = holder.parent;
    }
    return holder !== null && holder.type !== "PAGE" && holder.type !== "DOCUMENT" ? [{ part, holder }] : [];
  });
}

/** A layer's distances to the right and top edges of a box above it, read through each layer's place. */
function insets(part: SceneNode, holder: SceneNode) {
  let x = 0;
  let y = 0;
  for (let node: BaseNode | null = part; node !== null && node !== holder; node = node.parent) {
    if (!("x" in node)) {
      throw new Error(`${part.name} sits in no box below ${holder.name}`);
    }
    x += node.x;
    y += node.y;
  }
  return { right: holder.width - x - part.width, top: y };
}

describe("an overlay's corner close", () => {
  // Oracle: CSS 2.1 §10.3.7 keeps a box's declared `right` whatever its width, so Dialog's and
  // Sheet's `absolute top-4 right-4` closes sit 16px inside the popup's right and top edges in every
  // density. The fake reads a placed layer in an instance as PG14b found it and a placement wrapper's
  // layer as PG16 found it (rules 63 and 64). The branded previews pin Comfortable, where the close's
  // `control-h-sm` is longer than in the mains' Dense.
  it.each([
    ["page/dialog", "close"],
    ["page/sheet", "corner-close"],
  ])("on %s sits 16px from the popup's right and top in every preview", async (page, key) => {
    const file = await appliedFile();
    const placed = placedInPreviews(await kitPage(file, page), key);
    expect(placed.length).toBeGreaterThan(0);
    const widths = new Set(placed.map(({ part }) => part.width));
    expect(widths.size).toBeGreaterThan(1);
    expect(placed.map(({ part, holder }) => insets(part, holder))).toEqual(
      placed.map(() => ({ right: 16, top: 16 }))
    );
  });

  // Oracle: Toast's `absolute top-2 right-2` close takes the toast's root as its containing block
  // (CSS 2.1 §10.1), so it sits 8px inside the root's right and top edges in every density, however
  // the frames between draw. The toast is the instance of a status variant that each preview holds,
  // and it shows one close.
  it("on page/toast sits 8px from the toast's right and top in every preview", async () => {
    const file = await appliedFile();
    const page = await kitPage(file, "page/toast");
    const toasts = page.children
      .filter((node) => keyOf(node).startsWith("preview/"))
      .flatMap(layersOf)
      .flatMap((node) =>
        node.type === "INSTANCE" && /\/toast\/status=[a-z]+$/.test(keyOf(node)) ? [node] : []
      );
    const held = toasts.map((toast) => ({
      toast,
      closes: layersOf(toast).flatMap((part) =>
        keyOf(part) === "close" && part.type === "INSTANCE" && shown(part) ? [part] : []
      ),
    }));
    expect([held.length > 0, held.map(({ closes }) => closes.length)]).toEqual([true, held.map(() => 1)]);
    const placed = held.flatMap(({ toast, closes: [part] }) => (part === undefined ? [] : [{ part, toast }]));
    expect(new Set(placed.map(({ part }) => part.width)).size).toBeGreaterThan(1);
    expect(placed.map(({ part, toast }) => insets(part, toast))).toEqual(
      placed.map(() => ({ right: 8, top: 8 }))
    );
  });
});

/** The layers with each `close placement` wrapper's width left to its place. */
function unsized(layers: readonly ChildLayerSpec[]): readonly ChildLayerSpec[] {
  return layers.map((layer) => {
    if (layer.kind !== "frame") {
      return layer;
    }
    return layer.key === "close placement"
      ? { ...layer, sizing: { ...layer.sizing, horizontal: { kind: "placed" } } }
      : { ...layer, children: unsized(layer.children) };
  });
}

/** The kit with Dialog's close wrappers leaving their width to their place. */
function placedWidth(kit: KitSpec): KitSpec {
  return {
    ...kit,
    componentSets: kit.componentSets.map((set) => ({
      ...set,
      variants: set.variants.map((variant) => ({
        ...variant,
        root: { ...variant.root, children: unsized(variant.root.children) },
      })),
    })),
  };
}

describe("a placement wrapper whose length its place sets", () => {
  // Oracle: PG16's wrapper hugs its height around the close, and a Plan right after an Apply lists
  // nothing. Dialog's popup is 448px wide, so the kit gives its wrapper that width; this case leaves
  // the width to the place, as the build does where it reads no literal width for the parent, so
  // Apply resizes the wrapper, which turns its height FIXED (fake rule 5).
  it("still hugs its height after Apply, and the next Plan lists nothing", async () => {
    const { kit, collections } = await kitFixture();
    const placed = placedWidth(kit);
    const file = createFakeFigma({ collections });
    await reconcileKit(file.figma, placed, true);
    file.reopen();
    const set = setOn(await kitPage(file, "page/dialog"), "Dialog content");
    const wrapper = below(set, "dialog-content/content=basic", "close placement");
    expect([wrapper.width, wrapper.layoutSizingHorizontal, wrapper.layoutSizingVertical]).toEqual([
      448,
      "FIXED",
      "HUG",
    ]);
    expect((await reconcileKit(file.figma, placed, false)).changes).toEqual([]);
  });
});
