import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import { buttonVariants } from "./button-variants";

describe("buttonVariants", () => {
  it("defaults to the default variant", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
  });
});

describe("buttonVariants: the Button page's wrap recipe", () => {
  /**
   * The className the Button page documents for a label that may break onto more lines,
   * spelled here by hand. The recipe works only because tailwind-merge groups the size's
   * `h-(--control-h-md)` with `h-auto` and the base `whitespace-nowrap` with
   * `whitespace-normal`; a height spelled as an arbitrary property would keep both.
   */
  const WRAP_MD =
    "h-auto min-h-(--control-h-md) py-[calc((var(--control-h-md)-1lh)/2-1px)] text-center whitespace-normal";

  it("replaces the fixed height and nowrap through cn and keeps the size's inset, gap and type", () => {
    const merged = cn(buttonVariants(), WRAP_MD).split(" ");
    expect(merged).not.toContain("h-(--control-h-md)");
    expect(merged).not.toContain("whitespace-nowrap");
    for (const token of WRAP_MD.split(" ")) {
      expect(merged, token).toContain(token);
    }
    expect(merged).toContain("px-(--control-px-button-md)");
    expect(merged).toContain("gap-(--control-gap-md)");
    expect(merged).toContain("leading-(--control-leading)");
  });
});
