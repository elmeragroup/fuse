import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { focusRing } from "../../styles/utils";

const here = dirname(fileURLToPath(import.meta.url));
const focusSelf = focusRing({ target: "self" }).root();

describe("switch source contract", () => {
  it("emits data-slot before the props spread and stays a client surface", () => {
    const source = readFileSync(join(here, "switch.tsx"), "utf8");
    expect(source).toContain('"use client"');
    expect(source).not.toContain(".ref/");
    const marker = 'data-slot="switch"';
    expect(source).toContain(marker);
    expect(source.indexOf(marker)).toBeLessThan(source.indexOf("{...props}", source.indexOf(marker)));
    expect(source).toContain('data-slot="switch-thumb"');
  });

  it("does not keep destructive classes, dark variants, or the lifted local focus ring", () => {
    const source = readFileSync(join(here, "switch.tsx"), "utf8");

    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source.includes(["focus-visible", "ring-[3px]"].join(":"))).toBe(false);
    expect(source.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
    expect(source.includes(["focus-visible", "ring-ring"].join(":"))).toBe(false);
    expect(source).toContain('focusRing({ target: "self" })');
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(source).not.toContain(`"${token}"`);
    }
  });

  it("keeps the optical track, duplicated per-size thumb translate, and error tokens", () => {
    const source = readFileSync(join(here, "switch.tsx"), "utf8");
    expect(source).toContain("data-[size=default]:h-[18.4px]");
    expect(source).toContain("data-[size=default]:w-[32px]");
    expect(source).toContain("data-[size=sm]:h-[14px]");
    expect(source).toContain("data-[size=sm]:w-[24px]");
    expect(source).toContain("group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]");
    expect(source).toContain("group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]");
    expect(source).toContain("group-data-[size=default]/switch:data-unchecked:translate-x-0");
    expect(source).toContain("group-data-[size=sm]/switch:data-unchecked:translate-x-0");
    expect(source).toContain("aria-invalid:border-error");
    expect(source).toContain("aria-invalid:ring-3");
    expect(source).toContain("aria-invalid:ring-error/20");
    expect(source).toContain("data-checked:bg-primary");
    expect(source).toContain("data-unchecked:bg-input");
    expect(source).not.toContain("--control-h-");
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toMatch(RAW_PALETTE_RE);
  });

  it("exports only the unlabeled primitive from the switch entry", () => {
    const facade = readFileSync(join(here, "..", "..", "switch.ts"), "utf8");
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("switchVariants");
    expect(facade).toContain('export { Switch } from "./components/switch/switch";');
    expect(facade).toContain('export type { SwitchProps } from "./components/switch/switch";');
  });
});
