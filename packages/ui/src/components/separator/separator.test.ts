import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "separator.tsx"), "utf8");

describe("separator source contract", () => {
  it("emits data-slot before the props spread and uses CSS orientation, not a JS class ternary", () => {
    expect(source).not.toContain(".ref/");
    expect(source).toContain('data-slot="separator"');
    expect(source.indexOf('data-slot="separator"')).toBeLessThan(source.indexOf("{...props}"));
    expect(source).toContain("data-horizontal:h-px");
    expect(source).toContain("data-vertical:self-stretch");
    expect(source).not.toContain("h-full");
    expect(source).not.toMatch(/orientation === ["']horizontal["']/);
    expect(source).not.toContain("dark:");
  });
});
