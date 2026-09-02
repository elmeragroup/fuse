import { describe, expect, it } from "vitest";

import { focusRing } from "../../styles/utils";
import { itemVariants } from "./item-variants";

const focusSelf = focusRing({ target: "self" }).root();

describe("itemVariants", () => {
  it("defaults to the default variant and size", () => {
    const classes = itemVariants();
    expect(classes).toContain("border-transparent");
    expect(classes).toContain("gap-3.5");
    expect(classes).toContain("px-4");
  });

  it("resolves each variant and size", () => {
    expect(itemVariants({ variant: "outline" })).toContain("border-border");
    expect(itemVariants({ variant: "muted" })).toContain("bg-muted/50");
    expect(itemVariants({ size: "sm" })).toContain("px-3");
    expect(itemVariants({ size: "xs" })).toContain("in-data-[slot=dropdown-menu-content]:p-0");
  });

  it("composes the shared self focus ring and never a dark variant", () => {
    const classes = itemVariants();
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(classes).toContain(token);
    }
    expect(classes).not.toContain("dark:");
  });
});
