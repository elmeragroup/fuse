import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { buttonGroupVariants } from "./button-group-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "button-group.tsx"), "utf8");
const recipe = readFileSync(join(here, "button-group-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "button-group.ts"), "utf8");

const BASE_CLASSES = [
  "group/button-group",
  "flex",
  "w-fit",
  "items-stretch",
  "*:focus-visible:relative",
  "*:focus-visible:z-10",
  "has-[>[data-slot=button-group]]:gap-2",
  "has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md",
  "[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit",
  "[&>input]:flex-1",
] as const;

const HORIZONTAL_CLASSES = [
  "*:data-slot:rounded-r-none",
  "[&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-md!",
  "[&>[data-slot]~[data-slot]]:rounded-l-none",
  "[&>[data-slot]~[data-slot]]:border-l-0",
] as const;

const VERTICAL_CLASSES = [
  "flex-col",
  "*:data-slot:rounded-b-none",
  "[&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-md!",
  "[&>[data-slot]~[data-slot]]:rounded-t-none",
  "[&>[data-slot]~[data-slot]]:border-t-0",
] as const;

describe("buttonGroupVariants", () => {
  it("defaults to horizontal orientation and the group chrome base", () => {
    expect(buttonGroupVariants()).toBe(buttonGroupVariants({ orientation: "horizontal" }));
    const resolved = buttonGroupVariants();
    for (const token of BASE_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    for (const token of HORIZONTAL_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    expect(resolved).not.toContain("flex-col");
  });

  it("flips to a column and block-axis collapsing when orientation is vertical", () => {
    const resolved = buttonGroupVariants({ orientation: "vertical" });
    for (const token of BASE_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    for (const token of VERTICAL_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    expect(resolved).not.toContain("*:data-slot:rounded-r-none");
  });

  it("is layout-only: no control-box size axis, density stamp, or dark variant", () => {
    const resolved = `${buttonGroupVariants()} ${buttonGroupVariants({ orientation: "vertical" })}`;
    expect(resolved).not.toContain("--control-");
    expect(resolved).not.toContain("data-density");
    expect(resolved).not.toContain("dense:");
    expect(resolved).not.toContain("comfortable:");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
    expect(recipe).not.toContain("size:");
  });

  it("lets a className merge win over a conflicting recipe class through cn", () => {
    const merged = cn(buttonGroupVariants({ orientation: "vertical" }), "flex-row").split(/\s+/);
    expect(merged).toContain("flex-row");
    expect(merged).not.toContain("flex-col");
    expect(merged).toContain("group/button-group");
  });
});

describe("button-group source contract", () => {
  it("is a client namespace that uses useRender state for Text and the canonical Separator", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).toContain("useRender");
    expect(source).toContain("mergeProps");
    expect(source).toContain('slot: "button-group-text"');
    expect(source).toContain('from "../separator/separator"');
    expect(source).not.toMatch(/from ["']\.\.\/separator["']/);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("destructive");
    expect(source).toContain('displayName = "ButtonGroup.Root"');
    expect(source).toContain('displayName = "ButtonGroup.Separator"');
    expect(source).toContain('displayName = "ButtonGroup.Text"');
  });

  it("defaults Root orientation to horizontal and Separator orientation to vertical", () => {
    expect(source).toContain('orientation = "horizontal"');
    expect(source).toContain('orientation = "vertical"');
    expect(source).toContain("data-orientation={orientation}");
    expect(source).toContain('role="group"');
  });

  it("emits Root and Separator slots before the props spread so consumers can override them", () => {
    for (const marker of ['data-slot="button-group"', 'data-slot="button-group-separator"']) {
      const at = source.indexOf(marker);
      expect(at, marker).toBeGreaterThan(-1);
      expect(source.indexOf("{...props}", at), marker).toBeGreaterThan(at);
    }
  });

  it("exports the public recipe from the button-group entry and keeps parts namespaced", () => {
    expect(facade).toContain('export { ButtonGroup } from "./components/button-group/button-group"');
    expect(facade).toContain(
      'export { buttonGroupVariants } from "./components/button-group/button-group-variants"'
    );
    expect(facade).not.toContain("export * from");
    expect(facade).not.toMatch(/\bButtonGroupSeparator\b/);
    expect(facade).not.toMatch(/\bButtonGroupText\b/);
    expect(facade).not.toContain('"use client"');
    expect(source).not.toContain("export { buttonGroupVariants");
    expect(source).not.toContain("export const buttonGroupVariants");
  });
});
