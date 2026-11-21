/**
 * An icon placed outside its row's auto layout by its distances to the row's edges, on the in-memory
 * file in `fake-figma.ts`. Unit under test: `planIcon` and `planPlace` through Apply and Plan. Oracle,
 * written by hand from CSS: an icon at `absolute right-[5px]` with both vertical offsets `auto`, in a
 * row that centres its items, sits 5px inside the row's right edge and centred in the row's content
 * box (CSS 2.1 §10.3.7, CSS Flexbox 1 §4.1), here 4px below the row's centre, whatever the row's
 * size. A turn about the icon's centre leaves its box there (CSS Transforms 2 §6). So the 12px Check
 * in a 200 × 24 row has its box at 183, 10, and at 223, 13 once the row is 240 × 30: MAX keeps the
 * end distance and CENTER the centre's offset (fake rules 9, 24, 47, 59). The resize grows each axis
 * by an even length, since the fake refuses a CENTER shift of half a pixel (rule 59).
 */
import { describe, expect, it } from "vitest";

import type { ChildLayerSpec, IconLayerSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, CHECK, frame, LABEL, literal, nestedKit } from "./button-kit-fixture.ts";
import { aliasOf, childNamed, color, fixtureFile, string } from "./fake-fixtures.ts";
import { reconcileKit } from "./reconcile.ts";

/** The Check at 5px from the row's right edge, its centre 4px below the row's centre. */
const PLACED: IconLayerSpec = {
  ...CHECK,
  placement: {
    kind: "edges",
    within: "parent",
    horizontal: { kind: "end", end: 5 },
    vertical: { kind: "centre", offset: 4 },
  },
};

/** A 200 × 24 row holding the label in its flow and the icon outside it. */
function row(icon: IconLayerSpec): readonly ChildLayerSpec[] {
  return [
    {
      ...frame("button/row", "Row", [LABEL, icon]),
      sizing: {
        horizontal: { kind: "fixed", length: literal(200) },
        vertical: { kind: "fixed", length: literal(24) },
      },
    },
  ];
}

/** A synced file the Button fixture's label binds. */
function syncedFile() {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
    string("Fuse brand", "font-sans", "Roboto"),
  ]);
}

/** The row and its icon, after the file reopens. */
async function rowOf(file: ReturnType<typeof syncedFile>) {
  file.reopen();
  const frameNode = childNamed(await buttonVariant(file), "FRAME", "Row");
  return { frame: frameNode, icon: childNamed(frameNode, "INSTANCE", "Check") };
}

/** The icon's box against the row's: its left and top edges and its size, as the turned box bounds it. */
function boxIn(frameNode: FrameNode, icon: InstanceNode) {
  const outer = frameNode.absoluteBoundingBox;
  const inner = icon.absoluteBoundingBox;
  if (outer === null || inner === null) {
    throw new Error("the row or its icon has no box");
  }
  return [inner.x - outer.x, inner.y - outer.y, inner.width, inner.height];
}

describe.each([
  ["unturned", PLACED],
  ["turned a half turn", { ...PLACED, rotation: 180 }],
])("an icon at its row's end, centred down, %s", (_case, icon) => {
  const kit = nestedKit(row(icon));

  it("sits absolute at its distances, MAX across and CENTER down, and the next Plan lists nothing", async () => {
    const file = syncedFile();
    await reconcileKit(file.figma, kit, true);
    const { frame: frameNode, icon: node } = await rowOf(file);
    expect([node.layoutPositioning, node.constraints, boxIn(frameNode, node)]).toEqual([
      "ABSOLUTE",
      { horizontal: "MAX", vertical: "CENTER" },
      [183, 10, 12, 12],
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it("keeps its distances as the row resizes", async () => {
    const file = syncedFile();
    await reconcileKit(file.figma, kit, true);
    const { frame: frameNode, icon: node } = await rowOf(file);
    frameNode.resize(240, 30);
    expect(boxIn(frameNode, node)).toEqual([223, 13, 12, 12]);
  });

  it("goes back to its place when a designer moves it", async () => {
    const file = syncedFile();
    await reconcileKit(file.figma, kit, true);
    const { icon: node } = await rowOf(file);
    node.x = 0;
    node.y = 0;
    file.reopen();
    expect((await reconcileKit(file.figma, kit, false)).changes).toContain(
      "Button / size=md / Row / Check: place → 5px from the right, its centre 4px from the centre"
    );
    await reconcileKit(file.figma, kit, true);
    const after = await rowOf(file);
    expect(boxIn(after.frame, after.icon)).toEqual([183, 10, 12, 12]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});
