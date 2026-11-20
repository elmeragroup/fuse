/**
 * The in-memory file's aspect lock, which the plugin writes on a box whose CSS aspect ratio sets its
 * height. Unit under test: rule 62 of the fake in `fake-figma.ts`. Oracles: probe PG18 on a scratch
 * file on 2026-11-19, where a component locked at 448 by 252 read `{ x: 448, y: 252 }` and kept it
 * through `combineAsVariants`, its instances read the same, an instance switched to an unlocked
 * variant read null, and a 9:16 variant 176px wide read its height as 312.8888854980469; and the
 * plugin typings, where a resize moves a set `targetAspectRatio` to the new size.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** A set of a 16:9 variant, locked at 448 by 252, and a 1:1 variant with no lock. */
function ratioSet() {
  const { figma } = createFakeFigma({ collections: [] });
  const wide = figma.createComponent();
  wide.name = "ratio=16:9";
  wide.resize(448, 252);
  wide.lockAspectRatio();
  const square = figma.createComponent();
  square.name = "ratio=1:1";
  square.resize(240, 240);
  figma.combineAsVariants([wide, square], figma.currentPage);
  return { figma, wide, square };
}

describe("an aspect lock", () => {
  it("reaches a locked variant's instance, and reads null once it switches to an unlocked one", () => {
    const { wide, square } = ratioSet();
    const instance = wide.createInstance();
    const read = [wide.targetAspectRatio, square.targetAspectRatio, instance.targetAspectRatio];
    instance.setProperties({ ratio: "1:1" });
    expect([...read, instance.targetAspectRatio]).toEqual([
      { x: 448, y: 252 },
      null,
      { x: 448, y: 252 },
      null,
    ]);
  });

  it("holds a 9:16 height as a 32-bit float", () => {
    const { figma } = createFakeFigma({ collections: [] });
    const tall = figma.createComponent();
    tall.resize(176, (176 * 16) / 9);
    tall.lockAspectRatio();
    expect(tall.targetAspectRatio).toEqual({ x: 176, y: 312.8888854980469 });
  });

  it("moves to the new size when the locked layer resizes", () => {
    const { wide } = ratioSet();
    wide.resize(300, 100);
    expect(wide.targetAspectRatio).toEqual({ x: 300, y: 100 });
  });
});
