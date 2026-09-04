import { describe, expect, it } from "vitest";

import {
  disabledHatch,
  faces,
  focusRing,
  iconCrossfadeHidden,
  iconCrossfadeShown,
  iconCrossfadeTransition,
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

describe("hatch and icon-crossfade constants", () => {
  it("resolves each face from the shared recipe", () => {
    expect(disabledHatch).toBe(faces().hatch());
    expect(iconCrossfadeTransition).toBe(faces().iconTransition());
    expect(iconCrossfadeShown).toBe(faces().iconShown());
    expect(iconCrossfadeHidden).toBe(faces().iconHidden());
  });
});
