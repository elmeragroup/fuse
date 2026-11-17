/**
 * Unit under test: `coincidingAround`, which decides how many elements around a root lie exactly
 * behind it. Oracle: the boxes Chromium laid the kit's samples out in on 2026-11-18, read from each
 * element's border box, border and padding: the inset Sidebar's container under its `sidebar` div,
 * the Provider's wrapper and the host, all 256×448 at (8, 24) with no padding or border; the
 * collapsed rail's container 66px wide over a 64px wrapper, Fuse's 2px overhang (#759); and a Dropdown menu row, 160×32 at
 * (12, 68), under a static div of its size, inside a popup content 168×40 at (8, 64) with 4px padding.
 */
import { describe, expect, it } from "vitest";

import { coincidingAround } from "./coinciding-around.ts";
import type { AroundBox, Rect } from "./coinciding-around.ts";

/** A box from its left, top, width and height, as `getBoundingClientRect` gives them. */
function rect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, right: left + width, bottom: top + height };
}

/** An element around the root with nothing beside the chain. */
function alone(padding: Rect): AroundBox {
  return { padding, others: [] };
}

describe("the elements that lie exactly behind a root", () => {
  it("are the inset Sidebar's div, wrapper and host, each the container's box", () => {
    const box = rect(8, 24, 256, 448);
    // The `sidebar` div also holds the gap, an empty div that paints nothing.
    const sidebar: AroundBox = { padding: box, others: [{ meets: true, paintsNothing: true }] };
    expect(coincidingAround(box, [sidebar, alone(box), alone(box), alone(rect(8, 24, 256, 448 + 8))])).toBe(
      3
    );
  });

  it("are none under the collapsed rail, whose 66px container overhangs the 64px wrapper", () => {
    expect(coincidingAround(rect(8, 24, 66, 448), [alone(rect(8, 24, 64, 448))])).toBe(0);
  });

  it("stop at a Dropdown menu row's popup content, whose padding box is larger than the row", () => {
    const row = rect(12, 68, 160, 32);
    expect(coincidingAround(row, [alone(row), alone(rect(8, 64, 168, 40))])).toBe(1);
  });

  it("stop at an element whose other child paints over the root", () => {
    const box = rect(8, 24, 256, 448);
    expect(coincidingAround(box, [{ padding: box, others: [{ meets: true, paintsNothing: false }] }])).toBe(
      0
    );
  });
});
