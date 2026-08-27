import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { toggleVariants as publicToggleVariants } from "../../toggle";
import { toggleVariants } from "../toggle/toggle-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "toggle-group.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "toggle-group.ts"), "utf8");

describe("toggle-group recipe borrow", () => {
  it("imports the public toggleVariants identity and has no local tv fork", () => {
    expect(toggleVariants).toBe(publicToggleVariants);
    expect(existsSync(join(here, "toggle-group-variants.ts"))).toBe(false);
    expect(source).toContain('from "../toggle/toggle-variants"');
    expect(source).not.toContain("tv(");
    expect(source).not.toMatch(/from ["']\.\/toggle-group-variants["']/);
    expect(facade).not.toContain("export { toggleVariants");
    expect(facade).not.toContain("export { toggleGroupVariants");
  });
});

describe("toggle-group source contract", () => {
  it("is a client namespace with displayNames and no data-[state=on] selector", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).toContain('displayName = "ToggleGroup.Root"');
    expect(source).toContain('displayName = "ToggleGroup.Item"');
    expect(source).toContain('from "@base-ui/react/toggle-group"');
    expect(source).toContain('from "@base-ui/react/toggle"');
    expect(source).not.toContain("data-[state=on]");
    expect(source).not.toContain('data-[state="on"]');
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("destructive");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
  });

  it("resolves itemProp ?? contextValue so an item-level axis wins", () => {
    expect(source).toContain("variant ?? context.variant");
    expect(source).toContain("size ?? context.size");
    expect(source).not.toContain("context.variant ?? variant");
    expect(source).not.toContain("context.size ?? size");
    expect(source).toContain("createContext<ToggleGroupContextValue>({})");
  });

  it("emits slots before the props spread so consumers can override them", () => {
    for (const marker of ['data-slot="toggle-group"', 'data-slot="toggle-group-item"']) {
      const at = source.indexOf(marker);
      expect(at, marker).toBeGreaterThan(-1);
      expect(source.indexOf("{...props}", at), marker).toBeGreaterThan(at);
    }
  });

  it("keeps the spacing CSS-var, segmented-control, and orientation classes from the lift", () => {
    expect(source).toContain('"--gap": spacing');
    expect(source).toContain("gap-[--spacing(var(--gap))]");
    expect(source).toContain("data-spacing={spacing}");
    expect(source).toContain("group/toggle-group");
    expect(source).toContain("data-vertical:flex-col");
    expect(source).toContain("group-data-[spacing=0]/toggle-group:rounded-none");
    expect(source).toContain("group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-md");
    expect(source).toContain("group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-md");
    expect(source).toContain("group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md");
    expect(source).toContain("group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md");
    expect(source).toContain("focus:z-10");
    expect(source).toContain("focus-visible:z-10");
  });

  it("exports the namespace from a directive-free facade and never re-exports toggleVariants", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { ToggleGroup } from "./components/toggle-group/toggle-group"');
    expect(facade).toContain("ToggleGroupRootProps");
    expect(facade).toContain("ToggleGroupItemProps");
    expect(facade).not.toContain("export * from");
    expect(facade).not.toMatch(/\bToggleGroupItem\b/);
    expect(facade).not.toMatch(/\bToggleGroupRoot\b/);
  });
});
