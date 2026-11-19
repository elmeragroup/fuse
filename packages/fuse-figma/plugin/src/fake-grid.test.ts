/**
 * The in-memory file's grid auto layout, rule 61 in `fake/grid.ts` and `fake/layout.ts`, which the
 * grid planner's tests rely on. Unit under test: the fake in `fake-figma.ts`. Oracles: the owner's
 * readings of a live file through the Plugin API on 2026-11-18. A layer set to FILL in a FLEX column
 * beside a 30px HUG column, a 10px gap and a 200px grid is 160px wide, and 260px once the grid is
 * 300px (PG9). A grid frame takes only MIN for its alignments, and throws `must be 'MIN' when
 * layoutMode is 'GRID'` for another (PG10). A frame with no auto layout that turns into a grid leaves
 * its layers in no cell, anchors -1, until ROW_AUTO_FLOW places them row by row (PG11). A FLEX track
 * has no content floor: two FLEX columns of a 100px grid stay 50px each beside an 80px layer, and a
 * layer filling the second takes its 50px (PG12). A HUG track keeps its length once its one layer
 * fills it (PG2), whatever the file reads in between.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** A grid frame of the given columns and one row, its height hugging. */
function grid(columns: GridTrackSize[], width: number) {
  const { figma } = createFakeFigma({ collections: [] });
  const frame = figma.createFrame();
  frame.layoutMode = "GRID";
  frame.gridItemsPositioning = "ROW_AUTO_FLOW";
  frame.gridColumnCount = columns.length;
  frame.gridRowCount = 1;
  frame.gridColumnSizes = columns;
  frame.gridRowSizes = [{ type: "HUG" }];
  frame.resize(width, 20);
  return { figma, frame };
}

/** A fixed layer of the given width, 10px tall, appended to a grid. */
function layer(figma: PluginAPI, frame: FrameNode, width: number): FrameNode {
  const child = figma.createFrame();
  child.resize(width, 10);
  frame.appendChild(child);
  return child;
}

describe("the fake's grid auto layout", () => {
  it("gives a layer filling a FLEX column the column's share, which follows the grid's width", () => {
    const { figma, frame } = grid([{ type: "HUG" }, { type: "FLEX", value: 1 }], 200);
    frame.gridColumnGap = 10;
    layer(figma, frame, 30);
    const filling = layer(figma, frame, 20);
    filling.layoutSizingHorizontal = "FILL";
    const before = filling.width;
    frame.resize(300, 20);
    expect([before, filling.width]).toEqual([160, 260]);
  });

  it("keeps a FLEX track's share beside a layer longer than it", () => {
    const { figma, frame } = grid(
      [
        { type: "FLEX", value: 1 },
        { type: "FLEX", value: 1 },
      ],
      100
    );
    layer(figma, frame, 80);
    const filling = layer(figma, frame, 20);
    filling.layoutSizingHorizontal = "FILL";
    expect(filling.width).toBe(50);
  });

  it("refuses any frame alignment but MIN on a grid", () => {
    const { frame } = grid([{ type: "HUG" }, { type: "HUG" }], 100);
    frame.primaryAxisAlignItems = "MIN";
    expect(() => {
      frame.counterAxisAlignItems = "CENTER";
    }).toThrow("counterAxisAlignItems must be 'MIN' when layoutMode is 'GRID'");
  });

  it("leaves the layers of a frame that turns into a grid in no cell until ROW_AUTO_FLOW places them", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const frame = figma.createFrame();
    const first = figma.createFrame();
    const second = figma.createFrame();
    frame.appendChild(first);
    frame.appendChild(second);
    frame.layoutMode = "GRID";
    const unplaced = [first.gridRowAnchorIndex, first.gridColumnAnchorIndex, frame.gridItemsPositioning];
    frame.gridItemsPositioning = "ROW_AUTO_FLOW";
    expect([unplaced, [second.gridRowAnchorIndex, second.gridColumnAnchorIndex]]).toEqual([
      [-1, -1, "MANUAL"],
      [0, 1],
    ]);
  });

  it.each([false, true])(
    "keeps a HUG track's length once its one layer fills it, with a read in between: %s",
    (readFirst) => {
      const { figma, frame } = grid([{ type: "HUG" }, { type: "HUG" }], 100);
      frame.layoutSizingHorizontal = "HUG";
      const child = layer(figma, frame, 20);
      layer(figma, frame, 30);
      if (readFirst) {
        expect(frame.width).toBe(50);
      }
      child.layoutSizingHorizontal = "FILL";
      expect([frame.width, child.width]).toEqual([50, 20]);
    }
  );
});
