import { describe, expect, it } from "vitest";

import { buttonVariants } from "./button-variants";

describe("buttonVariants", () => {
  it("defaults to the default variant", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-secondary");
    expect(classes).toContain("text-secondary-foreground");
  });
});
