import { describe, expect, it } from "vitest";

import { panelHeight } from "./panel-height";

const SHARED_TRANSITION = "ease-out overflow-hidden transition-[height] duration-150";
const COLLAPSED = "data-ending-style:h-0 data-starting-style:h-0";

describe("panelHeight", () => {
  it("pins the shared open/close transition on both panel variants", () => {
    expect(panelHeight({ panel: "collapsible" })).toBe(
      `${SHARED_TRANSITION} ${COLLAPSED} h-(--collapsible-panel-height)`
    );
    expect(panelHeight({ panel: "accordion" })).toBe(
      `${SHARED_TRANSITION} ${COLLAPSED} h-(--accordion-panel-height)`
    );
  });

  it("collapses on Base UI's starting/ending frames, never on data-open", () => {
    for (const panel of ["collapsible", "accordion"] as const) {
      expect(panelHeight({ panel }), panel).toContain("data-starting-style:h-0");
      expect(panelHeight({ panel }), panel).toContain("data-ending-style:h-0");
      expect(panelHeight({ panel }), panel).not.toContain("data-open");
    }
  });
});
