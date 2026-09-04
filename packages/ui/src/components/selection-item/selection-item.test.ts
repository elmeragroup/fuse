import { describe, expect, it } from "vitest";

import { selectionGroupOrientationVariants } from "./selection-item-variants";

describe("selectionGroupOrientationVariants", () => {
  it("defaults to the vertical group and list slots", () => {
    const slots = selectionGroupOrientationVariants();
    expect(slots.group()).toContain("flex");
    expect(slots.group()).toContain("flex-col");
    expect(slots.group()).toContain("gap-2");
    expect(slots.group()).toContain("has-[>[data-selection-item]]:gap-0");
    expect(slots.list()).toContain("gap-0");
    expect(slots.list()).not.toContain("flex-row");
    expect(slots.group()).toBe(selectionGroupOrientationVariants({ orientation: "vertical" }).group());
    expect(slots.list()).toBe(selectionGroupOrientationVariants({ orientation: "vertical" }).list());
  });

  it("resolves the vertical orientation", () => {
    const slots = selectionGroupOrientationVariants({ orientation: "vertical" });
    expect(slots.group()).toContain("flex-col");
    expect(slots.group()).toContain("gap-2");
    expect(slots.group()).toContain("has-[>[data-selection-item]]:gap-0");
    expect(slots.group()).not.toContain("flex-wrap");
    expect(slots.list()).toContain("gap-0");
    expect(slots.list()).not.toContain("gap-4");
    expect(slots.list()).not.toContain("flex-row");
  });

  it("resolves the horizontal orientation", () => {
    const slots = selectionGroupOrientationVariants({ orientation: "horizontal" });
    expect(slots.group()).toContain("flex");
    expect(slots.group()).toContain("flex-wrap");
    expect(slots.group()).toContain("gap-4");
    expect(slots.group()).not.toContain("flex-col");
    expect(slots.group()).not.toContain("has-[>[data-selection-item]]:gap-0");
    expect(slots.list()).toContain("flex-row");
    expect(slots.list()).toContain("flex-wrap");
    expect(slots.list()).toContain("gap-4");
  });
});
