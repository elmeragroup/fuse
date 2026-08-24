import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "field.tsx"), "utf8");

describe("field source contract", () => {
  // Source-grep: recipe tokens have no runtime probe beyond the Field browser suite.
  it("keeps fieldVariants private and honest Title/Label slots on a shared heading hook", () => {
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("export const fieldVariants");
    expect(source).not.toContain("text-destructive");
    expect(source).not.toContain("dark:");
    expect(source).toContain('data-slot="field-label"');
    expect(source).toContain('data-slot="field-title"');
    expect(source).toContain("data-field-heading");
    expect(source).toContain("*:data-field-heading:flex-auto");
    expect(source).not.toContain("*:data-[slot=field-label]:flex-auto");
    expect(source).not.toContain("className={cn(className)}");
    expect(source).toContain('displayName = "Field.Title"');
    expect(source).toContain('from "../separator/separator"');
    expect(source).toContain("data-invalid:text-error");
    expect(source).toContain("group-data-disabled/field:opacity-50");
    expect(source).not.toContain("data-[invalid=true]");
    expect(source).not.toContain("group-data-[disabled=true]");
  });

  it("derives responsive orientation tokens from the vertical and horizontal literals", () => {
    expect(source).not.toContain("${");
    const vertical = orientationLiteral(source, "vertical");
    const horizontal = orientationLiteral(source, "horizontal");
    const responsive = orientationLiteral(source, "responsive");
    const fieldGroupMd = "@md/field-group:";
    const derived = [
      ...classTokens(horizontal).map((token) => `${fieldGroupMd}${token}`),
      `${fieldGroupMd}*:w-auto`,
      ...classTokens(vertical),
    ];

    expect(classTokens(responsive).toSorted()).toEqual(derived.toSorted());
  });
});

function orientationLiteral(sourceText: string, key: "vertical" | "horizontal" | "responsive"): string {
  const match = new RegExp(`${key}:\\s*"([^"]*)"`).exec(sourceText);
  if (match?.[1] === undefined) {
    throw new Error(`expected a literal ${key} orientation string`);
  }
  return match[1];
}

function classTokens(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}
