import { describe, expect, it } from "vitest";

import { panelHeightTransition } from "./panel-height";

const SHARED_TRANSITION = "ease-out overflow-hidden transition-[height] duration-150";
const COLLAPSED = "data-ending-style:h-0 data-starting-style:h-0";

describe("panelHeightTransition", () => {
  it("pins the shared open/close transition both panels append their height variable to", () => {
    expect(panelHeightTransition).toBe(`${SHARED_TRANSITION} ${COLLAPSED}`);
  });

  it("collapses on Base UI's starting/ending frames, never on data-open", () => {
    expect(panelHeightTransition).toContain("data-starting-style:h-0");
    expect(panelHeightTransition).toContain("data-ending-style:h-0");
    expect(panelHeightTransition).not.toContain("data-open");
  });
});
