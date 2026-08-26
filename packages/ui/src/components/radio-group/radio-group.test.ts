import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SelectionItem } from "../selection-item/selection-item";
import { Radio, RadioGroup, RadioGroupItem, RadioIconButton, RadioItem, RadioItemGroup } from "./radio-group";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "radio-group.tsx"), "utf8");

describe("radio-group source contract", () => {
  it("emits data-slot before the props spread and does not import the reference", () => {
    expect(source).not.toContain(".ref/");
    const marker = 'data-slot="radio-group-item"';
    expect(source).toContain(marker);
    expect(source.indexOf(marker)).toBeLessThan(source.indexOf("{...props}", source.indexOf(marker)));
  });
});

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
