import { describe, expect, it } from "vitest";

import { CONTAINER_PADDING, POPOVER_MAX_WIDTH_CLASS } from "./popover";

describe("popover geometry", () => {
  it("reserves one container-padding gutter per side in the width clamp", () => {
    // The clamp is a Tailwind literal, so the constant and the class can only agree by
    // construction; this is the assertion that keeps a padding change from landing alone.
    expect(POPOVER_MAX_WIDTH_CLASS).toContain(`calc(100vw-${String(CONTAINER_PADDING * 2)}px)`);
  });
});
