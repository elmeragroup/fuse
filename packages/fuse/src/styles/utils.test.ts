import { describe, expect, it } from "vitest";

import {
  disabledHatch,
  iconCrossfadeHidden,
  iconCrossfadeShown,
  iconCrossfadeTransition,
  selfFocusRingClass,
  stateFocusRingClass,
  stateFocusRingVisibleClass,
  withinFocusRingClass,
  withinFocusRingControlClass,
} from "./utils";

/* oxlint-disable elmera/no-local-focus-ring -- independent test expectations for the focus recipe */
describe("focus-ring constants", () => {
  it("uses the documented focus selectors, ring width, and offset", () => {
    expect(selfFocusRingClass).toBe(
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    );
    expect(withinFocusRingClass).toBe(
      "has-[[data-focus-ring-control]:focus-visible]:ring-2 has-[[data-focus-ring-control]:focus-visible]:ring-ring has-[[data-focus-ring-control]:focus-visible]:ring-offset-2 has-[[data-focus-ring-control]:focus-visible]:ring-offset-background has-[[data-focus-ring-control]:focus-visible]:outline-none"
    );
    expect(withinFocusRingControlClass).toBe(
      "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
    );
    expect(stateFocusRingClass).toBe("outline-none");
    expect(stateFocusRingVisibleClass).toBe(
      "outline-none ring-2 ring-ring ring-offset-2 ring-offset-background"
    );
  });
});

/* oxlint-enable elmera/no-local-focus-ring */

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
