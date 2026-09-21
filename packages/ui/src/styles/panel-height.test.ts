import { describe, expect, it } from "vitest";

import { panelHeightTransition } from "./panel-height";

const SHARED_TRANSITION = "ease-out overflow-hidden transition-[height] duration-150";
const COLLAPSED = "data-ending-style:h-0 data-starting-style:h-0";

describe("panelHeightTransition", () => {
  it("pins the shared open/close transition both panels append their height variable to", () => {
    expect(panelHeightTransition).toBe(`${SHARED_TRANSITION} ${COLLAPSED}`);
  });
});
