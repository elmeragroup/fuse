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
  "internal-ngfi-private",
  "internal-ngfi-company",
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
  "external-ngfi-private",
  "external-ngfi-company",
] as const;

// Counts the derived `secondary-hover` role, the `radius-step` rung spacing, the
// `radius-field` field corner, the card edge, section divider and shadow, the two outline Button roles, the resting and
// checked selection row borders and dividers, the disabled selection row fill, stripe and text,
// the pressed Toggle fill and label, the selection row title weight, the three paragraph line
// heights, the size, line height and weight of h1 to h3 and the modal fill and text.
const TOKEN_COUNT = 109;

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

/**
 * An entry's fields other than its description, for the tests that pin an entry's values. The
 * descriptions are prose, and the description test checks them.
 */
function withoutDescription<E extends { readonly description: string }>(
  entry: E | undefined
): Omit<E, "description"> | undefined {
  if (entry === undefined) return undefined;
  const { description: _description, ...rest } = entry;
  return rest;
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
    expect(withoutDescription(light("external-fkas-private").rungs["radius-md"])).toEqual({
      name: "radius-md",
      kind: "dimension",
      css: "calc(var(--radius) - var(--radius-step, 0px))",
      codeSyntax: "calc(var(--radius) - var(--radius-step, 0px))",
      reference: undefined,
      value: 10,
    });
    expect(theme("external-fkas-private").schemes.dark.rungs["radius-xl"].value).toBe(16);
    // external-tkas-private sets 1rem, 16px, so radius-xs is 16 - 3 * 2.
    expect(light("external-tkas-private").rungs["radius-xs"].value).toBe(10);
    // Internal themes keep 0.5rem, 8px, and step 0px, so every rung is 8px.
    expect(light("internal-elma-private").rungs["radius-xs"].value).toBe(8);
    expect(light("internal-elma-private").rungs["radius-xl"].value).toBe(8);
    // The popover rung steps four times below --radius: 12 - 4 * 2.
    expect(light("external-fkas-private").rungs["radius-popover"]).toMatchObject({
      css: "calc(var(--radius) - 4 * var(--radius-step, 0px))",
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

    // Gudbrandsdal's accent already reads on the light sidebar, so its sidebar brand keeps
    // the alias.
    const guenAccent = getOrThrow(Oklch.parse("oklch(0.21 0.0399 265.73)"));
    const sidebarBrand = light("external-guen-private").tokens["sidebar-brand"];
    expect(sidebarBrand).toMatchObject({ css: "var(--brand)", reference: { space: "token", name: "brand" } });
    expect(sidebarBrand.value).toEqual(Oklch.toSrgb(guenAccent));

    // The external outline aliases the text color, so the dark hop lands on the dark
    // foreground, #FFEEE6 in the fkas dark sheet.
    const fkasDarkOutline = theme("external-fkas-private").schemes.dark.tokens["button-outline"];
    expect(fkasDarkOutline).toMatchObject({
      css: "var(--foreground)",
      reference: { space: "token", name: "foreground" },
    });
    const fkasDarkForeground = getOrThrow(Oklch.parse("oklch(0.9604175 0.0214022 46.9889)"));
    expect(fkasDarkOutline.value).toEqual(Oklch.toSrgb(fkasDarkForeground));
    // Internal themes keep the hairline in the border role, oklch(0.9219 0 0) in light.
    const internalOutline = light("internal-fkas-private").tokens["button-outline"];
    expect(internalOutline).toMatchObject({
      css: "var(--border)",
      reference: { space: "token", name: "border" },
    });
    expect(internalOutline.value).toEqual(Oklch.toSrgb(getOrThrow(Oklch.parse("oklch(0.9219 0 0)"))));
  });

  it("resolves external fkab-company to the tokens of external fkas-company in both schemes", () => {
    // Unit under test: external-fkab-company. Oracle: external-fkas-company, which fkab
    // aliases by policy, so every token must resolve to the same colour, length or font.
    // Only the brand pointer may name fkab, and it resolves to the fkas accent.
    const fkab = theme("external-fkab-company");
    const fkas = theme("external-fkas-company");
    for (const colorScheme of ["light", "dark"] as const) {
      for (const name of TOKEN_NAMES) {
        const actual = fkab.schemes[colorScheme].tokens[name];
        const oracle = fkas.schemes[colorScheme].tokens[name];
        expect(actual.value, `${colorScheme} ${name}`).toEqual(oracle.value);
        if (name !== "brand" && name !== "brand-foreground") {
          expect(actual.css, `${colorScheme} ${name}`).toBe(oracle.css);
        }
      }
      expect(fkab.schemes[colorScheme].tokens.brand.css).toBe("var(--brand-fkab)");
    }
    // The company sheet's teal brand fills, its secondaries, hand-copied from segment-sheets.ts,
    // anchor the oracle itself to the Bedrift look rather than the orange private palette.
    expect(fkab.schemes.light.tokens.secondary.css).toBe("oklch(0.47471 0.07313 217.18)");
    expect(fkab.schemes.dark.tokens.secondary.css).toBe("oklch(0.9085589 0.0595841 225.0316)");
  });

  it("reads colours as unrounded sRGB", () => {
    // `#5c6773` in DEFAULTS is a hex literal, not oklch.
    expect(light("internal-fkas-private").tokens["sh-identifier"]).toMatchObject({
      css: "#5c6773",
      reference: undefined,
      value: { r: 0x5c / 255, g: 0x67 / 255, b: 0x73 / 255, alpha: 1 },
    });
    // INTERNAL_DARK_PALETTE writes the field border as white at 40% alpha, and the alpha survives.
    expect(theme("internal-fkas-private").schemes.dark.tokens.input).toMatchObject({
      css: "oklch(1 0 0 / 40%)",
      reference: undefined,
      value: { r: 1, g: 1, b: 1, alpha: 0.4 },
    });
  });

  it("resolves the external selection row edge to a zero-alpha colour and its divider to the border, in both schemes", () => {
    // EXTERNAL_VARIANT_LAYER writes the edge as `oklch(0 0 0 / 0)` and aliases the checked edge
    // to it, so design tools get a transparent colour, not a `transparent` keyword they cannot read.
    for (const scheme of ["light", "dark"] as const) {
      const tokens = theme("external-tkas-company").schemes[scheme].tokens;
      expect(tokens["selection-border"], scheme).toMatchObject({
        css: "oklch(0 0 0 / 0)",
        reference: undefined,
        value: { alpha: 0 },
      });
      expect(tokens["selection-checked-border"], scheme).toMatchObject({
        css: "var(--selection-border)",
        reference: { space: "token", name: "selection-border" },
        value: { alpha: 0 },
      });
    }
    // The divider between stacked external rows is the scheme's own opaque border: fkas
    // oklch(0.898 0.0026 48.72) in light and the shared dark border oklch(0.3956915 0.0031178
    // 164.9356) in dark.
    const fkas = theme("external-fkas-private").schemes;
    for (const [scheme, border] of [
      ["light", "oklch(0.898 0.0026 48.72)"],
      ["dark", "oklch(0.3956915 0.0031178 164.9356)"],
    ] as const) {
      expect(fkas[scheme].tokens["selection-divider"], scheme).toMatchObject({
        css: "var(--border)",
        reference: { space: "token", name: "border" },
        value: Oklch.toSrgb(getOrThrow(Oklch.parse(border))),
      });
      expect(fkas[scheme].tokens["selection-divider"].value.alpha, scheme).toBe(1);
      expect(fkas[scheme].tokens["selection-checked-divider"], scheme).toMatchObject({
        css: "var(--selection-divider)",
        reference: { space: "token", name: "selection-divider" },
      });
      expect(fkas[scheme].tokens["selection-checked-divider"].value, scheme).toEqual(
        fkas[scheme].tokens["selection-divider"].value
      );
    }
    expect(fkas.light.tokens["selection-divider"].value).not.toEqual(
      fkas.dark.tokens["selection-divider"].value
    );
    // Internal rows keep the border role, oklch(0.9219 0 0) in light.
    expect(light("internal-fkas-private").tokens["selection-border"]).toMatchObject({
      css: "var(--border)",
      reference: { space: "token", name: "border" },
      value: Oklch.toSrgb(getOrThrow(Oklch.parse("oklch(0.9219 0 0)"))),
    });
  });

  it("resolves the external card edge to a zero-alpha colour in both schemes and the internal one to the border", () => {
    // EXTERNAL_VARIANT_LAYER writes the edge as `oklch(0 0 0 / 0)`, a light-only key that dark keeps.
    for (const scheme of ["light", "dark"] as const) {
      expect(theme("external-fkse-private").schemes[scheme].tokens["card-border"], scheme).toMatchObject({
        css: "oklch(0 0 0 / 0)",
        reference: undefined,
        value: { alpha: 0 },
      });
    }
    // Internal cards keep the border role, oklch(0.9219 0 0) in light.
    expect(light("internal-fkas-private").tokens["card-border"]).toMatchObject({
      css: "var(--border)",
      reference: { space: "token", name: "border" },
      value: Oklch.toSrgb(getOrThrow(Oklch.parse("oklch(0.9219 0 0)"))),
    });
  });

  it("resolves the external card shadow to a zero-alpha colour in both schemes and the internal one to 5% black", () => {
    // EXTERNAL_VARIANT_LAYER writes the shadow as `oklch(0 0 0 / 0)`, a light-only key that dark keeps.
    for (const scheme of ["light", "dark"] as const) {
      expect(theme("external-fkse-private").schemes[scheme].tokens["card-shadow"], scheme).toMatchObject({
        css: "oklch(0 0 0 / 0)",
        reference: undefined,
        value: { alpha: 0 },
      });
      // Internal cards keep Tailwind's `shadow-xs` colour, black at 5%, in both schemes.
      expect(theme("internal-fkas-private").schemes[scheme].tokens["card-shadow"], scheme).toMatchObject({
        css: "oklch(0 0 0 / 0.05)",
        reference: undefined,
        value: { r: 0, g: 0, b: 0, alpha: 0.05 },
      });
    }
  });

  it("resolves the external disabled selection row to the card fill, zero-alpha stripes and muted text in both schemes", () => {
    // EXTERNAL_VARIANT_LAYER aliases the fill to `--card` and writes the stripe as `oklch(0 0 0 / 0)`.
    // tkas's card is white in light and #242625, oklch(0.2661671 0.0034366 164.8011), in dark.
    const cards = {
      light: "oklch(1 0 0)",
      dark: "oklch(0.2661671 0.0034366 164.8011)",
    } as const;
    for (const scheme of ["light", "dark"] as const) {
      const tokens = theme("external-tkas-private").schemes[scheme].tokens;
      expect(tokens["selection-disabled-background"], scheme).toMatchObject({
        css: "var(--card)",
        reference: { space: "token", name: "card" },
        value: Oklch.toSrgb(getOrThrow(Oklch.parse(cards[scheme]))),
      });
      expect(tokens["selection-disabled-hatch"], scheme).toMatchObject({
        css: "oklch(0 0 0 / 0)",
        reference: undefined,
        value: { alpha: 0 },
      });
      expect(tokens["selection-disabled-foreground"], scheme).toMatchObject({
        css: "var(--muted-foreground)",
        reference: { space: "token", name: "muted-foreground" },
      });
    }
    // tkas's light muted foreground, the opaque tone #283 holds to 4.5:1.
    expect(light("external-tkas-private").tokens["selection-disabled-foreground"].value).toEqual(
      Oklch.toSrgb(getOrThrow(Oklch.parse("oklch(0.5273 0.03558 190.82)")))
    );
    // Internal disabled text names the foreground role in both schemes.
    for (const scheme of ["light", "dark"] as const) {
      expect(
        theme("internal-fkas-private").schemes[scheme].tokens["selection-disabled-foreground"],
        scheme
      ).toMatchObject({ css: "var(--foreground)", reference: { space: "token", name: "foreground" } });
    }
    // Internal rows keep the muted fill, oklch(0.97 0.0013 106.42) in light, and black stripes
    // at 2% alpha in both schemes.
    expect(light("internal-fkas-private").tokens["selection-disabled-background"]).toMatchObject({
      css: "var(--muted)",
      reference: { space: "token", name: "muted" },
      value: Oklch.toSrgb(getOrThrow(Oklch.parse("oklch(0.97 0.0013 106.42)"))),
    });
    for (const scheme of ["light", "dark"] as const) {
      expect(theme("internal-fkas-private").schemes[scheme].tokens["selection-disabled-hatch"]).toMatchObject(
        {
          css: "oklch(0 0 0 / 0.02)",
          value: { r: 0, g: 0, b: 0, alpha: 0.02 },
        }
      );
    }
  });

  it("resolves the pressed Toggle pair to the muted pair in internal themes and the primary pair in external ones, in both schemes", () => {
    // LAYER_DEFAULTS aliases the pair to `--muted` and `--foreground`, and EXTERNAL_VARIANT_LAYER
    // to `--primary` and `--primary-foreground`. The pair is light-only, so a dark scheme keeps the
    // alias and resolves it against its own dark role. Each colour is the literal its source table
    // writes for that role: internal light from LAYER_DEFAULTS, internal dark from
    // INTERNAL_DARK_PALETTE, external fkas from its light palette and its dark sheet (#FFEEE6 on
    // black).
    for (const [slug, scheme, fill, text] of [
      [
        "internal-fkas-private",
        "light",
        ["muted", "oklch(0.97 0.0013 106.42)"],
        ["foreground", "oklch(0.15 0.0041 49.31)"],
      ],
      ["internal-fkas-private", "dark", ["muted", "oklch(0.269 0 0)"], ["foreground", "oklch(0.985 0 0)"]],
      [
        "external-fkas-private",
        "light",
        ["primary", "oklch(0.3209 0.10325 38.8)"],
        ["primary-foreground", "oklch(1 0 0)"],
      ],
      [
        "external-fkas-private",
        "dark",
        ["primary", "oklch(0.9604175 0.0214022 46.9889)"],
        ["primary-foreground", "oklch(0 0 0)"],
      ],
    ] as const) {
      const tokens = theme(slug).schemes[scheme].tokens;
      for (const [token, [role, literal]] of [
        ["toggle-pressed", fill],
        ["toggle-pressed-foreground", text],
      ] as const) {
        expect(tokens[token], `${slug} ${scheme} ${token}`).toMatchObject({
          css: `var(--${role})`,
          reference: { space: "token", name: role },
          value: Oklch.toSrgb(getOrThrow(Oklch.parse(literal))),
        });
      }
    }
  });

  it("reads dimensions as px and fonts as the first family", () => {
    // 1.8125rem at the 16px root.
    expect(light("external-fkas-private").tokens["radius-button"].value).toBe(29);
    expect(light("external-fkas-private").tokens["button-outline-width"].value).toBe(2);
    expect(light("internal-fkas-private").tokens["button-outline-width"].value).toBe(1);
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

  it("reads the paragraph line heights as px, kept in both schemes", () => {
    // External paragraph styles 14/20, 16/22 and 18/24; internal relaxed 1.625 × 14, 16 and 18.
    const expected = [
      ["paragraph-leading-sm", 20, 22.75],
      ["paragraph-leading-base", 22, 26],
      ["paragraph-leading-lg", 24, 29.25],
    ] as const;
    for (const [name, external, internal] of expected) {
      expect(light("external-fkas-private").tokens[name], name).toMatchObject({
        kind: "dimension",
        codeSyntax: `var(--${name})`,
        value: external,
      });
      expect(theme("external-guen-company").schemes.dark.tokens[name].value, name).toBe(external);
      expect(light("internal-fkas-private").tokens[name].value, name).toBe(internal);
      expect(theme("internal-ngfi-company").schemes.dark.tokens[name].value, name).toBe(internal);
    }
  });

  it("reads the h1 to h3 scale as px and weights, kept in both schemes", () => {
    // External h1 heading small 24/32 and h2 and h3 heading xsmall 20/32, all at 700; internal
    // h1 24px, h2 18px and h3 16px at the snug 1.375 ratio, all at 500.
    const expected = [
      ["heading-1-size", "dimension", 24, 24],
      ["heading-1-leading", "dimension", 32, 33],
      ["heading-1-weight", "fontWeight", 700, 500],
      ["heading-2-size", "dimension", 20, 18],
      ["heading-2-leading", "dimension", 32, 24.75],
      ["heading-2-weight", "fontWeight", 700, 500],
      ["heading-3-size", "dimension", 20, 16],
      ["heading-3-leading", "dimension", 32, 22],
      ["heading-3-weight", "fontWeight", 700, 500],
    ] as const;
    for (const [name, kind, external, internal] of expected) {
      expect(light("external-fkas-private").tokens[name], name).toMatchObject({
        kind,
        codeSyntax: `var(--${name})`,
        value: external,
      });
      expect(theme("external-guen-company").schemes.dark.tokens[name].value, name).toBe(external);
      expect(light("internal-fkas-private").tokens[name].value, name).toBe(internal);
      expect(theme("internal-ngfi-company").schemes.dark.tokens[name].value, name).toBe(internal);
    }
  });

  it("reads font weights as numbers, kept in both schemes", () => {
    // EXTERNAL_VARIANT_LAYER sets "500" and LAYER_DEFAULTS "400".
    expect(withoutDescription(light("external-fkas-private").tokens["selection-title-weight"])).toEqual({
      name: "selection-title-weight",
      kind: "fontWeight",
      css: "500",
      codeSyntax: "var(--selection-title-weight)",
      reference: undefined,
      value: 500,
    });
    expect(theme("external-guen-company").schemes.dark.tokens["selection-title-weight"].value).toBe(500);
    expect(light("internal-fkas-private").tokens["selection-title-weight"]).toMatchObject({
      kind: "fontWeight",
      css: "400",
      value: 400,
    });
    expect(theme("internal-ngfi-company").schemes.dark.tokens["selection-title-weight"].value).toBe(400);
  });

  it("gives each token its var() and each rung its calc() as code syntax", () => {
    expect(light("external-fkas-private").tokens.primary.codeSyntax).toBe("var(--primary)");
    expect(light("external-fkas-private").rungs["radius-md"].codeSyntax).toBe(
      "calc(var(--radius) - var(--radius-step, 0px))"
    );
    expect(light("external-fkas-private").rungs["radius-lg"].codeSyntax).toBe("var(--radius)");
  });

  it("gives each density metric its px per density", () => {
    // fuse.css: --control-h-md is 2.25rem on :root and 2.75rem when comfortable.
    expect(withoutDescription(catalog.density.find((metric) => metric.name === "control-h-md"))).toEqual({
      name: "control-h-md",
      metricKind: "height",
      role: "control",
      codeSyntax: "var(--control-h-md)",
      px: { dense: 36, comfortable: 44 },
    });
    expect(catalog.density.find((metric) => metric.name === "control-leading")).toMatchObject({
      metricKind: "lineHeight",
      px: { dense: 20, comfortable: 24 },
    });
    // Button's md inset is 0.625rem dense and the reference's 2rem comfortable.
    expect(
      withoutDescription(catalog.density.find((metric) => metric.name === "control-px-button-md"))
    ).toEqual({
      name: "control-px-button-md",
      metricKind: "padding",
      role: "control",
      codeSyntax: "var(--control-px-button-md)",
      px: { dense: 10, comfortable: 32 },
    });
  });

  it("gives the row, surface gap and label metrics their role and px per density", () => {
    // The density design: a row is 32px dense and 36px comfortable, with 6/8px block padding.
    expect(catalog.density.find((metric) => metric.name === "row-h")).toMatchObject({
      metricKind: "height",
      role: "row",
      px: { dense: 32, comfortable: 36 },
    });
    expect(catalog.density.find((metric) => metric.name === "row-py")).toMatchObject({
      metricKind: "padding",
      role: "row",
      px: { dense: 6, comfortable: 8 },
    });
    expect(catalog.density.find((metric) => metric.name === "surface-gap-xl")).toMatchObject({
      metricKind: "gap",
      role: "surface",
      px: { dense: 24, comfortable: 32 },
    });
    expect(catalog.density.find((metric) => metric.name === "label-text")).toMatchObject({
      metricKind: "fontSize",
      role: "label",
      px: { dense: 14, comfortable: 16 },
    });
  });

  it("describes every entry for a designer and gives each color where Fuse paints it", () => {
    const scheme = light("external-fkas-private");
    const entries = [
      ...Object.values(scheme.tokens),
      ...Object.values(scheme.rungs),
      ...Object.values(catalog.primitives),
      ...catalog.density,
    ];
    expect(entries.filter((entry) => entry.description.trim() === "").map((entry) => entry.name)).toEqual([]);
    // CONTEXT.md: feature-foreground is not text-grade, so Fuse never paints text with it.
    expect(scheme.tokens["feature-foreground"].description).toContain("not text-grade");
    expect(scheme.tokens["feature-foreground"].paints).toEqual(["surface"]);
    expect(scheme.tokens.ring.paints).toEqual(["line"]);
    // Only a color carries paints.
    expect(Object.hasOwn(scheme.tokens.radius, "paints")).toBe(false);
    expect(Object.hasOwn(scheme.rungs["radius-md"], "paints")).toBe(false);
    expect(scheme.rungs["radius-md"].description).toContain("One radius-step length below radius");
    // The neutral ramp holds one value in every theme, so Fuse paints nothing with it.
    expect(catalog.primitives["neutral-500"].paints).toEqual([]);
    expect(catalog.primitives["brand-fkas"].paints).toEqual(["surface"]);
    expect(catalog.primitives["brand-fkas-foreground"].paints).toEqual(["ink"]);
    expect(catalog.density.find((metric) => metric.name === "control-h-md")?.description).toContain(
      "size md"
    );
    expect(catalog.density.find((metric) => metric.name === "surface-pad-lg")?.description).toContain(
      "Dialog"
    );
  });

  it("resolves afresh on every call", () => {
    expect(resolveThemeCatalog()).not.toBe(catalog);
  });
});
