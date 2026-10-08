import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { DESCRIPTION_COPY, TITLE_COPY, TOGGLE_COPY } from "../../../test/sidebar-contract";
import { Sidebar } from "./index";
import { sidebarStrings } from "./intl";
import { useSidebar } from "./sidebar";
import { sidebarMenuButtonVariants } from "./sidebar-variants";

const PART_NAMES = [
  "Provider",
  "Root",
  "Trigger",
  "Rail",
  "Inset",
  "Input",
  "Header",
  "Footer",
  "Separator",
  "Content",
  "Group",
  "GroupLabel",
  "GroupAction",
  "GroupContent",
  "Menu",
  "MenuItem",
  "MenuButton",
  "MenuAction",
  "MenuBadge",
  "MenuSkeleton",
  "MenuSub",
  "MenuSubItem",
  "MenuSubButton",
  "Icon",
] as const;

describe("sidebar dictionary", () => {
  it("owns the locked sidebar.* copy in all four locales and carries no key beyond those three rows", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(sidebarStrings.getStringForLocale("toggle", locale), locale).toBe(TOGGLE_COPY[locale]);
      expect(sidebarStrings.getStringForLocale("title", locale), locale).toBe(TITLE_COPY[locale]);
      expect(sidebarStrings.getStringForLocale("description", locale), locale).toBe(DESCRIPTION_COPY[locale]);
      expect(Object.keys(sidebarStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "description",
        "title",
        "toggle",
      ]);
    }
  });
});

describe("useSidebar", () => {
  it("throws the documented message outside the provider", () => {
    function Probe() {
      useSidebar();
      return null;
    }
    expect(() => renderToString(createElement(Probe))).toThrow(
      "useSidebar must be used within a SidebarProvider."
    );
  });
});

describe("Sidebar namespace", () => {
  it("is the provider plus the 23 public parts, each carrying its dotted displayName", () => {
    expect(Object.keys(Sidebar).sort()).toEqual([...PART_NAMES].sort());
    for (const part of PART_NAMES) {
      expect(Sidebar[part].displayName, part).toBe(`Sidebar.${part}`);
    }
  });
});

describe("sidebarMenuButtonVariants", () => {
  it("covers the public axes: a control-sized default row and the shell-local sm and lg heights", () => {
    const defaults = sidebarMenuButtonVariants();
    expect(defaults).toContain("h-(--control-h-sm)");
    expect(defaults).toContain("px-(--control-px-xs)");
    expect(defaults).toContain("peer/menu-button");
    expect(defaults).toContain("group/menu-button");
    expect(defaults).toContain("group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8");
    expect(defaults).toContain("group-data-[collapsible=icon]:size-8!");
    expect(defaults).toContain("data-active:bg-sidebar-accent");
    // oxlint-disable-next-line elmera/no-local-focus-ring -- source-grep of the shared recipe's class, not a recipe
    expect(defaults).toContain("focus-visible:ring-ring");
    expect(sidebarMenuButtonVariants({ size: "sm" })).toContain("h-7");
    expect(sidebarMenuButtonVariants({ size: "sm" })).toContain("text-xs");
    expect(sidebarMenuButtonVariants({ size: "lg" })).toContain("h-12");
    expect(sidebarMenuButtonVariants({ size: "lg" })).toContain("group-data-[collapsible=icon]:p-0!");
    expect(sidebarMenuButtonVariants({ variant: "outline" })).toContain(
      "shadow-[0_0_0_1px_var(--sidebar-border)]"
    );
    expect(defaults).toContain("transition-[color,background-color,box-shadow]");
    expect(defaults).not.toContain("transition-[width,height,padding,color,background-color,box-shadow]");
  });

  it("uses no raw palette, dark, density, ring-literal, or legacy data-sidebar selectors", () => {
    const sized = [
      sidebarMenuButtonVariants({ variant: "outline", size: "sm" }),
      sidebarMenuButtonVariants({ size: "lg" }),
    ];
    for (const className of [sidebarMenuButtonVariants(), ...sized]) {
      expect(className).not.toContain("dark:");
      expect(className).not.toMatch(RAW_PALETTE_RE);
      expect(className).not.toMatch(/\b(?:dense|comfortable):/);
      expect(className).not.toContain("destructive");
      expect(className).not.toContain("ring-sidebar-ring");
      expect(className).not.toContain("data-[sidebar=");
    }
    // The default row reads control metrics; the sm and lg rail heights read none.
    for (const className of sized) {
      expect(className).not.toContain("--control-");
    }
  });
});
