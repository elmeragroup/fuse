import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item/selection-item";
import { Radio, RadioGroup, RadioGroupItem, RadioIconButton, RadioItem, RadioItemGroup } from "./radio-group";

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
