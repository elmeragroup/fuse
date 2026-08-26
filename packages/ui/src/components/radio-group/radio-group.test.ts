import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { focusRing } from "../../styles/utils";
import { SelectionItem } from "../selection-item/selection-item";
import { Radio, RadioGroup, RadioGroupItem, RadioIconButton, RadioItem, RadioItemGroup } from "./radio-group";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "radio-group.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "radio-group.ts"), "utf8");
const focusSelf = focusRing({ target: "self" }).root();

describe("radio-group source contract", () => {
  it("is a client surface with data-slot before the props spread", () => {
    expect(source).toContain('"use client"');
    expect(source).not.toContain(".ref/");
    const marker = 'data-slot="radio-group-item"';
    expect(source).toContain(marker);
    expect(source.indexOf(marker)).toBeLessThan(source.indexOf("{...props}", source.indexOf(marker)));
    expect(source).toContain('data-slot="radio-group-indicator"');
    expect(source).toContain('data-slot="radio-group"');
    expect(source).toContain('data-slot="radio-icon-button"');
    expect(source).toContain('dataSlot="radio-item"');
  });

  it("uses the shared self focus ring and keeps the expanded hit target and checked-invalid override", () => {
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).toContain("after:absolute after:-inset-x-3 after:-inset-y-2 after:content-['']");
    expect(source).toContain("aria-invalid:aria-checked:border-primary");
    expect(source).toContain("aria-invalid:border-error");
    expect(source).toContain("aria-invalid:ring-3");
    expect(source).toContain("aria-invalid:ring-error/20");
    expect(source).toContain("data-invalid:border-error");
    expect(source).toContain("bg-card");
    expect(source).toContain("size-4");
    expect(source).toContain("size-2");
    expect(source.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
    expect(source.includes(["focus-visible", "ring-ring"].join(":"))).toBe(false);
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(source).not.toContain(`"${token}"`);
    }
  });

  it("sets name on the radio-group primitive and gates the header on truthy isPending", () => {
    expect(source).toContain("<Field.Root invalid={isInvalid} disabled={isDisabled}>");
    expect(source).toContain("value={value}");
    expect(source).toContain("onChange ? (next) => onChange(String(next)) : undefined");
    expect(source).toContain("readOnly={isReadOnly}");
    expect(source).toContain("required={isRequired}");
    expect(source).toContain("name={name}");
    expect(source).toContain('orientation === "horizontal" ? "flex flex-wrap gap-4" : "flex flex-col gap-2"');
    expect(source).toContain("errorMessage ? <Field.Error>{errorMessage}</Field.Error> : null");
    expect(source).toContain("{label || isPending ? (");
    expect(source).not.toContain("isPending !== undefined");
    expect(source).not.toContain("<Field.Root name={name}");
  });

  it("does not keep destructive classes, dark variants, lucide, or raw palette", () => {
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("lucide");
    expect(source).not.toContain("LoaderCircle");
    expect(source).not.toContain("bg-background");
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).toContain('from "../../icons/generated/spinner-gap"');
    expect(source).toContain("SpinnerGap");
    expect(source).toContain("animate-spin size-3");
  });

  it("composes RadioGroupItem className as a string or Base UI state callback", () => {
    expect(source).toContain("className={(state) =>");
    expect(source).toContain("className instanceof Function ? className(state) : className");
  });

  it("exports the spec names from a directive-free facade", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("radioGroupVariants");
    expect(facade).not.toContain("RadioItemTitle");
    expect(facade).not.toContain("RadioItemActions");
    expect(facade).toContain("Radio");
    expect(facade).toContain("RadioGroup");
    expect(facade).toContain("RadioGroupItem");
    expect(facade).toContain("RadioIconButton");
    expect(facade).toContain("RadioItem");
    expect(facade).toContain("RadioItemGroup");
    expect(facade).toContain("RadioGroupProps");
    expect(facade).toContain("RadioIconButtonProps");
    expect(facade).toContain("RadioItemProps");
    expect(facade).toContain("RadioProps");
    expect(facade).not.toContain("RadioItemGroupContext");
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
