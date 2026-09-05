import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item/selection-item";
import { CheckboxDescription, CheckboxGroup, CheckboxItem, CheckboxItemGroup, Checkbox } from "./checkbox";

describe("CheckboxItem namespace aliases", () => {
  it("are the exact SelectionItem part objects", () => {
    expect(CheckboxItem.Title).toBe(SelectionItem.Title);
    expect(CheckboxItem.Description).toBe(SelectionItem.Description);
    expect(CheckboxItem.Content).toBe(SelectionItem.Content);
    expect(CheckboxItem.Actions).toBe(SelectionItem.Actions);
    expect(CheckboxItem.SubSection).toBe(SelectionItem.SubSection);
  });

  it("keeps the public values as distinct callables", () => {
    expect(Checkbox).not.toBe(CheckboxGroup);
    expect(CheckboxItemGroup).not.toBe(CheckboxGroup);
    expect(CheckboxDescription).not.toBe(Checkbox);
  });
});
