import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { DESCRIPTION_COPY, TITLE_COPY, TOGGLE_COPY } from "../../../test/sidebar-contract";
import { Sidebar } from "./index";
import { sidebarStrings } from "./intl";
import { useSidebar } from "./sidebar";

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
