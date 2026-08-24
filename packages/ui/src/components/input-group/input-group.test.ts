import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { focusRing } from "../../styles/utils";
import { inputGroupAddonVariants, inputGroupButtonVariants } from "./input-group-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "input-group.tsx"), "utf8");

const ALIGNMENTS = ["inline-start", "inline-end", "block-start", "block-end"] as const;
const BUTTON_SIZES = ["xs", "sm", "icon-xs", "icon-sm"] as const;

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

describe("inputGroupAddonVariants", () => {
  it("defaults to the inline-start rail", () => {
    expect(inputGroupAddonVariants()).toBe(inputGroupAddonVariants({ align: "inline-start" }));
    expect(inputGroupAddonVariants()).toContain("order-first");
    expect(inputGroupAddonVariants()).toContain("pl-2");
  });

  it("resolves every align value with the shared rail base", () => {
    for (const align of ALIGNMENTS) {
      const resolved = inputGroupAddonVariants({ align });
      expect(resolved, align).toContain("cursor-text");
      expect(resolved, align).toContain("text-muted-foreground");
      expect(resolved, align).toContain("group-data-[disabled=true]/input-group:opacity-50");
      expect(resolved, align).not.toContain("dark:");
    }
    expect(inputGroupAddonVariants({ align: "inline-end" })).toContain("order-last");
    expect(inputGroupAddonVariants({ align: "block-start" })).toContain("w-full");
    expect(inputGroupAddonVariants({ align: "block-end" })).toContain("w-full");
  });

  it("keeps the documented kbd radius arithmetic", () => {
    expect(inputGroupAddonVariants()).toContain("[&>kbd]:rounded-[calc(var(--radius)-5px)]");
  });
});

describe("inputGroupButtonVariants", () => {
  it("defaults to the compact xs addon size", () => {
    expect(inputGroupButtonVariants()).toBe(inputGroupButtonVariants({ size: "xs" }));
    expect(tokens(inputGroupButtonVariants({ size: "xs" }))).toContain("h-6");
  });

  it("lets Button's own sm metrics pass through untouched", () => {
    const base = inputGroupButtonVariants({ size: "sm" });
    for (const token of tokens(base)) {
      expect(token, token).not.toMatch(/^(?:h|size|px)-/);
    }
  });

  it("gives the icon values a square box and no padding", () => {
    expect(tokens(inputGroupButtonVariants({ size: "icon-xs" }))).toEqual(
      expect.arrayContaining(["size-6", "p-0"])
    );
    expect(tokens(inputGroupButtonVariants({ size: "icon-sm" }))).toEqual(
      expect.arrayContaining(["size-8", "p-0"])
    );
  });

  it("is a shell-local exemption: no --control-* rung and no density variants", () => {
    for (const size of BUTTON_SIZES) {
      const resolved = inputGroupButtonVariants({ size });
      expect(resolved, size).not.toContain("--control-");
      expect(resolved, size).not.toContain("dense:");
      expect(resolved, size).not.toContain("comfortable:");
      expect(resolved, size).not.toContain("data-density");
    }
  });
});

describe("input-group source contract", () => {
  it("pins the md control rung and never a literal control ladder", () => {
    expect(source).toContain("h-(--control-h-md)");
    for (const literal of ["h-9 ", "h-10 ", "px-2.5 ", "px-3 "]) {
      expect(source, literal).not.toContain(literal);
    }
    expect(source).not.toContain("data-density");
    expect(source).not.toContain("dense:");
    expect(source).not.toContain("comfortable:");
  });

  it("takes both focus slots from the shared within adapter and defines no ring literal", () => {
    expect(source).toContain('focusRing({ target: "within" }).root()');
    expect(source).toContain('focusRing({ target: "within" }).control()');
    expect(source).toContain("data-focus-ring-control");
    expect(source).not.toContain("ring-ring");
    for (const token of tokens(focusRing({ target: "within" }).root())) {
      expect(source, token).not.toContain(token);
    }
  });

  it("emits every slot before the props spread so consumers can override it", () => {
    // Source-grep: attribute source order has no behavioral probe (separator.md precedent).
    for (const marker of [
      'data-slot="input-group"',
      'data-slot="input-group-addon"',
      'data-slot="input-group-text"',
      'data-slot="input-group-control"',
    ]) {
      const at = source.indexOf(marker);
      expect(at, marker).toBeGreaterThan(-1);
      expect(source.indexOf("{...props}", at), marker).toBeGreaterThan(at);
    }
  });

  it("is a client module that carries no ref path, dark variant, or destructive token", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("destructive");
    expect(source).toContain("border-error");
    expect(source).toContain("ring-error/20");
  });

  it("drops the reference's popup focus suppression (§8.7)", () => {
    expect(source).not.toContain("combobox-content");
    expect(source).not.toContain("focus-within");
    expect(source).not.toContain("border-inherit");
  });

  it("keeps the recipes module-private and the facade a named re-export", () => {
    const facade = readFileSync(join(here, "..", "..", "input-group.ts"), "utf8");
    expect(facade).toContain('export { InputGroup } from "./components/input-group/input-group";');
    expect(facade).not.toContain("inputGroupAddonVariants");
    expect(facade).not.toContain("inputGroupButtonVariants");
    expect(facade).not.toContain("export *");
  });
});
