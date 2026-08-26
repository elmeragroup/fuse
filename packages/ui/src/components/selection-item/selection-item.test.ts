import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "selection-item.tsx"), "utf8");

describe("selection-item source contract", () => {
  it("does not measure the control slot or import the reference", () => {
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("ResizeObserver");
    expect(source).not.toContain("useLayoutEffect");
    expect(source).not.toContain("getBoundingClientRect");
    expect(source).not.toContain("controlSlotWidth");
  });
});
