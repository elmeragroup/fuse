import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item/selection-item";
import { CheckboxDescription, CheckboxGroup, CheckboxItem, CheckboxItemGroup, Checkbox } from "./checkbox";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "checkbox.tsx"), "utf8");

describe("checkbox source contract", () => {
  it("emits data-slot before the props spread and does not import the reference", () => {
    expect(source).not.toContain(".ref/");
    const marker = 'data-slot="checkbox"';
    expect(source).toContain(marker);
    expect(source.indexOf(marker)).toBeLessThan(source.indexOf("{...props}", source.indexOf(marker)));
  });
});

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
