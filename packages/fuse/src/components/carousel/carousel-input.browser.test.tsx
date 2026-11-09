/**
 * Unit under test: the carousel's input owner, `createCarouselInput`, over a stand-in viewport in
 * Chromium. Oracle: its documented wheel lifetime, written out here in frames: a turn along the
 * axis holds input until two frames pass with no further turn.
 */
import { describe, expect, it } from "vitest";

import { nextFrames } from "../../../test/animation-frames";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { createCarouselInput } from "./carousel-input";

// A stand-in viewport: the owner only listens on the element it is given, so any element that
// takes wheel events will do. It is mounted through the shared harness like every suite's markup.
function mountViewport(): HTMLElement {
  renderThemed(<div role="region" aria-label="Viewport" />);
  return roleNamed("region", "Viewport");
}

describe("Carousel input over a wheel gesture", () => {
  it("holds a trackpad gesture's turns, one per frame, as one input released two frames after the last", async () => {
    const viewport = mountViewport();
    let inputs = 0;
    let releases = 0;
    const input = createCarouselInput(viewport, "horizontal", {
      onInput: () => (inputs += 1),
      onRelease: () => (releases += 1),
    });
    // What each frame sees as it begins: whether input is held, and how many releases came so far.
    const seen: string[] = [];
    const look = () => seen.push(`${input.held() ? "held" : "free"} ${releases}`);
    const turns = 10;
    for (let turn = 0; turn < turns; turn += 1) {
      await nextFrames(1);
      look();
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaX: 12, bubbles: true }));
    }
    for (let after = 0; after < 4; after += 1) {
      await nextFrames(1);
      look();
    }
    input.destroy();

    // Every turn is input the engine hears of, so each one stops rotation and the spell's count.
    expect(inputs).toBe(turns);
    expect(seen).toEqual([
      // Before the first turn.
      "free 0",
      // Every turn after it finds the gesture still held: a turn while held extends the hold.
      ...Array.from({ length: turns - 1 }, () => "held 0"),
      // A frame after the last turn it is still held; by the second it is released, once.
      "held 0",
      "free 1",
      "free 1",
      "free 1",
    ]);
  });
});
