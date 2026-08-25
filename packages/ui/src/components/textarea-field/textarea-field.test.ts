import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "textarea-field.tsx"), "utf8");
const facade = readFileSync(join(here, "../../textarea-field.ts"), "utf8");

describe("textarea-field source contract", () => {
  it("is a client composite that restores uncontrolled defaultValue", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toMatch(/\bTextArea\b/);
    expect(source).not.toContain('value={value ?? ""}');
    expect(source).toContain("defaultValue={isControlled ? undefined : defaultValue}");
    expect(source).toContain("disabled={isDisabled}");
    expect(source).toContain("invalid={isInvalid}");
    expect(source).toContain("Field.Control");
    expect(source).toContain("Field.Error");
  });

  it("does not keep a TextArea alias, an own recipe, or a white surface override", () => {
    expect(source).not.toContain('from "tv"');
    expect(source).not.toContain("textFieldVariants");
    expect(source).not.toContain("textArea");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).toContain("text-muted-foreground");
  });

  it("keeps the facade a named re-export of TextareaField only", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toMatch(/\bTextArea\b/);
    expect(facade).toContain('export { TextareaField } from "./components/textarea-field/textarea-field";');
    expect(facade).toContain(
      'export type { TextareaFieldProps } from "./components/textarea-field/textarea-field";'
    );
  });
});
