import { describe, expect, it } from "vitest";

import { CONTAINER_PADDING, POPOVER_MAX_WIDTH_CLASS } from "./popover";

describe("popover geometry", () => {
  it("keeps a 12px gutter from the viewport edge", () => {
    expect(CONTAINER_PADDING).toBe(12);
  });

  it("reserves one container-padding gutter per side in the width clamp", () => {
    // Unit under test: the Tailwind literal in the width clamp. Oracle: CONTAINER_PADDING,
    // which positioning reads. Tailwind cannot interpolate, so only this keeps them paired.
    expect(POPOVER_MAX_WIDTH_CLASS).toContain(`calc(100vw-${String(CONTAINER_PADDING * 2)}px)`);
  });
});
