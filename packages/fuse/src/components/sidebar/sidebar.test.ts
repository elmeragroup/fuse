import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
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
  // Heights, the action reserve, the collapsed square and the focus ring are computed-style
  // contracts in the browser suites; this pins the faces no browser test paints.
  it("pins the active and outline faces, the sm type and reserve, and the lg rail fill", () => {
    const defaults = sidebarMenuButtonVariants();
    expect(defaults).toContain("px-(--row-px)");
    expect(defaults).toContain("data-active:bg-sidebar-accent");
    expect(sidebarMenuButtonVariants({ size: "sm" })).toContain(
      "group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8"
    );
    expect(sidebarMenuButtonVariants({ size: "sm" })).toContain("text-xs");
    expect(sidebarMenuButtonVariants({ size: "lg" })).toContain("group-data-[collapsible=icon]:p-0!");
    expect(sidebarMenuButtonVariants({ variant: "outline" })).toContain(
      "shadow-[0_0_0_1px_var(--sidebar-border)]"
    );
    expect(defaults).toContain("transition-[color,background-color,box-shadow]");
    expect(defaults).not.toContain("transition-[width,height,padding,color,background-color,box-shadow]");
  });
});
