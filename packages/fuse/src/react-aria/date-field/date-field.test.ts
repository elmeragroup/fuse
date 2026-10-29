import { describe, expect, it } from "vitest";

import { dateFieldVariants } from "../../styles/date-field";

describe("dateFieldVariants", () => {
  it("floors only a box the field paints itself, and never sets the box's display", () => {
    const own = dateFieldVariants({ surface: "own" }).input();
    const group = dateFieldVariants({ surface: "group" }).input();
    expect(own).toContain("min-w-[150px]");
    expect(group).not.toContain("min-w-");
    for (const input of [own, group]) {
      expect(input).not.toMatch(/(?:^|\s)(?:block|flex|grid|inline)(?:\s|$)/u);
    }
  });
});
