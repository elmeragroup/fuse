import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Tabs } from "./tabs";
import { tabsListVariants } from "./tabs-variants";

const VARIANTS = ["default", "line"] as const;

describe("tabsListVariants", () => {
  it("defaults to variant=default and the field-box md rung", () => {
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

describe("Tabs SSR markup", () => {
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
