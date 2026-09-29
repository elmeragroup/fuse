import { describe, expect, it } from "vitest";

import { selfFocusRingClass } from "../../styles/utils";
import { toggleVariants } from "./toggle-variants";

describe("toggleVariants", () => {
  it("renders each variant without leaking the other axis", () => {
    const defaults = toggleVariants({ variant: "default" });
    expect(defaults).toContain("bg-transparent");
    expect(defaults).not.toContain("border-input");
    expect(defaults).not.toContain("shadow-xs");

    const outline = toggleVariants({ variant: "outline" });
    expect(outline).toContain("border-input");
    expect(outline).toContain("bg-transparent");
    expect(outline).toContain("shadow-xs");
  });

  it("keeps the doubled pressed selectors and composes the shared self focus ring", () => {
    const classes = toggleVariants();
    expect(classes).toContain("aria-pressed:bg-muted");
    expect(classes).toContain("data-pressed:bg-muted");
    // Oracle: the shared focus recipe, which utils.test.ts pins by hand.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(classes).toContain(token);
    }
    expect(classes.includes(["focus-visible", "ring-[3px]"].join(":"))).toBe(false);
    expect(classes.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
  });
});
