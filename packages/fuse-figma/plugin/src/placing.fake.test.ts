/**
 * The layers a file the plugin applied the whole kit to places by their distances to their parent's
 * edges, on the in-memory file in `fake-figma.ts`. Unit under test: `planLeaving` and `planPlace`
 * through Apply and Plan. Oracles, written by hand from the Timeline list's CSS: an item's dot sits
 * 0px from its left and 8px from its top (`absolute top-2 left-0`), and its connector 4px from its
 * left, from 32px below its top to 32px past its bottom (`before:top-8 before:left-[4px]
 * before:h-full`), so it is as tall as the item; MIN keeps a start distance, STRETCH both; and both
 * paint over the item's text, after it, as CSS paints positioned boxes (CSS 2.1 Appendix E). The fake
 * lays out no hugging frame, so an item stays 100px tall, its height before the kit's first write.
 */
import { describe, expect, it } from "vitest";

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
