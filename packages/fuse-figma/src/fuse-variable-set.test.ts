import { Result } from "effect";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { compileUtilities } from "./components/utility-css.ts";
import { fuseVariableSet } from "./fuse-variable-set.ts";
import type { CollectionSpec, VariableSet, VariableSpec, VariableValue } from "./variable-set.ts";

let built: VariableSet | undefined;

/** The Fuse variable set, built on the first lookup and shared by every test in the file. */
function variableSet(): VariableSet {
  if (built === undefined) {
    const result = fuseVariableSet();
    if (Result.isFailure(result)) throw new Error(result.failure.message);
    built = result.success;
  }
  return built;
}

function collection(name: string): CollectionSpec {
  const found = variableSet().collections.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`no collection ${name}`);
  return found;
}

function spec(collectionName: string, variable: string): VariableSpec | undefined {
  return collection(collectionName).variables.find((candidate) => candidate.name === variable);
}

function value(collectionName: string, variable: string, mode: string): VariableValue | undefined {
  return spec(collectionName, variable)?.values.get(mode);
}

const px = (value: number): VariableValue => ({ _tag: "Float", value });

const alias = (collectionName: string, variable: string): VariableValue => ({
  _tag: "Alias",
  target: { collection: collectionName, variable },
});

describe("fuseVariableSet", () => {
  it("chains every bound variable through variant, segment and brand", () => {
    expect(value("Fuse tokens", "primary", "Dark")).toEqual(alias("Fuse variant", "dark/primary"));
    expect(value("Fuse variant", "dark/primary", "External")).toEqual(
      alias("Fuse segment", "dark/external/primary")
    );
    expect(value("Fuse segment", "dark/external/primary", "Company")).toEqual(
      alias("Fuse brand", "dark/external/company/primary")
    );
    // A rung takes the same four hops, though only the variant changes its value.
    expect(value("Fuse tokens", "radius-md", "Light")).toEqual(alias("Fuse variant", "light/radius-md"));
    expect(value("Fuse segment", "light/internal/radius-md", "Private")).toEqual(
      alias("Fuse brand", "light/internal/private/radius-md")
    );
  });

  it("writes each kind's resolved literal in its Figma form", () => {
    // `#5c6773` in DEFAULTS is a hex literal, not oklch.
    expect(value("Fuse brand", "light/internal/private/sh-identifier", "Fjordkraft")).toEqual({
      _tag: "Color",
      color: { r: 0x5c / 255, g: 0x67 / 255, b: 0x73 / 255, a: 1 },
    });
    // The internal dark field border is white at 40% alpha, which Figma keeps as `a`.
    expect(value("Fuse brand", "dark/internal/private/input", "Fjordkraft")).toEqual({
      _tag: "Color",
      color: { r: 1, g: 1, b: 1, a: 0.4 },
    });
    expect(value("Fuse brand", "light/external/private/radius-button", "Fjordkraft")).toEqual(px(29));
    expect(value("Fuse brand", "light/external/private/font-heading", "Fjordkraft")).toEqual({
      _tag: "String",
      value: "Neo Sans",
    });
    expect(spec("Fuse tokens", "primary")).toMatchObject({
      type: "COLOR",
      scopes: ["ALL_FILLS", "STROKE_COLOR"],
    });
    expect(spec("Fuse tokens", "radius")).toMatchObject({ type: "FLOAT", scopes: ["CORNER_RADIUS"] });
    expect(spec("Fuse tokens", "radius-step")).toMatchObject({ type: "FLOAT", scopes: [] });
    expect(spec("Fuse tokens", "button-outline-width")).toMatchObject({
      type: "FLOAT",
      scopes: ["STROKE_FLOAT"],
    });
    expect(value("Fuse brand", "light/external/private/button-outline-width", "Fjordkraft")).toEqual(px(2));
    expect(value("Fuse brand", "light/internal/private/button-outline-width", "Fjordkraft")).toEqual(px(1));
    expect(spec("Fuse tokens", "font-sans")).toMatchObject({ type: "STRING", scopes: ["FONT_FAMILY"] });
    // A font weight syncs as a FLOAT variable that only the font weight picker offers, and
    // keeps its value in both schemes. A real file stores that picker's scope as FONT_STYLE.
    expect(spec("Fuse tokens", "selection-title-weight")).toMatchObject({
      type: "FLOAT",
      scopes: ["FONT_STYLE"],
    });
    for (const scheme of ["light", "dark"]) {
      expect(value("Fuse brand", `${scheme}/external/private/selection-title-weight`, "Fjordkraft")).toEqual(
        px(500)
      );
      expect(value("Fuse brand", `${scheme}/internal/private/selection-title-weight`, "Fjordkraft")).toEqual(
        px(400)
      );
    }
    // A paragraph line height syncs as a FLOAT the line height picker offers, kept in both
    // schemes: the external 16/22 paragraph style and the internal relaxed 1.625 × 16px.
    expect(spec("Fuse tokens", "paragraph-leading-base")).toMatchObject({
      type: "FLOAT",
      scopes: ["LINE_HEIGHT"],
    });
    for (const scheme of ["light", "dark"]) {
      expect(value("Fuse brand", `${scheme}/external/private/paragraph-leading-base`, "Fjordkraft")).toEqual(
        px(22)
      );
      expect(value("Fuse brand", `${scheme}/internal/private/paragraph-leading-base`, "Fjordkraft")).toEqual(
        px(26)
      );
    }
    // An h1's heading scale syncs as FLOATs the font size, line height and font weight pickers
    // offer, kept in both schemes: the external bold heading small, 24/32 at 700, and the
    // internal 24px at the snug 1.375 ratio, 33px, at 500.
    expect(spec("Fuse tokens", "heading-1-size")).toMatchObject({ type: "FLOAT", scopes: ["FONT_SIZE"] });
    expect(spec("Fuse tokens", "heading-1-leading")).toMatchObject({
      type: "FLOAT",
      scopes: ["LINE_HEIGHT"],
    });
    expect(spec("Fuse tokens", "heading-1-weight")).toMatchObject({ type: "FLOAT", scopes: ["FONT_STYLE"] });
    for (const scheme of ["light", "dark"]) {
      for (const [name, external, internal] of [
        ["heading-1-size", 24, 24],
        ["heading-1-leading", 32, 33],
      ] as const) {
        expect(value("Fuse brand", `${scheme}/external/private/${name}`, "Fjordkraft"), name).toEqual(
          px(external)
        );
        expect(value("Fuse brand", `${scheme}/internal/private/${name}`, "Fjordkraft"), name).toEqual(
          px(internal)
        );
      }
      expect(value("Fuse brand", `${scheme}/external/private/heading-1-weight`, "Fjordkraft")).toEqual(
        px(700)
      );
      expect(value("Fuse brand", `${scheme}/internal/private/heading-1-weight`, "Fjordkraft")).toEqual(
        px(500)
      );
    }
  });

  it("syncs each role tint as its role's color at the tint's alpha, with Tailwind's color-mix()", () => {
    // The Button recipe fills with bg-error/10 and strokes with border-error/20, as error does.
    expect(spec("Fuse tokens", "error/10")).toMatchObject({
      type: "COLOR",
      scopes: ["ALL_FILLS", "STROKE_COLOR"],
      webSyntax: "color-mix(in oklab, var(--error) 10%, transparent)",
    });
    expect(spec("Fuse tokens", "error/10")?.description).toMatch(/^error at 10% opacity/);
    expect(value("Fuse tokens", "error/10", "Light")).toEqual(alias("Fuse variant", "light/error/10"));
    expect(value("Fuse segment", "dark/external/success/20", "Company")).toEqual(
      alias("Fuse brand", "dark/external/company/success/20")
    );
    // A tint holds a literal even where its role is one, since an alias cannot change alpha.
    // The role is pinned first: Fjordkraft's internal light theme takes `:root`'s
    // `--error: oklch(0.4526 0.17845 30.42)` in themes.css, which is sRGB 0.6353 0.0588 0.0038
    // through the OKLab reference matrices, worked by hand.
    const role = value("Fuse brand", "light/internal/private/error", "Fjordkraft");
    if (role?._tag !== "Color") throw new Error("the internal light error role is no literal color");
    expect(role.color.r).toBeCloseTo(0.6353, 3);
    expect(role.color.g).toBeCloseTo(0.0588, 3);
    expect(role.color.b).toBeCloseTo(0.0038, 3);
    expect(role.color.a).toBe(1);
    // A cross-check, not a tautology: the unit under test is the tint derivation, and its oracle
    // is the role it derives from, at the tint's alpha.
    expect(value("Fuse brand", "light/internal/private/error/10", "Fjordkraft")).toEqual({
      _tag: "Color",
      color: { ...role.color, a: 0.1 },
    });
  });

  // A cross-check: the unit under test is each tint's code syntax, pickers and values. The oracles
  // are Tailwind, whose compiled utility the code syntax must equal, TOKEN_PAINTS, which gives the
  // role's pickers, and the role's own color in every theme at the tint's share of its alpha. The
  // compiled rule's last declaration of the property is the `color-mix()` in its `@supports`
  // block, which wins over the fallback before it.
  it("syncs the tints the soft Badges, the muted Item, the Alerts, the Sidebar group label and the popups paint with", async () => {
    // TOKEN_PAINTS: warning, info, error, success and foreground are surfaces, inks and lines,
    // muted is a surface and a line, and sidebar-foreground is an ink.
    const strokes = ["ALL_FILLS", "STROKE_COLOR"] as const;
    const tints = [
      { utility: "border-warning/20", role: "warning", tint: "warning/20", share: 0.2, scopes: strokes },
      { utility: "border-info/20", role: "info", tint: "info/20", share: 0.2, scopes: strokes },
      {
        utility: "bg-muted/50",
        role: "muted",
        tint: "muted/50",
        share: 0.5,
        scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
      },
      { utility: "bg-error/5", role: "error", tint: "error/5", share: 0.05, scopes: strokes },
      { utility: "bg-success/5", role: "success", tint: "success/5", share: 0.05, scopes: strokes },
      {
        utility: "text-sidebar-foreground/70",
        role: "sidebar-foreground",
        tint: "sidebar-foreground/70",
        share: 0.7,
        scopes: ["TEXT_FILL", "SHAPE_FILL", "STROKE_COLOR"],
      },
      // The ring around every popup.
      {
        utility: "border-foreground/10",
        role: "foreground",
        tint: "foreground/10",
        share: 0.1,
        scopes: strokes,
      },
    ] as const;
    const compiled = await compileUtilities(tints.map(({ utility }) => utility));
    const brand = collection("Fuse brand");
    for (const { utility, role, tint, share, scopes } of tints) {
      const mix = compiled.rules
        .get(utility)
        ?.declarations.findLast((declaration) =>
          /^((border|background)-)?color$/.test(declaration.property)
        )?.value;
      expect(mix, utility).toBeDefined();
      expect(spec("Fuse tokens", tint)).toMatchObject({ type: "COLOR", scopes, webSyntax: mix });
      const leaves = brand.variables.filter((variable) => variable.name.endsWith(`/${tint}`));
      // Two schemes, two variants and two segments.
      expect(leaves, tint).toHaveLength(8);
      for (const leaf of leaves) {
        for (const mode of brand.modes) {
          const solid = value("Fuse brand", `${leaf.name.slice(0, -tint.length)}${role}`, mode);
          if (solid?._tag !== "Color")
            throw new Error(`${leaf.name} in ${mode}: the role is no literal color`);
          const mixed = leaf.values.get(mode);
          if (mixed?._tag !== "Color") throw new Error(`${leaf.name} in ${mode} is no literal color`);
          expect({ ...mixed.color, a: 0 }, `${leaf.name} in ${mode}`).toEqual({ ...solid.color, a: 0 });
          expect(mixed.color.a, `${leaf.name} in ${mode}`).toBeCloseTo(solid.color.a * share, 12);
        }
      }
    }
  });

  it("syncs input/50, which a disabled field box fills with, in input's pickers", () => {
    // TOKEN_PAINTS gives input the surface and line paints, so the frame and shape fill pickers
    // and the stroke picker offer it.
    expect(spec("Fuse tokens", "input/50")).toMatchObject({
      type: "COLOR",
      scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
      webSyntax: "color-mix(in oklab, var(--input) 50%, transparent)",
    });
    // themes.css: the internal dark input is oklch(1 0 0 / 40%), white at 40%, so half of it is
    // white at 20%.
    expect(value("Fuse brand", "dark/internal/private/input/50", "Fjordkraft")).toEqual({
      _tag: "Color",
      color: { r: 1, g: 1, b: 1, a: 0.2 },
    });
  });

  it("syncs the outline shadow lengths as their formulas give them for each outline width", () => {
    expect(spec("Fuse tokens", "button-outline-shadow-blur")).toMatchObject({
      type: "FLOAT",
      scopes: ["EFFECT_FLOAT"],
      webSyntax: "max(0px, 4px - 2 * var(--button-outline-width, 1px))",
    });
    expect(spec("Fuse tokens", "button-outline-shadow-spread")?.webSyntax).toBe(
      "min(0px, 2px - 2 * var(--button-outline-width, 1px))"
    );
    // themes.css: internal themes draw a 1px outline, which casts Tailwind's shadow-xs, 0 1px 2px.
    expect(value("Fuse brand", "light/internal/private/button-outline-width", "Fjordkraft")).toEqual(px(1));
    expect(value("Fuse brand", "light/internal/private/button-outline-shadow-blur", "Fjordkraft")).toEqual(
      px(2)
    );
    expect(value("Fuse brand", "light/internal/private/button-outline-shadow-spread", "Fjordkraft")).toEqual(
      px(0)
    );
    // External themes draw 2px, where the shadow has no blur and shrinks inside the border box.
    expect(value("Fuse brand", "dark/external/company/button-outline-width", "Elmera")).toEqual(px(2));
    expect(value("Fuse brand", "dark/external/company/button-outline-shadow-blur", "Elmera")).toEqual(px(0));
    expect(value("Fuse brand", "dark/external/company/button-outline-shadow-spread", "Elmera")).toEqual(
      px(-2)
    );
  });

  it("syncs the compact corner as its formula gives it for each theme's radius", () => {
    expect(spec("Fuse tokens", "radius-compact")).toMatchObject({
      type: "FLOAT",
      scopes: ["CORNER_RADIUS"],
      webSyntax:
        "min(calc(var(--radius) - var(--radius-step, 0px)), max(10px, var(--radius) - 1000 * var(--radius-step, 0px)))",
    });
    // themes.css: internal themes set --radius 0.5rem and step 0px, so the corner is --radius.
    expect(value("Fuse brand", "light/internal/private/radius-compact", "Fjordkraft")).toEqual(px(8));
    // External themes step 2px, so the corner is min(radius - 2px, 10px). Elmera sets 0.375rem,
    // 6px, under the cap, and TrøndelagKraft sets 1rem, 16px, over it.
    expect(value("Fuse brand", "dark/external/company/radius-compact", "Elmera")).toEqual(px(4));
    expect(value("Fuse brand", "light/external/private/radius-compact", "TrøndelagKraft")).toEqual(px(10));
  });

  it("syncs the checkbox corner as its formula gives it for each theme's radius", () => {
    expect(spec("Fuse tokens", "radius-checkbox")).toMatchObject({
      type: "FLOAT",
      scopes: ["CORNER_RADIUS"],
      webSyntax: "min(calc(var(--radius) - var(--radius-step, 0px)), 4px)",
    });
    // themes.css: the corner is radius-md, radius - step, capped at 4px. Fjordkraft's internal
    // theme sets 0.5rem and steps 0px, so radius-md is 8px. Elmera's external theme sets 0.375rem
    // and steps 2px, so radius-md is 4px, at the cap. TrøndelagKraft's sets 1rem, so radius-md is
    // 14px. Every theme's radius-md reaches the cap.
    expect(value("Fuse brand", "light/internal/private/radius-checkbox", "Fjordkraft")).toEqual(px(4));
    expect(value("Fuse brand", "dark/external/company/radius-checkbox", "Elmera")).toEqual(px(4));
    expect(value("Fuse brand", "light/external/private/radius-checkbox", "TrøndelagKraft")).toEqual(px(4));
  });

  it("syncs the field box corner as its clamp gives it for each theme's radius", () => {
    expect(spec("Fuse tokens", "radius-field-box")).toMatchObject({
      type: "FLOAT",
      scopes: ["CORNER_RADIUS"],
      webSyntax:
        "clamp(var(--radius) - 1000 * var(--radius-step, 0px), var(--radius-field, var(--radius)), var(--radius) + 1000 * var(--radius-step, 0px))",
    });
    // themes.css, through clamp(radius - 1000 * step, radius-field, radius + 1000 * step).
    // Fjordkraft's internal theme sets 0.5rem and steps 0px, so both bounds are 8px and the corner
    // is radius. External themes step 2px, so the bounds lie 4000px apart and the corner is
    // radius-field, which every theme aliases to radius: 0.375rem, 6px, for Elmera and 1rem, 16px,
    // for TrøndelagKraft. Their radius-md is 4px and 14px.
    expect(value("Fuse brand", "light/internal/private/radius-field-box", "Fjordkraft")).toEqual(px(8));
    expect(value("Fuse brand", "dark/external/company/radius-field-box", "Elmera")).toEqual(px(6));
    expect(value("Fuse brand", "light/external/private/radius-field-box", "TrøndelagKraft")).toEqual(px(16));
  });

  it("syncs the corner inside a radius-lg shell padded 8px as its formula gives it for each theme", () => {
    // The floating Sidebar's group in the icon rail pads p-2 and publishes radius-lg less
    // 2 * --spacing. Tailwind's --spacing is 0.25rem, which the code syntax spells out, since the
    // kit's builder reads Tailwind's own variables as their values.
    expect(spec("Fuse tokens", "radius-inner/lg-pad-8px")).toMatchObject({
      type: "FLOAT",
      scopes: ["CORNER_RADIUS"],
      webSyntax: "max(0px, var(--radius) - 2 * 0.25rem)",
    });
    expect(spec("Fuse tokens", "radius-inner/lg-pad-8px")?.description).toMatch(
      /Figma variables cannot compute, so the sync writes the result for each theme\.$/
    );
    // themes.css: radius-lg is --radius. Fjordkraft's internal theme sets 0.5rem, 8px, which
    // leaves 0. Its external theme sets 0.75rem, 12px, and TrøndelagKraft's 1rem, 16px, which
    // leave 4px and 8px. Elmera's 0.375rem, 6px, leaves 0.
    expect(value("Fuse brand", "light/internal/private/radius-inner/lg-pad-8px", "Fjordkraft")).toEqual(
      px(0)
    );
    expect(value("Fuse brand", "light/external/private/radius-inner/lg-pad-8px", "Fjordkraft")).toEqual(
      px(4)
    );
    expect(value("Fuse brand", "dark/external/company/radius-inner/lg-pad-8px", "TrøndelagKraft")).toEqual(
      px(8)
    );
    expect(value("Fuse brand", "light/external/company/radius-inner/lg-pad-8px", "Elmera")).toEqual(px(0));
  });

  it("syncs each formula over density metrics as a density metric of its own", () => {
    // fuse.css: --surface-pad-lg is 1rem dense and 1.5rem comfortable, --surface-gap-lg 1rem and
    // 1.5rem, and --label-text 0.875rem and 1rem. Tailwind's --spacing is 0.25rem and
    // --leading-snug 1.375, which the code syntax spells out, since the kit's builder reads
    // Tailwind's own variables as their values.
    const formulas = [
      // Empty pads twice the large surface tier on a desktop window.
      {
        name: "empty-pad-desktop",
        webSyntax: "calc(2 * var(--surface-pad-lg))",
        scopes: ["GAP"],
        dense: 32,
        comfortable: 48,
      },
      // An open Accordion panel sits the large surface gap plus 6px below its trigger.
      {
        name: "accordion-panel-pt",
        webSyntax: "calc(var(--surface-gap-lg) + calc(0.25rem * 1.5))",
        scopes: ["GAP"],
        dense: 22,
        comfortable: 30,
      },
      // An Alert's icon box beside a description is one snug line of label text tall.
      {
        name: "label-line-snug",
        webSyntax: "calc(var(--label-text) * 1.375)",
        scopes: ["WIDTH_HEIGHT"],
        dense: 19.25,
        comfortable: 22,
      },
      // A menu row keeps room for its 16px indicator and the 8px gap beside it: --row-px is
      // 0.5rem dense and 0.75rem comfortable.
      {
        name: "row-indicator-room",
        webSyntax: "calc(var(--row-px) + 1.5rem)",
        scopes: ["GAP"],
        dense: 32,
        comfortable: 36,
      },
      // An Input group addon beside a button pads its outer side by the md control icon inset less
      // the 4px its negative margin takes back: --control-px-icon-md is 0.5rem dense and 0.75rem
      // comfortable.
      {
        name: "addon-px-button",
        webSyntax: "calc(var(--control-px-icon-md) - 0.25rem)",
        scopes: ["GAP"],
        dense: 4,
        comfortable: 8,
      },
    ] as const;
    for (const { name, webSyntax, scopes, dense, comfortable } of formulas) {
      expect(spec("Fuse density", name)).toMatchObject({ type: "FLOAT", scopes, webSyntax });
      expect(spec("Fuse density", name)?.description).toMatch(
        /Figma variables cannot compute, so the sync writes the result for each density\.$/
      );
      expect(value("Fuse density", name, "Dense")).toEqual(px(dense));
      expect(value("Fuse density", name, "Comfortable")).toEqual(px(comfortable));
      // Auto follows the variant as the metrics do: internal themes deploy dense and external
      // themes comfortable.
      expect(value("Fuse density", name, "Auto")).toEqual(alias("Fuse variant", `density/${name}`));
      expect(value("Fuse variant", `density/${name}`, "Internal")).toEqual(px(dense));
      expect(value("Fuse variant", `density/${name}`, "External")).toEqual(px(comfortable));
    }
  });

  it("offers each formula over theme tokens and density metrics in Fuse density, and hides its per-density values", () => {
    // Each corner is what a shell's `--shell-inner` compiles to, which `rounded-inner` reads.
    const formulas = [
      // A default Accordion item.
      [
        "radius-inner/sm-pad-md",
        "max(0px, calc(var(--radius) - 2 * var(--radius-step, 0px)) - var(--surface-pad-md))",
      ],
      // A Toast, and an Accordion item with the lg radius.
      ["radius-inner/lg-pad-md", "max(0px, var(--radius) - var(--surface-pad-md))"],
      // An Accordion item with the xl radius.
      [
        "radius-inner/xl-pad-md",
        "max(0px, calc(var(--radius) + 2 * var(--radius-step, 0px)) - var(--surface-pad-md))",
      ],
      // A card Accordion item and a SelectionItem.
      ["radius-inner/lg-border-pad-md", "max(0px, var(--radius) - 1px - var(--surface-pad-md))"],
      // A card Accordion item with the xl radius.
      [
        "radius-inner/xl-border-pad-md",
        "max(0px, calc(var(--radius) + 2 * var(--radius-step, 0px)) - 1px - var(--surface-pad-md))",
      ],
      // A floating Sidebar's header, footer or group, and Select.Group.
      ["radius-inner/lg-pad-sm", "max(0px, var(--radius) - var(--surface-pad-sm))"],
      // The DropdownMenu popups and Combobox.List.
      [
        "radius-inner/md-pad-sm",
        "max(0px, calc(var(--radius) - var(--radius-step, 0px)) - var(--surface-pad-sm))",
      ],
      // Command.List.
      [
        "radius-inner/xl-gap-sm",
        "max(0px, calc(var(--radius) + 2 * var(--radius-step, 0px)) - var(--surface-gap-sm))",
      ],
      // The button in an Input group addon: the field corner less its 1px border and the addon's
      // padding beside a button.
      [
        "radius-inner/field-border-pad-addon-button",
        "max(0px, clamp(var(--radius) - 1000 * var(--radius-step, 0px), var(--radius-field, var(--radius)), var(--radius) + 1000 * var(--radius-step, 0px)) - 1px - var(--control-px-icon-md) + 0.25rem)",
      ],
    ] as const;
    for (const [name, webSyntax] of formulas) {
      expect(spec("Fuse density", name)).toMatchObject({
        type: "FLOAT",
        scopes: ["CORNER_RADIUS"],
        webSyntax,
      });
      expect(spec("Fuse density", name)?.description).toMatch(
        /Figma variables cannot compute, so the sync writes the result for each theme and density\.$/
      );
      // No picker offers the values behind each density mode, and they carry no code.
      for (const mode of ["auto", "dense", "comfortable"]) {
        expect(spec("Fuse tokens", `${name}/${mode}`)).toMatchObject({
          type: "FLOAT",
          scopes: [],
          webSyntax: undefined,
          description: "",
        });
      }
    }
  });

  it("turns var() references into aliases at the same theme path or to primitives", () => {
    expect(value("Fuse brand", "dark/external/private/destructive", "Gudbrandsdal Energi")).toEqual(
      alias("Fuse brand", "dark/external/private/error")
    );
    expect(value("Fuse brand", "light/external/company/brand", "Fjordkraft Företag (company only)")).toEqual(
      alias("Fuse primitives", "brand-fkab")
    );
    // fkab shares Fjordkraft's accent by policy.
    expect(value("Fuse primitives", "brand-fkab", "Value")).toEqual(alias("Fuse primitives", "brand-fkas"));
    // The external outline Button rings in the text color, and internal themes keep the
    // border role's hairline.
    expect(value("Fuse brand", "dark/external/private/button-outline", "TrøndelagKraft")).toEqual(
      alias("Fuse brand", "dark/external/private/foreground")
    );
    expect(value("Fuse brand", "light/internal/private/button-outline", "TrøndelagKraft")).toEqual(
      alias("Fuse brand", "light/internal/private/border")
    );
  });

  it("gives Auto density the variant's default density and keeps Dense and Comfortable literal", () => {
    // fuse.css: --control-h-md is 2.25rem on :root and 2.75rem when comfortable. Apps deploy
    // internal themes dense and external themes comfortable.
    expect(value("Fuse density", "control-h-md", "Auto")).toEqual(
      alias("Fuse variant", "density/control-h-md")
    );
    expect(value("Fuse variant", "density/control-h-md", "Internal")).toEqual(px(36));
    expect(value("Fuse variant", "density/control-h-md", "External")).toEqual(px(44));
    expect(value("Fuse density", "control-h-md", "Dense")).toEqual(px(36));
    expect(value("Fuse density", "control-h-md", "Comfortable")).toEqual(px(44));
    expect(spec("Fuse variant", "density/control-h-md")).toMatchObject({ scopes: [], webSyntax: undefined });
  });
});

// The package's `test` task depends on `@elmeragroup/fuse#build` in turbo.json, so the built
// stylesheets exist in CI. A missing file fails the test instead of skipping it.
const FUSE_DIST = fileURLToPath(new URL("../node_modules/@elmeragroup/fuse/dist/", import.meta.url));
const SHIPPED_STYLESHEETS = ["styles.css", "themes.css"].map((file) => `${FUSE_DIST}${file}`);

/** The custom properties a stylesheet declares, without their leading dashes. */
function declaredProperties(css: string): ReadonlySet<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set(Array.from(withoutComments.matchAll(/--([\w-]+)\s*:/g), (match) => match[1] ?? ""));
}

/** The custom properties a CSS value reads through `var()`, without their leading dashes. */
function referencedProperties(css: string): readonly string[] {
  return Array.from(css.matchAll(/var\(\s*--([\w-]+)/g), (match) => match[1] ?? "");
}

describe("web code syntax", () => {
  // In this cross-check, the unit under test is the code syntax fuseVariableSet gives each
  // variable, and the oracle is the built styles.css and themes.css. A developer pastes the
  // syntax into code that loads those sheets, so every var() in it must name a property they
  // declare.
  it("reads only custom properties that the shipped stylesheets declare", () => {
    for (const path of SHIPPED_STYLESHEETS) {
      expect(existsSync(path), `${path} is missing. Build @elmeragroup/fuse first.`).toBe(true);
    }
    const declared = declaredProperties(
      SHIPPED_STYLESHEETS.map((path) => readFileSync(path, "utf8")).join("\n")
    );
    const references = variableSet().collections.flatMap((spec) =>
      spec.variables.flatMap((variable) =>
        referencedProperties(variable.webSyntax ?? "").map((name) => ({
          variable: `${spec.name}/${variable.name}`,
          name,
        }))
      )
    );

    expect(references.map((reference) => reference.name)).toEqual(
      expect.arrayContaining(["primary", "brand-fkas", "radius", "radius-step", "control-h-md"])
    );
    expect(references.filter((reference) => !declared.has(reference.name))).toEqual([]);
  });
});
