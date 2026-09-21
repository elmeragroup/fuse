import { describe, expect, it } from "vitest";

import { dropdownMenuVariants } from "./dropdown-menu-variants";

describe("dropdownMenuVariants", () => {
  it("maps the destructive variant onto error-token classes, never a destructive class", () => {
    const item = dropdownMenuVariants().item();
    expect(item).toContain("data-[variant=destructive]:text-error");
    expect(item).toContain("data-[variant=destructive]:focus:bg-error/10");
    expect(item).not.toContain("text-destructive");
    expect(item).not.toContain("bg-destructive");
    expect(item).toContain("data-inset:pl-8");
  });
});
