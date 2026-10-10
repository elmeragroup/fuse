import { describe, expect, it } from "vitest";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import {
  FOREGROUND_PAIRS,
  LIGHT_ONLY_TOKENS,
  STUDIO_SECTIONS,
  STUDIO_TOKEN_NAMES,
  TOKEN_TABLE,
  sectionTokens,
} from "../../src/studio/lib/tokens";

const catalog = resolveThemeCatalog();
// The contract's own list: every theme's tokens record holds `TOKEN_NAMES`, in order.
const [firstTheme] = catalog.themes;
const CONTRACT_NAMES = Object.keys(firstTheme.schemes.light.tokens);

describe("TOKEN_TABLE", () => {
  it("lists every contract token once, in contract order", () => {
    expect(STUDIO_TOKEN_NAMES).toEqual(CONTRACT_NAMES);
  });

  it("files every token under exactly one section the inspector shows", () => {
    const sectionIds = STUDIO_SECTIONS.map((section) => section.id);
    const filed = STUDIO_SECTIONS.flatMap((section) => sectionTokens(section.id));
    expect(filed.toSorted()).toEqual(CONTRACT_NAMES.toSorted());
    expect(new Set(filed).size).toBe(filed.length);
    for (const name of STUDIO_TOKEN_NAMES) {
      expect(sectionIds).toContain(TOKEN_TABLE[name].section);
    }
  });

  it("gives each token the kind the contract gives it", () => {
    for (const name of STUDIO_TOKEN_NAMES) {
      expect(TOKEN_TABLE[name].kind, name).toBe(firstTheme.schemes.light.tokens[name].kind);
    }
  });

  it("files the shape and typography sections as the studio brief names them", () => {
    expect(sectionTokens("shape")).toEqual([
      "radius",
      "radius-button",
      "radius-field",
      "radius-step",
      "button-outline-width",
    ]);
    expect(sectionTokens("typography")).toEqual(["selection-title-weight", "font-sans", "font-heading"]);
    expect(sectionTokens("variant")).toEqual(["button-outline", "selection-checked-border"]);
  });
});

describe("LIGHT_ONLY_TOKENS", () => {
  it("names the keys a dark palette keeps from light, which declare one value in both schemes", () => {
    expect([...LIGHT_ONLY_TOKENS].toSorted()).toEqual(
      [
        "button-outline",
        "selection-checked-border",
        "radius",
        "radius-button",
        "radius-field",
        "radius-step",
        "button-outline-width",
        "selection-title-weight",
        "font-heading",
      ].toSorted()
    );
    for (const theme of catalog.themes) {
      for (const name of LIGHT_ONLY_TOKENS) {
        expect(theme.schemes.dark.tokens[name].css, `${theme.slug} ${name}`).toBe(
          theme.schemes.light.tokens[name].css
        );
      }
    }
  });
});

describe("FOREGROUND_PAIRS", () => {
  it("pairs every text-grade surface with its foreground", () => {
    expect(FOREGROUND_PAIRS).toEqual([
      { surface: "background", foreground: "foreground" },
      { surface: "card", foreground: "card-foreground" },
      { surface: "card-soft", foreground: "card-soft-foreground" },
      { surface: "popover", foreground: "popover-foreground" },
      { surface: "muted", foreground: "muted-foreground" },
      { surface: "accent", foreground: "accent-foreground" },
      { surface: "primary", foreground: "primary-foreground" },
      { surface: "primary-soft", foreground: "primary-soft-foreground" },
      { surface: "secondary", foreground: "secondary-foreground" },
      { surface: "secondary-soft", foreground: "secondary-soft-foreground" },
      { surface: "brand", foreground: "brand-foreground" },
      { surface: "error", foreground: "error-foreground" },
      { surface: "error-soft", foreground: "error-soft-foreground" },
      { surface: "info", foreground: "info-foreground" },
      { surface: "info-soft", foreground: "info-soft-foreground" },
      { surface: "success", foreground: "success-foreground" },
      { surface: "success-soft", foreground: "success-soft-foreground" },
      { surface: "warning", foreground: "warning-foreground" },
      { surface: "warning-soft", foreground: "warning-soft-foreground" },
      { surface: "destructive", foreground: "destructive-foreground" },
      { surface: "sidebar", foreground: "sidebar-foreground" },
      { surface: "sidebar-accent", foreground: "sidebar-accent-foreground" },
      { surface: "sidebar-brand", foreground: "sidebar-brand-foreground" },
      { surface: "right-panel", foreground: "right-panel-foreground" },
    ]);
  });
});
