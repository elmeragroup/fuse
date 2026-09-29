import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item";
import { radioIconButtonVariants } from "./radio-group-variants";
import { RadioItem } from "./radio-item";

describe("RadioItem namespace aliases", () => {
  it("are the exact SelectionItem part objects", () => {
    expect(RadioItem.Title).toBe(SelectionItem.Title);
    expect(RadioItem.Description).toBe(SelectionItem.Description);
    expect(RadioItem.Content).toBe(SelectionItem.Content);
    expect(RadioItem.Actions).toBe(SelectionItem.Actions);
    expect(RadioItem.SubSection).toBe(SelectionItem.SubSection);
  });
});

describe("radioIconButtonVariants", () => {
  it("puts the icon-button chrome on the recipe base", () => {
    const classes = radioIconButtonVariants();
    expect(classes).toContain("inline-flex");
    expect(classes).toContain("rounded-lg");
    expect(classes).toContain("border-input");
    expect(classes).toContain("bg-card");
    expect(classes).toContain("data-checked:border-primary");
    expect(classes).toContain("data-checked:bg-muted");
    expect(classes).not.toMatch(/\b(?:dense|comfortable):/);
  });
});
