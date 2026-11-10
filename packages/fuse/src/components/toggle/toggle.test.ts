import { describe, expect, it } from "vitest";

import { selfFocusRingClass } from "../../styles/utils";
import { toggleVariants } from "./toggle-variants";

describe("toggleVariants", () => {
  it("keeps the doubled pressed selectors and composes the shared self focus ring", () => {
    const classes = toggleVariants();
    expect(classes).toContain("aria-pressed:bg-toggle-pressed");
    expect(classes).toContain("data-pressed:bg-toggle-pressed");
    // Oracle: the shared focus recipe the part composes.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(classes).toContain(token);
    }
    // Whole tokens: the focused invalid face's `aria-invalid:focus-visible:ring-3` is the shared
    // state face, not a local focus ring.
    const tokens = classes.split(" ");
    expect(tokens).not.toContain(["focus-visible", "ring-[3px]"].join(":"));
    expect(tokens).not.toContain(["focus-visible", "ring-3"].join(":"));
  });
});
