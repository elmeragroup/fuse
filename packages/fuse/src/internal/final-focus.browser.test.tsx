import { describe, expect, it, onTestFinished } from "vitest";

import { finalFocusUnlessMoved } from "./final-focus";

// The oracle is Base UI's rule for a boolean `finalFocus`, in `FloatingFocusManager.tsx`. Focus that
// moved out of the closing overlay stays where it went. The component suites cover the return when
// focus is still inside or fell to the body. None of them moves focus out before a custom target
// applies.
describe("finalFocusUnlessMoved", () => {
  it("leaves focus that moved elsewhere alone, without resolving a target that moves focus", () => {
    const overlay = document.createElement("div");
    const inside = document.createElement("button");
    const outside = document.createElement("button");
    overlay.append(inside);
    document.body.append(overlay, outside);
    onTestFinished(() => {
      overlay.remove();
      outside.remove();
    });
    outside.focus();
    const result = finalFocusUnlessMoved(
      overlay,
      (active) => overlay.contains(active),
      () => {
        inside.focus();
        return inside;
      }
    );
    expect(result).toBe(false);
    expect(document.activeElement).toBe(outside);
  });
});
