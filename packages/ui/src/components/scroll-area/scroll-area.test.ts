import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { focusRing } from "../../styles/utils";

const here = dirname(fileURLToPath(import.meta.url));
const focusSelf = focusRing({ target: "self" }).root();

describe("scroll-area source contract", () => {
  it("does not keep the retired tv module, dark variants, or a local focus ring", () => {
    const source = readFileSync(join(here, "scroll-area.tsx"), "utf8");

    expect(existsSync(join(here, "../../styles/scroll-area.ts"))).toBe(false);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("scrollAreaVariants");
    expect(source).not.toContain("dark:");
    expect(source.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
    expect(source.includes(["focus-visible", "ring-ring"].join(":"))).toBe(false);
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).toContain(
      "Base UI has no `type` prop — map the Radix-style API to keepMounted + visibility."
    );
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(source).not.toContain(`"${token}"`);
    }
  });
});
