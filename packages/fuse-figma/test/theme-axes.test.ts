import { assert, describe, it } from "@effect/vitest";
import { Effect, Runtime } from "effect";
import { isDeepStrictEqual } from "node:util";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";
import type { AnyEntry, ResolvedScheme, ResolvedTheme } from "@elmeragroup/fuse/theme-catalog";

import { dark, FILE_KEY, frame, hex, light, output, run, TOKEN } from "./cli-fixture.ts";
import { InMemoryFigma } from "./in-memory-figma.ts";

/**
 * A catalog literal as the fake file stores it. Figma stores numbers and color channels as
 * 32-bit floats.
 */
function storedForm(entry: AnyEntry): ReturnType<InMemoryFigma["resolve"]> {
  switch (entry.kind) {
    case "color": {
      const { r, g, b, alpha } = entry.value;
      return { r: Math.fround(r), g: Math.fround(g), b: Math.fround(b), a: Math.fround(alpha) };
    }
    case "dimension":
    case "fontWeight":
      return Math.fround(entry.value);
    case "fontFamily":
      return entry.value;
  }
}

/** Every token and synced rung of a theme's scheme, the entries `Fuse tokens` binds. */
function boundEntries(scheme: ResolvedScheme): readonly AnyEntry[] {
  return [
    ...Object.values(scheme.tokens),
    ...Object.values(scheme.rungs).filter((rung) => rung.name !== "radius-popover"),
  ];
}

/**
 * Every place a frame's resolved `Fuse tokens` variable differs from the catalog entry the
 * same theme and scheme hold, for the frame modes `modesFor` picks.
 */
function catalogMismatches(
  figma: InMemoryFigma,
  themes: readonly ResolvedTheme[],
  modesFor: (theme: ResolvedTheme, scheme: "Light" | "Dark") => Record<string, string>
): string[] {
  return themes.flatMap((theme) =>
    (["Light", "Dark"] as const).flatMap((scheme) => {
      const entries = boundEntries(theme.schemes[scheme === "Light" ? "light" : "dark"]);
      const modes = modesFor(theme, scheme);
      return entries
        .filter(
          (entry) => !isDeepStrictEqual(figma.resolve("Fuse tokens", entry.name, modes), storedForm(entry))
        )
        .map((entry) => `${theme.slug} ${scheme} ${entry.name}`);
    })
  );
}

describe("fuse-figma resolving Fuse tokens on a frame", () => {
  it.effect("resolves token values the way a designer's frame sees them", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // Pinned in the docs DTCG export for the same theme.
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("external-elma-company"))),
        "#00313C"
      );
      // Segment changes values only for external fkas and for fkab, which borrows its company palette.
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-company"))),
        "#17343B"
      );
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary-foreground", light("external-fkas-private"))),
        "#FFFFFF"
      );
      assert.strictEqual(figma.resolve("Fuse tokens", "radius", light("external-elma-company")), 6);
      // 1.8125rem at the 16px root.
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-button", light("external-fkas-private")), 29);
      // Fields round with the theme's radius in both variants: 0.75rem for external fkas and
      // 0.5rem internally.
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-field", light("external-fkas-private")), 12);
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-field", light("internal-fkas-private")), 8);
      assert.strictEqual(
        figma.resolve("Fuse tokens", "font-heading", light("external-fkas-private")),
        "Neo Sans"
      );
      assert.strictEqual(
        figma.resolve("Fuse tokens", "font-heading", light("internal-fkas-private")),
        "Roboto"
      );

      // radius-step is 0px in internal themes and 2px in external ones.
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-step", light("internal-fkas-private")), 0);
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-step", light("external-fkas-private")), 2);

      // secondary-hover holds the composed literal, since Figma cannot mix colors. The theme
      // contract test pins oklch(0.929 0.000205 2.4655) light and oklch(0.3048 0 0) dark, which
      // are #E7E7E7 and #2F2F2F in sRGB.
      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "secondary-hover", light("internal-fkas-private")),
        [
          "Fuse tokens/secondary-hover",
          "Fuse variant/light/secondary-hover",
          "Fuse segment/light/internal/secondary-hover",
          "Fuse brand/light/internal/private/secondary-hover",
        ]
      );
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "secondary-hover", light("internal-fkas-private"))),
        "#E7E7E7"
      );
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "secondary-hover", dark("internal-fkas-private"))),
        "#2F2F2F"
      );

      // Internal dark borders are white at 10% opacity, stored as 32-bit floats.
      const border = figma.resolve("Fuse tokens", "border", dark("internal-guen-company"));
      assert.isTrue(border instanceof Object && Math.abs(border.a - 0.1) < 1e-6 && border.r > 0.999);

      // The brand pointer reaches the brand's primitive, the way `var(--brand-tkas)` does in CSS.
      assert.deepStrictEqual(figma.aliasChain("Fuse tokens", "brand", light("internal-tkas-private")), [
        "Fuse tokens/brand",
        "Fuse variant/light/brand",
        "Fuse segment/light/internal/brand",
        "Fuse brand/light/internal/private/brand",
        "Fuse primitives/brand-tkas",
      ]);
      // destructive aliases the error role at the same theme path.
      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "destructive", dark("external-tkas-company")).slice(0, 5),
        [
          "Fuse tokens/destructive",
          "Fuse variant/dark/destructive",
          "Fuse segment/dark/external/destructive",
          "Fuse brand/dark/external/company/destructive",
          "Fuse brand/dark/external/company/error",
        ]
      );
    })
  );

  it.effect("resolves the radius rungs a theme derives from its radius and radius step", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const radius = (name: string, modes: Readonly<Record<string, string>>) =>
        figma.resolve("Fuse tokens", name, modes);

      const rungs = (modes: Readonly<Record<string, string>>) =>
        ["radius-xs", "radius-sm", "radius-md", "radius-lg", "radius-xl"].map((rung) => radius(rung, modes));

      // Internal themes inherit --radius: 0.5rem, 8px, and step 0px, so every rung is 8px.
      assert.deepStrictEqual(rungs(light("internal-fkas-private")), [8, 8, 8, 8, 8]);
      // External themes step 2px. external-fkas-private sets --radius: 0.75rem, 12px at the
      // 16px root, so the rungs are 12 - 3 * 2, 12 - 2 * 2, 12 - 2, 12 and 12 + 2 * 2.
      assert.strictEqual(radius("radius", light("external-fkas-private")), 12);
      assert.deepStrictEqual(rungs(light("external-fkas-private")), [6, 8, 10, 12, 16]);
      // Dark keeps the light radius and step.
      assert.deepStrictEqual(rungs(dark("external-fkas-private")), [6, 8, 10, 12, 16]);
      // external-guen-private sets 0.5rem, 8px.
      assert.deepStrictEqual(rungs(light("external-guen-private")), [2, 4, 6, 8, 12]);
      // external-tkas-private sets 1rem, 16px.
      assert.deepStrictEqual(rungs(light("external-tkas-private")), [10, 12, 14, 16, 20]);
      // No component uses radius-popover, so the sync gives designers no variable for it.
      assert.notInclude(figma.variableNames("Fuse tokens"), "radius-popover");
      assert.notInclude(figma.variableNames("Fuse brand"), "light/internal/private/radius-popover");

      assert.deepStrictEqual(figma.aliasChain("Fuse tokens", "radius-md", dark("internal-tkas-company")), [
        "Fuse tokens/radius-md",
        "Fuse variant/dark/radius-md",
        "Fuse segment/dark/internal/radius-md",
        "Fuse brand/dark/internal/company/radius-md",
      ]);
    })
  );

  it.effect("resolves each density metric in the density a frame sets, whatever its theme", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const metric = (name: string, density: string, theme = "external-fkas-private") =>
        figma.resolve("Fuse density", name, { ...light(theme), "Fuse density": density });

      // fuse.css: --control-h-md is 2.25rem on :root and 2.75rem when comfortable.
      assert.strictEqual(metric("control-h-md", "Dense"), 36);
      assert.strictEqual(metric("control-h-md", "Comfortable"), 44);
      assert.strictEqual(metric("control-h-md", "Dense", "internal-guen-company"), 36);
      assert.strictEqual(metric("control-h-xs", "Dense"), 24);
      assert.strictEqual(metric("control-h-lg", "Comfortable"), 48);
      assert.strictEqual(metric("control-px-xs", "Dense"), 8);
      assert.strictEqual(metric("control-px-md", "Comfortable"), 14);
      assert.strictEqual(metric("control-px-icon-sm", "Dense"), 6);
      assert.strictEqual(metric("control-px-icon-lg", "Comfortable"), 12);
      // Button's own inset: 0.625rem dense, and the reference's 1rem at sm and 2rem at md.
      assert.strictEqual(metric("control-px-button-md", "Dense"), 10);
      assert.strictEqual(metric("control-px-button-sm", "Comfortable"), 16);
      assert.strictEqual(metric("control-px-button-md", "Comfortable"), 32);
      // Its icon edge: 0.5rem dense, three quarters of the label inset comfortable.
      assert.strictEqual(metric("control-px-button-icon-md", "Dense"), 8);
      assert.strictEqual(metric("control-px-button-icon-md", "Comfortable"), 24);
      assert.strictEqual(metric("control-gap-sm", "Dense"), 4);
      assert.strictEqual(metric("control-gap-md", "Comfortable"), 8);
      assert.strictEqual(metric("control-text", "Dense"), 14);
      assert.strictEqual(metric("control-text", "Comfortable"), 18);
      assert.strictEqual(metric("control-leading", "Dense"), 20);
      assert.strictEqual(metric("control-leading", "Comfortable"), 24);
      assert.strictEqual(metric("label-text", "Dense"), 14);
      assert.strictEqual(metric("label-text", "Comfortable"), 16);
      assert.strictEqual(metric("label-leading", "Dense"), 20);
      assert.strictEqual(metric("label-leading", "Comfortable"), 24);
      // A row is 32px dense and 36px comfortable; a table head adds 8px.
      assert.strictEqual(metric("row-h", "Dense"), 32);
      assert.strictEqual(metric("row-h", "Comfortable"), 36);
      assert.strictEqual(metric("row-h-header", "Comfortable"), 44);
      assert.strictEqual(metric("row-px", "Comfortable"), 12);
      assert.strictEqual(metric("row-py", "Dense"), 6);
      // The surface gap tiers step 8/12/16/24px dense and 12/16/24/32px comfortable.
      assert.strictEqual(metric("surface-gap-sm", "Dense"), 8);
      assert.strictEqual(metric("surface-gap-lg", "Comfortable"), 24);
      assert.strictEqual(metric("surface-gap-xl", "Dense"), 24);
      assert.strictEqual(metric("surface-gap-xl", "Comfortable"), 32);
    })
  );

  it.effect("resolves Auto density in the density the frame's variant deploys with", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const auto = (name: string, modes: Readonly<Record<string, string>>) =>
        figma.resolve("Fuse density", name, { ...modes, "Fuse density": "Auto" });

      // Apps deploy external themes comfortable: --control-h-md is 2.75rem, 44px.
      assert.strictEqual(auto("control-h-md", light("external-fkas-private")), 44);
      assert.strictEqual(auto("surface-gap-xl", dark("external-elma-company")), 32);
      // and internal themes dense, 2.25rem.
      assert.strictEqual(auto("control-h-md", light("internal-guen-company")), 36);
      assert.deepStrictEqual(figma.aliasChain("Fuse density", "row-h", { "Fuse variant": "External" }), [
        "Fuse density/row-h",
        "Fuse variant/density/row-h",
      ]);
      // A frame that sets no mode sees each collection's first: Auto, then Internal, so dense.
      assert.strictEqual(figma.resolve("Fuse density", "control-h-sm", {}), 32);
    })
  );

  it.effect("resolves an inner corner in the frame's theme and density", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const corner = (name: string, modes: Readonly<Record<string, string>>) =>
        (["Dense", "Comfortable", "Auto"] as const).map((density) =>
          figma.resolve("Fuse density", `radius-inner/${name}`, { ...modes, "Fuse density": density })
        );

      // Each corner is max(0px, rung - border - padding), from themes.css and fuse.css. Internal
      // themes set --radius 0.5rem and step 0px, so every rung is 8px. External themes step 2px:
      // Fjordkraft sets 0.75rem, so radius-sm, radius-lg and radius-xl are 8, 12 and 16px, and
      // TrøndelagKraft sets 1rem, so they are 12, 16 and 20px. Elmera sets 0.375rem, so radius-lg
      // is 6px. --surface-pad-md is 0.75rem dense and 1rem comfortable, and --surface-pad-sm
      // 0.25rem at both. Auto takes dense in internal themes and comfortable in external ones.
      // A default Accordion item: radius-sm less 12px or 16px leaves nothing, even at 1rem.
      assert.deepStrictEqual(corner("sm-pad-md", light("external-tkas-private")), [0, 0, 0]);
      // radius-lg less 12px or 16px.
      assert.deepStrictEqual(corner("lg-pad-md", light("internal-fkas-private")), [0, 0, 0]);
      assert.deepStrictEqual(corner("lg-pad-md", light("external-fkas-private")), [0, 0, 0]);
      assert.deepStrictEqual(corner("lg-pad-md", light("external-tkas-private")), [4, 0, 0]);
      // radius-xl less 12px or 16px.
      assert.deepStrictEqual(corner("xl-pad-md", light("external-fkas-private")), [4, 0, 0]);
      assert.deepStrictEqual(corner("xl-pad-md", light("external-tkas-private")), [8, 4, 4]);
      // A card Accordion item takes its 1px border off too.
      assert.deepStrictEqual(corner("lg-border-pad-md", light("external-tkas-private")), [3, 0, 0]);
      assert.deepStrictEqual(corner("xl-border-pad-md", light("internal-fkas-private")), [0, 0, 0]);
      assert.deepStrictEqual(corner("xl-border-pad-md", light("external-fkas-private")), [3, 0, 0]);
      assert.deepStrictEqual(corner("xl-border-pad-md", dark("external-tkas-company")), [7, 3, 3]);
      // A floating Sidebar's group: radius-lg less 4px at both densities.
      assert.deepStrictEqual(corner("lg-pad-sm", light("internal-fkas-private")), [4, 4, 4]);
      assert.deepStrictEqual(corner("lg-pad-sm", light("external-fkas-private")), [8, 8, 8]);
      assert.deepStrictEqual(corner("lg-pad-sm", light("external-tkas-private")), [12, 12, 12]);
      assert.deepStrictEqual(corner("lg-pad-sm", dark("external-elma-company")), [2, 2, 2]);
      // A DropdownMenu or Combobox row: radius-md less 4px at both densities. Fuse's
      // concentric-corners browser test measures 4px internal, 6px for Fjordkraft's external
      // theme, 10px for TrøndelagKraft's and 2px for Gudbrandsdal's. Elmera's radius-md is 4px,
      // which leaves 0.
      assert.deepStrictEqual(corner("md-pad-sm", light("internal-fkas-private")), [4, 4, 4]);
      assert.deepStrictEqual(corner("md-pad-sm", light("external-fkas-private")), [6, 6, 6]);
      assert.deepStrictEqual(corner("md-pad-sm", dark("external-tkas-company")), [10, 10, 10]);
      assert.deepStrictEqual(corner("md-pad-sm", light("external-guen-private")), [2, 2, 2]);
      assert.deepStrictEqual(corner("md-pad-sm", light("external-elma-company")), [0, 0, 0]);
      // A Command row: radius-xl less --surface-gap-sm, 0.5rem dense and 0.75rem comfortable.
      assert.deepStrictEqual(corner("xl-gap-sm", light("internal-fkas-private")), [0, 0, 0]);
      assert.deepStrictEqual(corner("xl-gap-sm", light("external-fkas-private")), [8, 4, 4]);
      assert.deepStrictEqual(corner("xl-gap-sm", light("external-tkas-private")), [12, 8, 8]);

      assert.deepStrictEqual(
        figma.aliasChain("Fuse density", "radius-inner/xl-border-pad-md", {
          ...light("external-tkas-private"),
          "Fuse density": "Comfortable",
        }),
        [
          "Fuse density/radius-inner/xl-border-pad-md",
          "Fuse tokens/radius-inner/xl-border-pad-md/comfortable",
          "Fuse variant/light/radius-inner/xl-border-pad-md/comfortable",
          "Fuse segment/light/external/radius-inner/xl-border-pad-md/comfortable",
          "Fuse brand/light/external/private/radius-inner/xl-border-pad-md/comfortable",
        ]
      );
    })
  );
});

describe("fuse-figma theme axes", () => {
  // In this cross-check, the unit under test is the synced alias chain from `Fuse tokens`
  // through `Fuse variant`, `Fuse segment` and `Fuse brand`, resolved the way Figma renders a
  // frame. The oracle is `resolveThemeCatalog`, which resolves every theme from the same
  // composition that generates themes.css.
  it.effect("resolves every bound variable of every theme and scheme to the catalog's value", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const { themes } = resolveThemeCatalog();

      assert.strictEqual(themes.length, 24);
      assert.deepStrictEqual(
        catalogMismatches(figma, themes, (theme, scheme) => frame(scheme, theme.slug)),
        []
      );
    })
  );

  it.effect("shows a pinned brand's only segment under the segment it does not allow", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      // fkab allows only company and fkse only private.
      const pinned = { fkab: "Private", fkse: "Company" } as const;
      const themes = resolveThemeCatalog().themes.filter(
        (theme) => theme.input.brand === "fkab" || theme.input.brand === "fkse"
      );

      assert.strictEqual(themes.length, 4);
      assert.deepStrictEqual(
        catalogMismatches(figma, themes, (theme, scheme) => ({
          ...frame(scheme, theme.slug),
          "Fuse segment": theme.input.brand === "fkab" ? pinned.fkab : pinned.fkse,
        })),
        []
      );
      // Telinet's company frame shows external-fkse-private's light primary, and Fjordkraft
      // Företag's private frame shows external-fkab-company's.
      const primary = (modes: Readonly<Record<string, string>>) =>
        hex(figma.resolve("Fuse tokens", "primary", modes));
      assert.strictEqual(
        primary({ ...light("external-fkse-private"), "Fuse segment": "Company" }),
        "#0A416E"
      );
      assert.strictEqual(
        primary({ ...light("external-fkab-company"), "Fuse segment": "Private" }),
        "#17343B"
      );
    })
  );

  it.effect(
    "deletes a local Fuse themes collection but no library collection or extension of that name",
    () =>
      Effect.gen(function* () {
        const figma = new InMemoryFigma(FILE_KEY, TOKEN);
        yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
        const retired = figma.addCollection("Fuse themes", ["external-fkas-private"]);
        figma.addVariable(retired, "light/primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
        const library = figma.addLibraryCollection("Fuse themes", ["external-fkas-private"]);
        const extension = figma.addExtension(
          "Fuse themes",
          figma.addCollection("Brand (designers)", ["Light"])
        );

        const drift = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "check"]));
        assert.strictEqual(Runtime.getErrorExitCode(drift), 2);
        assert.include(yield* output, "Fuse themes: delete collection");
        assert.isTrue(figma.hasCollection(retired));

        yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

        assert.isFalse(figma.hasCollection(retired));
        assert.isTrue(figma.hasCollection(library));
        assert.isTrue(figma.hasCollection(extension));
        assert.deepStrictEqual(figma.acceptedWrites.at(-1)?.variableCollections, [
          { action: "DELETE", id: retired },
        ]);
        yield* run(figma, ["--file-key", FILE_KEY, "check"]);
        assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);
      })
  );

  it.effect("moves a file synced with Fuse themes onto the axes, keeping every bound variable's id", () =>
    Effect.gen(function* () {
      // The layout before the axes split: Fuse tokens aliases a theme-slug collection, and
      // Fuse density has no Auto mode.
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const themes = figma.addCollection("Fuse themes", ["internal-fkas-private", "external-fkas-company"]);
      const oldPrimary = figma.addVariable(themes, "light/primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
      const tokens = figma.addCollection("Fuse tokens", ["Light", "Dark"]);
      const primary = figma.addVariable(tokens, "primary", "COLOR", {
        type: "VARIABLE_ALIAS",
        id: oldPrimary,
      });
      const density = figma.addCollection("Fuse density", ["Dense", "Comfortable"]);
      const controlHeight = figma.addVariable(density, "control-h-md", "FLOAT", 36);
      const denseId = figma.modeId("Fuse density", "Dense");
      const comfortableId = figma.modeId("Fuse density", "Comfortable");

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.isFalse(figma.hasCollection(themes));
      assert.strictEqual(figma.variableIds().get("Fuse tokens/primary"), primary);
      assert.strictEqual(figma.variableIds().get("Fuse density/control-h-md"), controlHeight);
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-company"))),
        "#17343B"
      );
      // REST appends a new mode and cannot reorder modes, so Auto lands last and Dense stays
      // the default. The existing modes keep their ids.
      assert.deepStrictEqual(figma.modeNames("Fuse density"), ["Dense", "Comfortable", "Auto"]);
      assert.deepStrictEqual(figma.modeIds("Fuse density").slice(0, 2), [denseId, comfortableId]);
      assert.strictEqual(figma.resolve("Fuse density", "control-h-md", light("external-fkas-company")), 36);
      assert.strictEqual(
        figma.resolve("Fuse density", "control-h-md", {
          ...light("external-fkas-company"),
          "Fuse density": "Auto",
        }),
        44
      );
      yield* run(figma, ["--file-key", FILE_KEY, "check"]);
      assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);
    })
  );
});
