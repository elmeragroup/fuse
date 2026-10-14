import { describe, expect, it } from "vitest";

import {
  ariaInvalidFocusRingClass,
  dataInvalidFocusRingClass,
  dataWithinInvalidFocusRingClass,
  iconCrossfadeHidden,
  iconCrossfadeShown,
  iconCrossfadeTransition,
  selfFocusRingClass,
  stateFocusRingClass,
  stateFocusRingVisibleClass,
  stateInvalidFocusRingVisibleClass,
  withinFocusRingClass,
  withinFocusRingControlClass,
  withinInvalidFocusRingClass,
} from "./utils";

/* oxlint-disable elmera/no-local-focus-ring -- independent test expectations for the focus recipe */
describe("focus-ring constants", () => {
  it("uses the documented focus selectors and a flush 2px ring with no offset", () => {
    expect(selfFocusRingClass).toBe(
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    );
    expect(withinFocusRingClass).toBe(
      "has-[[data-focus-ring-control]:focus-visible]:ring-2 has-[[data-focus-ring-control]:focus-visible]:ring-ring has-[[data-focus-ring-control]:focus-visible]:outline-none"
    );
    expect(withinFocusRingControlClass).toBe(
      "focus-visible:ring-0 focus-visible:outline-none aria-invalid:focus-visible:ring-0 aria-invalid:focus-visible:ring-offset-0"
    );
    expect(stateFocusRingClass).toBe("outline-none");
    expect(stateFocusRingVisibleClass).toBe("outline-none ring-2 ring-ring");
  });

  it("paints a focused invalid control's solid 1px error line inside its 3px error/20 halo on every target", () => {
    expect(ariaInvalidFocusRingClass).toBe(
      "aria-invalid:focus-visible:ring-3 aria-invalid:focus-visible:ring-error/20 aria-invalid:focus-visible:ring-offset-1 aria-invalid:focus-visible:ring-offset-error"
    );
    expect(dataInvalidFocusRingClass).toBe(
      "data-invalid:focus-visible:ring-3 data-invalid:focus-visible:ring-error/20 data-invalid:focus-visible:ring-offset-1 data-invalid:focus-visible:ring-offset-error"
    );
    expect(withinInvalidFocusRingClass).toBe(
      "has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-3 has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-error/20 has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-offset-1 has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-offset-error"
    );
    expect(dataWithinInvalidFocusRingClass).toBe(
      "data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-3 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-error/20 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-offset-1 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-offset-error"
    );
    expect(stateInvalidFocusRingVisibleClass).toBe("ring-3 ring-error/20 ring-offset-1 ring-offset-error");
  });
});

/* oxlint-enable elmera/no-local-focus-ring */

describe("icon-crossfade constants", () => {
  it("pins the three icon-crossfade faces", () => {
    expect(iconCrossfadeTransition).toBe(
      "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
    );
    expect(iconCrossfadeShown).toBe("scale-100 opacity-100 blur-none");
    expect(iconCrossfadeHidden).toBe("scale-[0.25] opacity-0 blur-[4px]");
  });
});
