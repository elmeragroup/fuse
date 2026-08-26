import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { focusRing } from "../../styles/utils";
import { SelectionItem } from "../selection-item/selection-item";
import { CheckboxDescription, CheckboxGroup, CheckboxItem, CheckboxItemGroup, Checkbox } from "./checkbox";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "checkbox.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "checkbox.ts"), "utf8");
const focusSelf = focusRing({ target: "self" }).root();

describe("checkbox source contract", () => {
  it("is a client surface with data-slot before the props spread", () => {
    expect(source).toContain('"use client"');
    expect(source).not.toContain(".ref/");
    const marker = 'data-slot="checkbox"';
    expect(source).toContain(marker);
    expect(source.indexOf(marker)).toBeLessThan(source.indexOf("{...props}", source.indexOf(marker)));
    expect(source).toContain('data-slot="checkbox-indicator"');
    expect(source).toContain('data-slot="checkbox-group"');
    expect(source).toContain('dataSlot="checkbox-item"');
  });

  it("uses the shared self focus ring and keeps the expanded hit target and checked-invalid override", () => {
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).toContain("after:absolute after:-inset-x-3 after:-inset-y-2 after:content-['']");
    expect(source).toContain("aria-invalid:aria-checked:border-primary");
    expect(source).toContain("aria-invalid:border-error");
    expect(source).toContain("aria-invalid:ring-3");
    expect(source).toContain("aria-invalid:ring-error/20");
    expect(source).toContain("bg-card");
    expect(source).toContain("size-4");
    expect(source).toContain("max-w-4");
    expect(source.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
    expect(source.includes(["focus-visible", "ring-ring"].join(":"))).toBe(false);
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(source).not.toContain(`"${token}"`);
    }
  });

  it("threads name through Field.Root and never names the group primitive", () => {
    expect(source).toContain("<Field.Root name={name} invalid={isInvalid} disabled={isDisabled}>");
    expect(source).toContain("onValueChange={onChange}");
    expect(source).toContain("allValues={allValues}");
    expect(source).toContain("disabled={isDisabled}");
    expect(source).toContain("invalid={isInvalid}");
    expect(source).toContain('orientation === "horizontal" ? "flex flex-wrap gap-4" : "flex flex-col gap-2"');
    expect(source).toContain("errorMessage ? <Field.Error>{errorMessage}</Field.Error> : null");
    expect(source).not.toContain("name={name}\n          id={id}");
  });

  it("does not keep destructive classes, dark variants, lucide, or raw palette", () => {
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
    expect(source).not.toContain("lucide");
    expect(source).not.toContain("CheckIcon");
    expect(source).not.toContain("MinusIcon");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).toContain('from "../../icons/generated/check"');
    expect(source).toContain('from "../../icons/generated/minus"');
  });

  it("exports the spec names from a directive-free facade", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("checkboxVariants");
    expect(facade).not.toContain("CheckboxItemTitle");
    expect(facade).not.toContain("CheckboxItemActions");
    expect(facade).toContain("Checkbox");
    expect(facade).toContain("CheckboxDescription");
    expect(facade).toContain("CheckboxGroup");
    expect(facade).toContain("CheckboxItem");
    expect(facade).toContain("CheckboxItemGroup");
    expect(facade).toContain("CheckboxDescriptionProps");
    expect(facade).toContain("CheckboxGroupProps");
    expect(facade).toContain("CheckboxItemProps");
    expect(facade).not.toContain("CheckboxItemGroupContext");
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
