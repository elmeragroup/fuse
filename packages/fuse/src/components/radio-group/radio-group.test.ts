import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item";
import { Radio, RadioGroup, RadioGroupItem, RadioIconButton, RadioItem, RadioItemGroup } from "./radio-group";
import { radioIconButtonVariants } from "./radio-group-variants";

const ICON_BUTTON_SIZES = ["icon", "icon-xxs", "icon-xs", "icon-sm", "icon-lg"] as const;

describe("RadioItem namespace aliases", () => {
  it("are the exact SelectionItem part objects", () => {
    expect(RadioItem.Title).toBe(SelectionItem.Title);
    expect(RadioItem.Description).toBe(SelectionItem.Description);
    expect(RadioItem.Content).toBe(SelectionItem.Content);
    expect(RadioItem.Actions).toBe(SelectionItem.Actions);
    expect(RadioItem.SubSection).toBe(SelectionItem.SubSection);
  });

  it("keeps the public values as distinct callables", () => {
    expect(Radio).not.toBe(RadioGroupItem);
    expect(RadioGroup).not.toBe(RadioItemGroup);
    expect(RadioItem).not.toBe(Radio);
    expect(RadioIconButton).not.toBe(RadioGroupItem);
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

  it("covers every public size value", () => {
    expect(Object.keys(radioIconButtonVariants.variants.size).toSorted()).toEqual(
      [...ICON_BUTTON_SIZES].toSorted()
    );
  });
});
