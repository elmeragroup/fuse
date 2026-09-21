import { describe, expect, it } from "vitest";

import {
  disabledHatch,
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
  it("pins the hatch as one token and the three icon-crossfade faces", () => {
    expect(disabledHatch).toBe(
      "bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgb(0_0_0/0.02)_8px,rgb(0_0_0/0.02)_16px)]"
    );
    expect(iconCrossfadeTransition).toBe(
      "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
    );
    expect(iconCrossfadeShown).toBe("scale-100 opacity-100 blur-none");
    expect(iconCrossfadeHidden).toBe("scale-[0.25] opacity-0 blur-[4px]");
  });
});
