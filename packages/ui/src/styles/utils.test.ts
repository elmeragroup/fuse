import { describe, expect, it } from "vitest";

import {
  focusRing,
  selfFocusRingClass,
  stateFocusRingClass,
  stateFocusRingVisibleClass,
  withinFocusRingClass,
  withinFocusRingControlClass,
} from "./utils";

describe("focus-ring constants", () => {
  it("resolves each fixed rung from the shared recipe", () => {
    expect(selfFocusRingClass).toBe(focusRing({ target: "self" }).root());
    expect(withinFocusRingClass).toBe(focusRing({ target: "within" }).root());
    expect(withinFocusRingControlClass).toBe(focusRing({ target: "within" }).control());
    expect(stateFocusRingClass).toBe(focusRing({ target: "state" }).root());
    expect(stateFocusRingVisibleClass).toBe(focusRing({ target: "state", isFocusVisible: true }).root());
  });
});
