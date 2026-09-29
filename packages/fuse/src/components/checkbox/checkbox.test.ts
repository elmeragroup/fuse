import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item";
import { CheckboxItem } from "./checkbox-item";

describe("CheckboxItem namespace aliases", () => {
  it("are the exact SelectionItem part objects", () => {
    expect(CheckboxItem.Title).toBe(SelectionItem.Title);
    expect(CheckboxItem.Description).toBe(SelectionItem.Description);
    expect(CheckboxItem.Content).toBe(SelectionItem.Content);
    expect(CheckboxItem.Actions).toBe(SelectionItem.Actions);
    expect(CheckboxItem.SubSection).toBe(SelectionItem.SubSection);
  });
});
