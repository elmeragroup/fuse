/**
 * Where the in-memory file reads a placed layer, which the placing tests and the corner-close inset
 * check rely on. Unit under test: the fake in `fake-figma.ts`. Oracles, from live probes and Figma's
 * reference: a layer at MAX keeps its distance to its parent's end through the parent's resize (rule
 * 9); a close in an absolute auto layout row 448px wide, aligned MAX and padded 16 on the right and the
 * top, sits at x 408 and y 16 (PG16); and an instance of the component around that row moves its close
 * when the main row's top padding changes, from 16 to 20 below the top (PG20). A place reads the same
 * through `x` and `y`, `absoluteBoundingBox` and `absoluteRenderBounds`, as one layer has one place.
 * A half-turned layer in a flow keeps its box in its slot, its origin at the box's far corner (rule
 * 26, PR). A padding or alignment the instance's row writes is an override: the typings'
 * `NodeChangeProperty` (`@figma/plugin-typings` 1.141.0) names each field, an instance keeps its own
 * overrides when the main changes (rule 38, N3), and `removeOverrides` "removes all direct
 * overrides".
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** A layer's place as `x` and `y` and as each of its boxes on the page give it. */
function placeReads(node: FrameNode | InstanceNode) {
  const corner = (box: Rect | null) => (box === null ? null : { x: box.x, y: box.y });
  return {
    local: { x: node.x, y: node.y },
    box: corner(node.absoluteBoundingBox),
    render: corner(node.absoluteRenderBounds),
  };
}

/** The same place read three ways, for a layer in a parent at the page's origin. */
function readAt(x: number, y: number) {
  return { local: { x, y }, box: { x, y }, render: { x, y } };
}

/**
 * A 448px column component holding PG16's wrapper: an absolute auto layout row across it, aligned MAX
 * and padded 16 on the right and the top, around a 24px close in flow.
 */
function placedClose(figma: PluginAPI) {
  const closeMain = figma.createComponent();
  closeMain.resize(24, 24);
  const column = figma.createComponent();
  column.layoutMode = "VERTICAL";
  column.resize(448, 200);
  const wrapper = figma.createFrame();
  column.appendChild(wrapper);
  wrapper.layoutMode = "HORIZONTAL";
  wrapper.layoutPositioning = "ABSOLUTE";
  wrapper.resize(448, 40);
  wrapper.x = 0;
  wrapper.y = 0;
  wrapper.primaryAxisAlignItems = "MAX";
  wrapper.counterAxisAlignItems = "MIN";
  wrapper.paddingRight = 16;
  wrapper.paddingTop = 16;
  const close = closeMain.createInstance();
  wrapper.appendChild(close);
  return { column, wrapper, close };
}

describe("a placed layer", () => {
  it("reads one place through x and y and its boxes, at its end inset after a resize", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const parent = figma.createFrame();
    parent.resize(300, 100);
    const badge = figma.createFrame();
    parent.appendChild(badge);
    badge.resize(24, 24);
    badge.constraints = { horizontal: "MAX", vertical: "MIN" };
    badge.x = 260;
    badge.y = 8;
    parent.resize(400, 100);
    expect(placeReads(badge)).toEqual(readAt(360, 8));
  });

  it("reads one place through x and y and its boxes, in an absolute auto layout row", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const { close } = placedClose(figma);
    expect(placeReads(close)).toEqual(readAt(408, 16));
  });

  it("keeps a half-turned layer's box in its slot in an absolute auto layout row", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const { close } = placedClose(figma);
    const turned = (rotation: number) => {
      close.rotation = rotation;
      return { x: close.x, y: close.y, box: close.absoluteBoundingBox };
    };
    expect([turned(180), turned(0)]).toEqual([
      { x: 432, y: 40, box: { x: 408, y: 16, width: 24, height: 24 } },
      { x: 408, y: 16, box: { x: 408, y: 16, width: 24, height: 24 } },
    ]);
  });
});

/** The row and close an instance of {@link placedClose}'s column shows. */
function shownRow(instance: InstanceNode) {
  const [row] = instance.children;
  if (row?.type !== "FRAME") {
    throw new Error("the instance shows its main's row");
  }
  const [close] = row.children;
  if (close === undefined) {
    throw new Error("the row shows its main's close");
  }
  return { row, close };
}

/** How far below the instance's top its close sits, by its `y` and by its box on the page. */
function closeTop(instance: InstanceNode) {
  const { close } = shownRow(instance);
  const box = close.absoluteBoundingBox;
  const origin = instance.absoluteBoundingBox;
  return { y: close.y, box: box === null || origin === null ? null : box.y - origin.y };
}

describe("an absolute auto layout row an instance shows", () => {
  it("places its layer by the main row's padding as that stands", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const { column, wrapper } = placedClose(figma);
    const instance = column.createInstance();
    const before = closeTop(instance);
    wrapper.paddingTop = 20;
    expect([before, closeTop(instance)]).toEqual([
      { y: 16, box: 16 },
      { y: 20, box: 20 },
    ]);
  });

  it("keeps a padding the instance's row writes when the main row's changes", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const { column, wrapper } = placedClose(figma);
    const instance = column.createInstance();
    shownRow(instance).row.paddingTop = 24;
    wrapper.paddingTop = 28;
    expect([shownRow(instance).row.paddingTop, closeTop(instance)]).toEqual([24, { y: 24, box: 24 }]);
  });

  it("lists the padding and alignment its row writes as overrides, and removeOverrides clears them", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const { column } = placedClose(figma);
    const instance = column.createInstance();
    const { row, close } = shownRow(instance);
    row.paddingTop = 24;
    row.primaryAxisAlignItems = "MIN";
    const listed = instance.overrides;
    instance.removeOverrides();
    expect({
      listed,
      after: { padding: row.paddingTop, align: row.primaryAxisAlignItems, x: close.x, y: close.y },
      overrides: instance.overrides,
    }).toEqual({
      listed: [{ id: row.id, overriddenFields: ["paddingTop", "primaryAxisAlignItems"] }],
      after: { padding: 16, align: "MAX", x: 408, y: 16 },
      overrides: [],
    });
  });
});
