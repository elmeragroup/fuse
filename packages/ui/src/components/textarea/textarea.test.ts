import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { fieldBox } from "../../styles/field-box";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "textarea.tsx"), "utf8");
const fieldBoxTokens = fieldBox({ box: "content" }).split(/\s+/).filter(Boolean);

describe("textarea source contract", () => {
  // Source-grep: recipe tokens have no runtime probe beyond the density/browser suites.
  it("ships every spec §10 demo as a runnable file", () => {
    for (const demo of ["textarea-basic.tsx", "textarea-states.tsx", "textarea-in-field.tsx"]) {
      expect(existsSync(join(here, "demos", demo)), demo).toBe(true);
    }
  });

  it("is server-safe, composes field-box, and only adds content-sized deltas", () => {
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain('"use client"');
    expect(source).toContain('fieldBox({ box: "content" })');
    expect(source).toContain("field-sizing-content");
    // Content sizing lives on the recipe's box axis; the host must not cancel it.
    expect(source).not.toContain("h-auto");
    expect(source).not.toContain("min-h-16");
    expect(source).not.toContain("py-2");
    expect(source).not.toContain("bg-transparent");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("pointer-events-none");
    expect(source).not.toContain("file:");
    expect(fieldBoxTokens).toContain("px-(--control-px-md)");
    expect(fieldBoxTokens).toContain("min-h-16");
    expect(fieldBoxTokens).toContain("py-2");
    expect(fieldBoxTokens).not.toContain("h-(--control-h-md)");
    expect(fieldBoxTokens).toContain("aria-invalid:border-error");
    expect(fieldBoxTokens).toContain("aria-invalid:ring-3");
  });
});
