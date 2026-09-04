import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item/selection-item";
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
  it("defaults to the icon size rung", () => {
    const classes = radioIconButtonVariants();
    expect(classes).toContain("size-(--control-h-md)");
    expect(classes).toContain("[&_svg:not([class*='size-'])]:size-4");
    expect(classes).toBe(radioIconButtonVariants({ size: "icon" }));
  });

  it("renders each size rung", () => {
    expect(radioIconButtonVariants({ size: "icon-xxs" })).toContain("size-(--control-h-xs)");
    expect(radioIconButtonVariants({ size: "icon-xxs" })).toContain("[&_svg:not([class*='size-'])]:size-3");
    expect(radioIconButtonVariants({ size: "icon-xs" })).toContain("size-(--control-h-xs)");
    expect(radioIconButtonVariants({ size: "icon-xs" })).toContain("[&_svg:not([class*='size-'])]:size-3.5");
    expect(radioIconButtonVariants({ size: "icon-sm" })).toContain("size-(--control-h-sm)");
    expect(radioIconButtonVariants({ size: "icon-sm" })).toContain("[&_svg:not([class*='size-'])]:size-4");
    expect(radioIconButtonVariants({ size: "icon" })).toContain("size-(--control-h-md)");
    expect(radioIconButtonVariants({ size: "icon" })).toContain("[&_svg:not([class*='size-'])]:size-4");
    expect(radioIconButtonVariants({ size: "icon-lg" })).toContain("size-(--control-h-lg)");
    expect(radioIconButtonVariants({ size: "icon-lg" })).toContain("[&_svg:not([class*='size-'])]:size-5");
  });

  it("puts the icon-button chrome on the recipe base", () => {
    const classes = radioIconButtonVariants();
    expect(classes).toContain("inline-flex");
    expect(classes).toContain("rounded-lg");
    expect(classes).toContain("border-input");
    expect(classes).toContain("bg-card");
    expect(classes).toContain("data-checked:border-primary");
    expect(classes).toContain("data-checked:bg-muted");
    expect(classes).toContain("data-invalid:border-error");
    expect(classes).not.toMatch(/\b(?:dense|comfortable):/);
  });

  it("covers every public size value", () => {
    expect(Object.keys(radioIconButtonVariants.variants.size).toSorted()).toEqual(
      [...ICON_BUTTON_SIZES].toSorted()
    );
    for (const size of ICON_BUTTON_SIZES) {
      expect(radioIconButtonVariants({ size }), size).toContain("size-(--control-h-");
    }
  });
});
