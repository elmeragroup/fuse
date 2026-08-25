import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Tabs } from "./tabs";
import { tabsListVariants } from "./tabs-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "tabs.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "tabs-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "tabs.ts"), "utf8");
const VARIANTS = ["default", "line"] as const;

describe("tabsListVariants", () => {
  it("defaults to variant=default and the field-box md rung", () => {
    expect(tabsListVariants()).toBe(tabsListVariants({ variant: "default" }));
    const resolved = tabsListVariants();
    expect(resolved).toContain("group/tabs-list");
    expect(resolved).toContain("bg-muted");
    expect(resolved).toContain("h-(--control-h-md)");
    expect(resolved).not.toContain("h-9");
    expect(resolved).toContain("group-data-vertical/tabs:h-fit");
    expect(resolved).toContain("p-[3px]");
    expect(resolved).not.toContain("gap-1");
    expect(resolved).not.toContain("bg-transparent");
  });

  it("maps line onto the underline track without the filled pill", () => {
    const line = tabsListVariants({ variant: "line" });
    expect(line).toContain("gap-1");
    expect(line).toContain("bg-transparent");
    expect(line).not.toContain("bg-muted");
    expect(line).toContain("data-[variant=line]:rounded-none");
  });

  it("covers every public variant without raw palette, dark, or density variants", () => {
    expect(VARIANTS).toHaveLength(2);
    for (const variant of VARIANTS) {
      const resolved = tabsListVariants({ variant });
      expect(resolved.length, variant).toBeGreaterThan(0);
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
      expect(resolved, variant).not.toMatch(/\b(?:dense|comfortable):/);
      expect(resolved, variant).not.toContain("h-9");
      expect(resolved, variant).not.toContain("destructive");
    }
  });
});

describe("tabs source contract", () => {
  it("stays a client namespace that emits data-slot before the props spread", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("destructive");
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { Tabs } from "./components/tabs/tabs"');
    expect(facade).toContain('export { tabsListVariants } from "./components/tabs/tabs-variants"');
    expect(facade).not.toContain("TabsList");
    expect(facade).not.toContain("TabsTrigger");
    expect(facade).not.toContain("TabsContent");
    expect(source).toContain('displayName = "Tabs.Root"');
    expect(source).toContain('displayName = "Tabs.List"');
    expect(source).toContain('displayName = "Tabs.Trigger"');
    expect(source).toContain('displayName = "Tabs.Content"');
    for (const slot of ["tabs", "tabs-list", "tabs-trigger", "tabs-content"]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });

  it("keeps the two-group coupling, pre-hydration orientation, and shared self focus ring", () => {
    expect(source).toContain('from "@base-ui/react/tabs"');
    expect(source).toContain("TabsPrimitive.Tab");
    expect(source).toContain("TabsPrimitive.Panel");
    expect(source).toContain("group/tabs");
    expect(variantsSource).toContain("group/tabs-list");
    expect(source).toContain('orientation = "horizontal"');
    expect(source).toContain('variant = "default"');
    expect(source).toContain("activateOnFocus = true");
    expect(source).toContain("activateOnFocus={activateOnFocus}");
    expect(source).toContain("data-orientation={orientation}");
    expect(source).toContain("orientation={orientation}");
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).not.toContain("outline-none");
    expect(variantsSource).toContain("h-(--control-h-md)");
    expect(variantsSource).not.toContain("h-9");
    const contentMarker = 'data-slot="tabs-content"';
    const contentSlice = source.slice(source.indexOf(contentMarker));
    expect(contentSlice).not.toContain("outline-none");
  });

  it("stamps data-orientation on Root in SSR markup before hydration", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Tabs.Root,
        { defaultValue: "account", orientation: "vertical" },
        createElement(
          Tabs.List,
          null,
          createElement(Tabs.Trigger, { value: "account" }, "Account"),
          createElement(Tabs.Trigger, { value: "password" }, "Password")
        ),
        createElement(Tabs.Content, { value: "account" }, "Account panel"),
        createElement(Tabs.Content, { value: "password" }, "Password panel")
      )
    );
    expect(markup).toContain('data-slot="tabs"');
    expect(markup).toContain('data-orientation="vertical"');
    expect(markup).toContain('data-slot="tabs-list"');
    expect(markup).toContain('data-variant="default"');
  });
});
