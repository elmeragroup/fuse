import { describe, expect, it } from "vitest";

import { scrollbarTypeVariants } from "./scroll-area";

describe("scroll-area hover scrollbar", () => {
  it("reveals on hovering with opacity and pointer-events", () => {
    const hover = scrollbarTypeVariants({ type: "hover" });
    expect(hover).toContain("data-[hovering]:opacity-100");
    expect(hover).toContain("data-[hovering]:pointer-events-auto");
  });
});
