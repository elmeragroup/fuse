import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { DESCRIPTION_COPY, TITLE_COPY, TOGGLE_COPY } from "../../../test/sidebar-contract";
import { sidebarStrings } from "./intl";
import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
  Sidebar,
  useSidebar,
} from "./sidebar";
import { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "./sidebar-variants";

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
  it("owns the locked sidebar.* copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(sidebarStrings.getStringForLocale("toggle", locale), locale).toBe(TOGGLE_COPY[locale]);
      expect(sidebarStrings.getStringForLocale("title", locale), locale).toBe(TITLE_COPY[locale]);
      expect(sidebarStrings.getStringForLocale("description", locale), locale).toBe(DESCRIPTION_COPY[locale]);
    }
  });

  it("carries no key beyond the three rows owned by Sidebar", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(sidebarStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "description",
        "title",
        "toggle",
      ]);
    }
  });
});

describe("sidebar constants", () => {
  it("keeps the documented values, the cookie name above all", () => {
    expect(SIDEBAR_COOKIE_NAME).toBe("sidebar:state");
    expect(SIDEBAR_COOKIE_MAX_AGE).toBe(604800);
    expect(SIDEBAR_WIDTH).toBe("16rem");
    expect(SIDEBAR_WIDTH_MOBILE).toBe("18rem");
    expect(SIDEBAR_WIDTH_ICON).toBe("3rem");
    expect(SIDEBAR_KEYBOARD_SHORTCUT).toBe("b");
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
    expect(PART_NAMES).toHaveLength(24);
    for (const part of PART_NAMES) {
      expect(Sidebar[part].displayName, part).toBe(`Sidebar.${part}`);
    }
  });
});

describe("sidebarMenuButtonVariants", () => {
  it("covers the public axes with the shell-local height ladder", () => {
    const defaults = sidebarMenuButtonVariants();
    expect(defaults).toContain("h-8");
    expect(defaults).toContain("peer/menu-button");
    expect(defaults).toContain("group/menu-button");
    expect(defaults).toContain("group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8");
    expect(defaults).toContain("group-data-[collapsible=icon]:size-8!");
    expect(defaults).toContain("data-active:bg-sidebar-accent");
    expect(defaults).toContain("data-open:hover:bg-sidebar-accent");
    // oxlint-disable-next-line elmera/no-local-focus-ring -- source-grep of the shared recipe's class, not a recipe
    expect(defaults).toContain("focus-visible:ring-ring");
    expect(sidebarMenuButtonVariants({ size: "sm" })).toContain("h-7");
    expect(sidebarMenuButtonVariants({ size: "sm" })).toContain("text-xs");
    expect(sidebarMenuButtonVariants({ size: "lg" })).toContain("h-12");
    expect(sidebarMenuButtonVariants({ size: "lg" })).toContain("group-data-[collapsible=icon]:p-0!");
    expect(sidebarMenuButtonVariants({ variant: "outline" })).toContain(
      "shadow-[0_0_0_1px_var(--sidebar-border)]"
    );
    expect(sidebarMenuButtonVariants({ variant: "outline" })).toContain(
      "hover:shadow-[0_0_0_1px_var(--sidebar-accent)]"
    );
    expect(defaults).toContain("transition-[color,background-color,box-shadow]");
    expect(defaults).not.toContain("transition-[width,height,padding,color,background-color,box-shadow]");
  });

  it("puts MenuSubButton's size axis on the control ladder", () => {
    expect(sidebarMenuSubButtonVariants()).toContain("h-(--control-h-md)");
    expect(sidebarMenuSubButtonVariants()).toContain("[font-size:var(--control-text)]");
    expect(sidebarMenuSubButtonVariants()).toContain("[line-height:var(--control-leading)]");
    expect(sidebarMenuSubButtonVariants({ size: "sm" })).toContain("h-(--control-h-sm)");
    expect(sidebarMenuSubButtonVariants({ size: "sm" })).toContain("text-sm");
    expect(sidebarMenuSubButtonVariants()).not.toContain("h-7");
    expect(sidebarMenuSubButtonVariants()).not.toContain("data-[size=");
  });

  it("uses no raw palette, dark, density, ring-literal, or legacy data-sidebar selectors", () => {
    for (const className of [
      sidebarMenuButtonVariants(),
      sidebarMenuButtonVariants({ variant: "outline", size: "sm" }),
      sidebarMenuButtonVariants({ size: "lg" }),
    ]) {
      expect(className).not.toContain("dark:");
      expect(className).not.toMatch(RAW_PALETTE_RE);
      expect(className).not.toMatch(/\b(?:dense|comfortable):/);
      expect(className).not.toContain("destructive");
      expect(className).not.toContain("ring-sidebar-ring");
      expect(className).not.toContain("data-[sidebar=");
      expect(className).not.toContain("--control-");
    }
  });
});
