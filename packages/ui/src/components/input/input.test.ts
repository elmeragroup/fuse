import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { fieldBox } from "../../styles/field-box";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "input.tsx"), "utf8");
const fieldBoxTokens = fieldBox().split(/\s+/).filter(Boolean);

describe("input source contract", () => {
  // Source-grep: recipe tokens have no runtime probe beyond the density/browser suites.
  it("ships every spec §10 demo as a runnable file", () => {
    for (const demo of ["input-basic.tsx", "input-types.tsx", "input-states.tsx", "input-in-field.tsx"]) {
      expect(existsSync(join(here, "demos", demo)), demo).toBe(true);
    }
  });

  it("gates input-in-field Error behind invalid, matching textarea-in-field", () => {
    const demo = readFileSync(join(here, "demos/input-in-field.tsx"), "utf8");
    expect(demo).toContain("<Field.Root invalid>");
    expect(demo).toContain("<Field.Error>");
    expect(demo).toContain("export function InputInField");
  });

  it("composes the private field-box recipe and only adds Input deltas", () => {
    expect(source).not.toContain(".ref/");
    expect(source).toContain("fieldBox()");
    expect(source).toContain("min-w-0");
    expect(source).toContain("file:h-7");
    expect(source).toContain("disabled:pointer-events-none");
    expect(source).not.toContain("min-h-16");
    expect(source).not.toContain("py-1");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(fieldBoxTokens).toContain("h-(--control-h-md)");
    expect(fieldBoxTokens).toContain("aria-invalid:border-error");
    expect(fieldBoxTokens).toContain("aria-invalid:ring-3");
  });
});
