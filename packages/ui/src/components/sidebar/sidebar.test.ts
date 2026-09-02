import { createElement } from "react";

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
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

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "sidebar.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "sidebar-variants.ts"), "utf8");
const hookSource = readFileSync(join(here, "..", "..", "hooks", "use-is-mobile.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "sidebar.ts"), "utf8");
const srcRoot = join(here, "..", "..");

const TOGGLE_COPY = {
  "nb-NO": "Vis eller skjul sidepanelet",
  "sv-SE": "Visa eller dölj sidopanelen",
  "en-US": "Toggle sidebar",
  "fi-FI": "Näytä tai piilota sivupalkki",
} as const;

const TITLE_COPY = {
  "nb-NO": "Sidepanel",
  "sv-SE": "Sidopanel",
  "en-US": "Sidebar",
  "fi-FI": "Sivupalkki",
} as const;

const DESCRIPTION_COPY = {
  "nb-NO": "Viser sidepanelet.",
  "sv-SE": "Visar sidopanelen.",
  "en-US": "Displays the sidebar.",
  "fi-FI": "Näyttää sivupalkin.",
} as const;

/** sidebar.md §6 — the canonical `data-slot` roster, one entry per part plus the layout slots. */
const SLOT_ROSTER = [
  "sidebar-wrapper",
  "sidebar",
  "sidebar-gap",
  "sidebar-container",
  "sidebar-inner",
  "sidebar-trigger",
  "sidebar-rail",
  "sidebar-inset",
  "sidebar-input",
  "sidebar-header",
  "sidebar-footer",
  "sidebar-separator",
  "sidebar-content",
  "sidebar-group",
  "sidebar-group-label",
  "sidebar-group-action",
  "sidebar-group-content",
  "sidebar-menu",
  "sidebar-menu-item",
  "sidebar-menu-button",
  "sidebar-menu-action",
  "sidebar-menu-badge",
  "sidebar-menu-skeleton",
  "sidebar-menu-skeleton-icon",
  "sidebar-menu-skeleton-text",
  "sidebar-menu-sub",
  "sidebar-menu-sub-item",
  "sidebar-menu-sub-button",
  "sidebar-icon",
];

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

  it("carries no key beyond the three rows accessibility.md §4.1 assigns to Sidebar", () => {
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
    expect(source).not.toContain("sidebar_state");
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
  it("is the provider plus the 23 spec parts, each carrying its dotted displayName", () => {
    expect(Object.keys(Sidebar).sort()).toEqual([...PART_NAMES].sort());
    expect(PART_NAMES).toHaveLength(24);
    for (const part of PART_NAMES) {
      expect(Sidebar[part].displayName, part).toBe(`Sidebar.${part}`);
    }
  });
});

describe("sidebarMenuButtonVariants", () => {
  it("covers the spec §4 axes with the shell-local height ladder", () => {
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
    expect(variantsSource).not.toContain("data-sidebar");
  });
});

describe("sidebar source contract", () => {
  it("is a client namespace lifted without the legacy data-sidebar attributes", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(hookSource.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("destructive");
    expect(source).not.toContain("forwardRef");
    expect(source).not.toContain("data-sidebar");
    expect(source).not.toMatch(/\bsidebar: "/);
    expect(source).not.toContain("ring-sidebar-ring");
    expect(source).not.toContain("--sidebar-background");
    expect(source).not.toContain("--sidebar-primary");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("lucide");
    expect(source).toContain("SidebarSimple");
    expect(source).toContain("useLocalizedStrings");
    expect(source).toContain("useIsMobile");
    expect(source).toContain("showCloseButton={false}");
    expect(source).toContain("SIDEBAR_WIDTH_MOBILE");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("<Tooltip.Trigger render={render} />");
    expect(source).toContain('hidden={state !== "collapsed" || isMobile}');
  });

  it("stamps every roster slot, data-slot before the props spread on plain parts", () => {
    for (const slot of SLOT_ROSTER) {
      const stamped = source.includes(`data-slot="${slot}"`) || source.includes(`slot: "${slot}"`);
      expect(stamped, slot).toBe(true);
    }
    for (const slot of SLOT_ROSTER) {
      const marker = `data-slot="${slot}"`;
      const at = source.indexOf(marker);
      if (at === -1) {
        continue;
      }
      const spread = source.indexOf("{...props}", at);
      const closes = source.indexOf("/>", at);
      const opens = source.indexOf(">", at);
      if (spread !== -1 && spread < Math.min(closes === -1 ? Infinity : closes, opens)) {
        expect(at, marker).toBeLessThan(spread);
      }
    }
  });

  it("keeps useIsMobile package-private and the facade a pure re-export", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("useIsMobile");
    expect(facade).not.toContain("sidebarMenuButtonVariants");
    expect(facade).not.toContain("sidebarMenuSubButtonVariants");
    expect(facade).toContain("Sidebar,");
    expect(facade).toContain("useSidebar,");
    for (const name of [
      "SIDEBAR_COOKIE_NAME",
      "SIDEBAR_COOKIE_MAX_AGE",
      "SIDEBAR_WIDTH",
      "SIDEBAR_WIDTH_MOBILE",
      "SIDEBAR_WIDTH_ICON",
      "SIDEBAR_KEYBOARD_SHORTCUT",
    ]) {
      expect(facade, name).toContain(name);
    }
    const facades = readdirSync(srcRoot).filter((entry) => entry.endsWith(".ts") && !entry.includes(".test"));
    for (const entry of facades) {
      expect(readFileSync(join(srcRoot, entry), "utf8"), entry).not.toContain("use-is-mobile");
    }
    expect(hookSource).toContain("(max-width: ${MOBILE_BREAKPOINT - 1}px)");
    expect(hookSource).toContain("Boolean(isMobile)");
  });
});
