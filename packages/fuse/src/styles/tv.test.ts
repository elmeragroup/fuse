import { describe, expect, it } from "vitest";

import { accordionVariants } from "../components/accordion/accordion-variants";
import { inputGroupButtonVariants } from "../components/input-group/input-group-variants";

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

describe("a recipe's rounded-inner under a consumer rounded-* class", () => {
  it.each(["rounded-[2px]", "rounded-none"])("gives way to %s on the Accordion card panel", (override) => {
    const classes = tokens(accordionVariants({ variant: "card" }).content({ className: override }));
    expect(classes).toContain(override);
    expect(classes).not.toContain("rounded-inner");
  });

  it.each(["rounded-[2px]", "rounded-none"])("gives way to %s on an InputGroup button", (override) => {
    const classes = tokens(inputGroupButtonVariants({ size: "xs", className: override }));
    expect(classes).toContain(override);
    expect(classes).not.toContain("rounded-inner");
  });
});
