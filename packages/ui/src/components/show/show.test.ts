import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "show.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "show.ts"), "utf8");

describe("show source contract", () => {
  it("stays a server one-liner with no wrapper, fallback, or render-prop", () => {
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).toContain("when ? <>{children}</> : null");
    expect(source).not.toContain("fallback");
    expect(source).not.toContain("() =>");
    expect(source).not.toContain("showVariants");
    expect(facade).toContain('export { Show } from "./components/show/show";');
    expect(facade).not.toContain("showVariants");
    expect(facade).not.toContain("Root");
  });
});
