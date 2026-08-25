import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "collapsible.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "collapsible.ts"), "utf8");

describe("collapsible source contract", () => {
  it("stays a client unstyled passthrough that emits data-slot before the props spread", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).toContain('from "@base-ui/react/collapsible"');
    expect(source).toContain("CollapsiblePrimitive.Panel");
    expect(source).toContain('displayName = "Collapsible.Root"');
    expect(source).toContain('displayName = "Collapsible.Trigger"');
    expect(source).toContain('displayName = "Collapsible.Content"');
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).not.toContain("collapsibleVariants");
    expect(source).not.toContain("Disclosure");
    expect(source).not.toContain("tv(");
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("collapsibleVariants");
    expect(facade).not.toContain("CollapsibleRoot");
    expect(facade).toContain('export { Collapsible } from "./components/collapsible/collapsible";');
    for (const slot of ["collapsible", "collapsible-trigger", "collapsible-content"]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });
});
