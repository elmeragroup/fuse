import { describe, expect, it } from "vitest";

import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { resolveThemeCatalog } from "./catalog";
import type { ResolvedScheme, ResolvedTheme } from "./catalog";
import { TOKEN_NAMES } from "./tokens/contract";
import { DENSITY_METRIC_NAMES } from "./tokens/density-metrics";
import { PRIMITIVE_NAMES } from "./tokens/primitives";
import { RADIUS_RUNG_NAMES } from "./tokens/radius-scale";

// The unit under test is the resolved catalog. Every expected value below is written by hand
// from the token sources and fuse.css, never read back through the resolver.

/** Every legal theme slug in LEGAL_THEMES order: variant, then brand, then segment. */
const SLUGS = [
  "internal-fkas-private",
  "internal-fkas-company",
  "internal-tkas-private",
  "internal-tkas-company",
  "internal-guen-private",
  "internal-guen-company",
  "internal-fkab-company",
  "internal-fkse-private",
  "internal-elma-private",
  "internal-elma-company",
  "external-fkas-private",
  "external-fkas-company",
  "external-tkas-private",
  "external-tkas-company",
  "external-guen-private",
  "external-guen-company",
  "external-fkab-company",
  "external-fkse-private",
  "external-elma-private",
  "external-elma-company",
] as const;

// Counts the derived `secondary-hover` role and the `radius-step` rung spacing.
const TOKEN_COUNT = 79;

// xs, sm, md, lg, xl and the unused popover rung.
const RUNG_COUNT = 6;

const catalog = resolveThemeCatalog();

function theme(slug: (typeof SLUGS)[number]): ResolvedTheme {
  const found = catalog.themes.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw new Error(`no theme ${slug}`);
  return found;
}

function light(slug: (typeof SLUGS)[number]): ResolvedScheme {
  return theme(slug).schemes.light;
}

describe("resolveThemeCatalog", () => {
  it("resolves every legal theme in both schemes, in source order", () => {
    expect(catalog.themes.map((resolved) => resolved.slug)).toEqual(SLUGS);
    for (const resolved of catalog.themes) {
      expect(Object.keys(resolved.schemes)).toEqual(["light", "dark"]);
      for (const scheme of [resolved.schemes.light, resolved.schemes.dark]) {
        expect(Object.keys(scheme.tokens)).toHaveLength(TOKEN_COUNT);
        expect(Object.keys(scheme.tokens)).toEqual(TOKEN_NAMES);
        expect(Object.keys(scheme.rungs)).toHaveLength(RUNG_COUNT);
        expect(Object.keys(scheme.rungs)).toEqual(RADIUS_RUNG_NAMES);
      }
    }
    expect(Object.keys(catalog.primitives)).toEqual(PRIMITIVE_NAMES);
    expect(catalog.density.map((metric) => metric.name)).toEqual(DENSITY_METRIC_NAMES);
  });

  it("describes each theme with its axes, deployment density and document attributes", () => {
    expect(theme("external-fkas-private")).toMatchObject({
      input: { variant: "external", brand: "fkas", segment: "private" },
      defaultDensity: "comfortable",
    });
    expect(theme("internal-elma-company").defaultDensity).toBe("dense");
    expect(Object.entries(theme("external-fkas-private").attributes)).toEqual([
      ["data-theme-variant", "external"],
      ["data-theme-brand", "fkas"],
      ["data-theme-segment", "private"],
      ["data-density", "comfortable"],
    ]);
  });

  it("computes each radius rung from the theme's radius and step", () => {
    // external-fkas-private sets --radius: 0.75rem, 12px, and external themes step 2px.
    expect(light("external-fkas-private").rungs["radius-md"]).toEqual({
      name: "radius-md",
      kind: "dimension",
      css: "calc(var(--radius) - var(--radius-step))",
      codeSyntax: "calc(var(--radius) - var(--radius-step))",
      reference: undefined,
      value: 10,
    });
    expect(theme("external-fkas-private").schemes.dark.rungs["radius-xl"].value).toBe(16);
    // external-tkas-private sets 0.95rem, 15.2px, so radius-xs is 15.2 - 3 * 2.
    expect(light("external-tkas-private").rungs["radius-xs"].value).toBeCloseTo(9.2, 9);
    // Internal themes keep 0.375rem, 6px, and step 0px, so every rung is 6px.
    expect(light("internal-elma-private").rungs["radius-xs"].value).toBe(6);
    expect(light("internal-elma-private").rungs["radius-xl"].value).toBe(6);
    // The popover rung steps four times below --radius: 12 - 4 * 2.
    expect(light("external-fkas-private").rungs["radius-popover"]).toMatchObject({
      css: "calc(var(--radius) - 4 * var(--radius-step))",
      value: 4,
    });
  });

  it("keeps a var() as one hop and resolves its value along the chain in the same scheme", () => {
    const guenDark = theme("external-guen-private").schemes.dark;
    expect(guenDark.tokens.destructive).toMatchObject({
      css: "var(--error)",
      reference: { space: "token", name: "error" },
    });
    // External dark themes take --error from DARK_DEFAULTS, and a light-scheme hop would
    // resolve to the light error instead. Each colour oracle below converts a hand-copied
    // literal with the colour package's own conversion.
    const darkError = getOrThrow(Oklch.parse("oklch(0.8383036 0.089085 26.7575)"));
    expect(guenDark.tokens.destructive.value).toEqual(Oklch.toSrgb(darkError));

    // fkab shares Fjordkraft's accent by policy.
    const fkasAccent = getOrThrow(Oklch.parse("oklch(0.68 0.21747 38.8)"));
    expect(catalog.primitives["brand-fkab"]).toMatchObject({
      name: "brand-fkab",
      kind: "color",
      css: "var(--brand-fkas)",
      codeSyntax: "var(--brand-fkab)",
      reference: { space: "primitive", name: "brand-fkas" },
    });
    expect(catalog.primitives["brand-fkab"].value).toEqual(Oklch.toSrgb(fkasAccent));

    const sidebarBrand = light("external-fkas-private").tokens["sidebar-brand"];
    expect(sidebarBrand).toMatchObject({ css: "var(--brand)", reference: { space: "token", name: "brand" } });
    expect(sidebarBrand.value).toEqual(Oklch.toSrgb(fkasAccent));
  });

  it("reads colours as unrounded sRGB", () => {
    // `#5c6773` in DEFAULTS is a hex literal, not oklch.
    expect(light("internal-fkas-private").tokens["sh-identifier"]).toMatchObject({
      css: "#5c6773",
      reference: undefined,
      value: { r: 0x5c / 255, g: 0x67 / 255, b: 0x73 / 255, alpha: 1 },
    });
    expect(light("external-fkas-private").tokens["muted-foreground"].value).toMatchObject({ alpha: 0.7 });
  });

  it("reads dimensions as px and fonts as the first family", () => {
    // 1.8125rem at the 16px root.
    expect(light("external-fkas-private").tokens["radius-button"].value).toBe(29);
    expect(light("external-fkas-private").tokens["font-heading"]).toMatchObject({
      kind: "fontFamily",
      reference: undefined,
      value: "Neo Sans",
    });
    expect(light("external-elma-company").tokens["font-heading"]).toMatchObject({
      css: "var(--font-sans)",
      reference: { space: "token", name: "font-sans" },
      value: "Roboto",
    });
  });

  it("gives each token its var() and each rung its calc() as code syntax", () => {
    expect(light("external-fkas-private").tokens.primary.codeSyntax).toBe("var(--primary)");
    expect(light("external-fkas-private").rungs["radius-md"].codeSyntax).toBe(
      "calc(var(--radius) - var(--radius-step))"
    );
    expect(light("external-fkas-private").rungs["radius-lg"].codeSyntax).toBe("var(--radius)");
  });

  it("gives each density metric its px per density", () => {
    // fuse.css: --control-h-md is 2.25rem on :root and 2.75rem when comfortable.
    expect(catalog.density.find((metric) => metric.name === "control-h-md")).toEqual({
      name: "control-h-md",
      metricKind: "height",
      codeSyntax: "var(--control-h-md)",
      px: { dense: 36, comfortable: 44 },
    });
    expect(catalog.density.find((metric) => metric.name === "control-leading")).toMatchObject({
      metricKind: "lineHeight",
      px: { dense: 20, comfortable: 24 },
    });
  });

  it("resolves afresh on every call", () => {
    expect(resolveThemeCatalog()).not.toBe(catalog);
  });
});
