import { assert, describe, it } from "@effect/vitest";
import { Effect, Runtime } from "effect";
import { isDeepStrictEqual } from "node:util";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";
import type { AnyEntry, ResolvedScheme, ResolvedTheme } from "@elmeragroup/fuse/theme-catalog";

import { dark, errors, FILE_KEY, frame, hex, light, output, run, TOKEN, writes } from "./cli-fixture.ts";
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
  }
}

/** Every token and rung of a theme's scheme, the entries `Fuse tokens` binds. */
function boundEntries(scheme: ResolvedScheme): readonly AnyEntry[] {
  return [...Object.values(scheme.tokens), ...Object.values(scheme.rungs)];
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
        hex(figma.resolve("Fuse tokens", "primary", light("branded-elma-company"))),
        "#00313C"
      );
      // Segment changes values only for branded fkas and for fkab, which borrows its company palette.
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("branded-fkas-company"))),
        "#17343B"
      );
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary-foreground", light("branded-fkas-private"))),
        "#FFFFFF"
      );
      assert.strictEqual(figma.resolve("Fuse tokens", "radius", light("branded-elma-company")), 6);
      // 1.8125rem at the 16px root.
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-button", light("branded-fkas-private")), 29);
      // Fields round with the theme's radius in both identities: 0.75rem for branded fkas and
      // 0.5rem for neutral.
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-field", light("branded-fkas-private")), 12);
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-field", light("neutral-fkas-private")), 8);
      assert.strictEqual(
        figma.resolve("Fuse tokens", "font-heading", light("branded-fkas-private")),
        "Neo Sans"
      );
      assert.strictEqual(
        figma.resolve("Fuse tokens", "font-heading", light("neutral-fkas-private")),
        "Roboto"
      );

      // radius-step is 0px in neutral themes and 2px in branded ones.
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-step", light("neutral-fkas-private")), 0);
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-step", light("branded-fkas-private")), 2);

      // secondary-hover holds the composed literal, since Figma cannot mix colors. The theme
      // contract test pins oklch(0.929 0.000205 2.4655) light and oklch(0.3048 0 0) dark, which
      // are #E7E7E7 and #2F2F2F in sRGB.
      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "secondary-hover", light("neutral-fkas-private")),
        [
          "Fuse tokens/secondary-hover",
          "Fuse identity/light/secondary-hover",
          "Fuse segment/light/neutral/secondary-hover",
          "Fuse brand/light/neutral/private/secondary-hover",
        ]
      );
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "secondary-hover", light("neutral-fkas-private"))),
        "#E7E7E7"
      );
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "secondary-hover", dark("neutral-fkas-private"))),
        "#2F2F2F"
      );

      // Neutral dark borders are white at 10% opacity, stored as 32-bit floats.
      const border = figma.resolve("Fuse tokens", "border", dark("neutral-guen-company"));
      assert.isTrue(border instanceof Object && Math.abs(border.a - 0.1) < 1e-6 && border.r > 0.999);

      // The brand pointer reaches the brand's primitive, the way `var(--brand-tkas)` does in CSS.
      assert.deepStrictEqual(figma.aliasChain("Fuse tokens", "brand", light("neutral-tkas-private")), [
        "Fuse tokens/brand",
        "Fuse identity/light/brand",
        "Fuse segment/light/neutral/brand",
        "Fuse brand/light/neutral/private/brand",
        "Fuse primitives/brand-tkas",
      ]);
      // destructive aliases the error role at the same theme path.
      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "destructive", dark("branded-tkas-company")).slice(0, 5),
        [
          "Fuse tokens/destructive",
          "Fuse identity/dark/destructive",
          "Fuse segment/dark/branded/destructive",
          "Fuse brand/dark/branded/company/destructive",
          "Fuse brand/dark/branded/company/error",
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

      // Neutral themes inherit --radius: 0.5rem, 8px, and step 0px, so every rung is 8px.
      assert.deepStrictEqual(rungs(light("neutral-fkas-private")), [8, 8, 8, 8, 8]);
      // Branded themes step 2px. branded-fkas-private sets --radius: 0.75rem, 12px at the
      // 16px root, so the rungs are 12 - 3 * 2, 12 - 2 * 2, 12 - 2, 12 and 12 + 2 * 2.
      assert.strictEqual(radius("radius", light("branded-fkas-private")), 12);
      assert.deepStrictEqual(rungs(light("branded-fkas-private")), [6, 8, 10, 12, 16]);
      // Dark keeps the light radius and step.
      assert.deepStrictEqual(rungs(dark("branded-fkas-private")), [6, 8, 10, 12, 16]);
      // branded-guen-private sets 0.5rem, 8px.
      assert.deepStrictEqual(rungs(light("branded-guen-private")), [2, 4, 6, 8, 12]);
      // branded-tkas-private sets 1rem, 16px.
      assert.deepStrictEqual(rungs(light("branded-tkas-private")), [10, 12, 14, 16, 20]);

      assert.deepStrictEqual(figma.aliasChain("Fuse tokens", "radius-md", dark("neutral-tkas-company")), [
        "Fuse tokens/radius-md",
        "Fuse identity/dark/radius-md",
        "Fuse segment/dark/neutral/radius-md",
        "Fuse brand/dark/neutral/company/radius-md",
      ]);
    })
  );

  it.effect("resolves each density metric in the density a frame sets, whatever its theme", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const metric = (name: string, density: string, theme = "branded-fkas-private") =>
        figma.resolve("Fuse density", name, { ...light(theme), "Fuse density": density });

      // fuse.css: --control-h-md is 2.25rem on :root and 2.75rem when comfortable.
      assert.strictEqual(metric("control-h-md", "Dense"), 36);
      assert.strictEqual(metric("control-h-md", "Comfortable"), 44);
      assert.strictEqual(metric("control-h-md", "Dense", "neutral-guen-company"), 36);
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

  it.effect("resolves density only where a frame pins it, dense when it pins none", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // No identity implies a density: a branded frame pinned dense reads 2.25rem, 36px, and a
      // neutral frame pinned comfortable 2.75rem, 44px, as an app's document stamps them.
      assert.strictEqual(
        figma.resolve("Fuse density", "control-h-md", {
          ...light("branded-fkas-private"),
          "Fuse density": "Dense",
        }),
        36
      );
      assert.strictEqual(
        figma.resolve("Fuse density", "control-h-md", {
          ...light("neutral-guen-company"),
          "Fuse density": "Comfortable",
        }),
        44
      );
      // A frame that sets no mode sees each collection's first: Dense, so 2rem for control-h-sm.
      assert.strictEqual(figma.resolve("Fuse density", "control-h-sm", {}), 32);
    })
  );

  it.effect("resolves an inner corner in the frame's theme and density", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const corner = (name: string, modes: Readonly<Record<string, string>>) =>
        (["Dense", "Comfortable"] as const).map((density) =>
          figma.resolve("Fuse density", `radius-inner/${name}`, { ...modes, "Fuse density": density })
        );

      // Each corner is max(0px, rung - border - padding), from themes.css and fuse.css. Neutral
      // themes set --radius 0.5rem and step 0px, so every rung is 8px. Branded themes step 2px:
      // Fjordkraft sets 0.75rem, so radius-sm, radius-lg and radius-xl are 8, 12 and 16px, and
      // TrøndelagKraft sets 1rem, so they are 12, 16 and 20px. Elmera sets 0.375rem, so radius-lg
      // is 6px. --surface-pad-md is 0.75rem dense and 1rem comfortable, and --surface-pad-sm
      // 0.25rem at both.
      // A default Accordion item: radius-sm less 12px or 16px leaves nothing, even at 1rem.
      assert.deepStrictEqual(corner("sm-pad-md", light("branded-tkas-private")), [0, 0]);
      // radius-lg less 12px or 16px.
      assert.deepStrictEqual(corner("lg-pad-md", light("neutral-fkas-private")), [0, 0]);
      assert.deepStrictEqual(corner("lg-pad-md", light("branded-fkas-private")), [0, 0]);
      assert.deepStrictEqual(corner("lg-pad-md", light("branded-tkas-private")), [4, 0]);
      // radius-xl less 12px or 16px.
      assert.deepStrictEqual(corner("xl-pad-md", light("branded-fkas-private")), [4, 0]);
      assert.deepStrictEqual(corner("xl-pad-md", light("branded-tkas-private")), [8, 4]);
      // A card Accordion item takes its 1px border off too.
      assert.deepStrictEqual(corner("lg-border-pad-md", light("branded-tkas-private")), [3, 0]);
      assert.deepStrictEqual(corner("xl-border-pad-md", light("neutral-fkas-private")), [0, 0]);
      assert.deepStrictEqual(corner("xl-border-pad-md", light("branded-fkas-private")), [3, 0]);
      assert.deepStrictEqual(corner("xl-border-pad-md", dark("branded-tkas-company")), [7, 3]);
      // A floating Sidebar's group: radius-lg less 4px at both densities.
      assert.deepStrictEqual(corner("lg-pad-sm", light("neutral-fkas-private")), [4, 4]);
      assert.deepStrictEqual(corner("lg-pad-sm", light("branded-fkas-private")), [8, 8]);
      assert.deepStrictEqual(corner("lg-pad-sm", light("branded-tkas-private")), [12, 12]);
      assert.deepStrictEqual(corner("lg-pad-sm", dark("branded-elma-company")), [2, 2]);
      // A DropdownMenu or Combobox row: radius-md less 4px at both densities. Fuse's
      // concentric-corners browser test measures 4px neutral, 6px for Fjordkraft's branded
      // theme, 10px for TrøndelagKraft's and 2px for Gudbrandsdal's. Elmera's radius-md is 4px,
      // which leaves 0.
      assert.deepStrictEqual(corner("md-pad-sm", light("neutral-fkas-private")), [4, 4]);
      assert.deepStrictEqual(corner("md-pad-sm", light("branded-fkas-private")), [6, 6]);
      assert.deepStrictEqual(corner("md-pad-sm", dark("branded-tkas-company")), [10, 10]);
      assert.deepStrictEqual(corner("md-pad-sm", light("branded-guen-private")), [2, 2]);
      assert.deepStrictEqual(corner("md-pad-sm", light("branded-elma-company")), [0, 0]);
      // A Command row: radius-xl less --surface-gap-sm, 0.5rem dense and 0.75rem comfortable.
      assert.deepStrictEqual(corner("xl-gap-sm", light("neutral-fkas-private")), [0, 0]);
      assert.deepStrictEqual(corner("xl-gap-sm", light("branded-fkas-private")), [8, 4]);
      assert.deepStrictEqual(corner("xl-gap-sm", light("branded-tkas-private")), [12, 8]);

      assert.deepStrictEqual(
        figma.aliasChain("Fuse density", "radius-inner/xl-border-pad-md", {
          ...light("branded-tkas-private"),
          "Fuse density": "Comfortable",
        }),
        [
          "Fuse density/radius-inner/xl-border-pad-md",
          "Fuse tokens/radius-inner/xl-border-pad-md/comfortable",
          "Fuse identity/light/radius-inner/xl-border-pad-md/comfortable",
          "Fuse segment/light/branded/radius-inner/xl-border-pad-md/comfortable",
          "Fuse brand/light/branded/private/radius-inner/xl-border-pad-md/comfortable",
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
      // Telinet's company frame shows branded-fkse-private's light primary, and Fjordkraft
      // Företag's private frame shows branded-fkab-company's.
      const primary = (modes: Readonly<Record<string, string>>) =>
        hex(figma.resolve("Fuse tokens", "primary", modes));
      assert.strictEqual(primary({ ...light("branded-fkse-private"), "Fuse segment": "Company" }), "#0A416E");
      assert.strictEqual(primary({ ...light("branded-fkab-company"), "Fuse segment": "Private" }), "#17343B");
    })
  );

  it.effect(
    "deletes a local Fuse themes collection but no library collection or extension of that name",
    () =>
      Effect.gen(function* () {
        const figma = new InMemoryFigma(FILE_KEY, TOKEN);
        yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
        const retired = figma.addCollection("Fuse themes", ["branded-fkas-private"]);
        figma.addVariable(retired, "light/primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
        const library = figma.addLibraryCollection("Fuse themes", ["branded-fkas-private"]);
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
      // The layout before the axes split: Fuse tokens aliases a theme-slug collection.
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const themes = figma.addCollection("Fuse themes", ["neutral-fkas-private", "branded-fkas-company"]);
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
        hex(figma.resolve("Fuse tokens", "primary", light("branded-fkas-company"))),
        "#17343B"
      );
      // The existing modes keep their ids, and Dense stays the default.
      assert.deepStrictEqual(figma.modeNames("Fuse density"), ["Dense", "Comfortable"]);
      assert.deepStrictEqual(figma.modeIds("Fuse density"), [denseId, comfortableId]);
      assert.strictEqual(figma.resolve("Fuse density", "control-h-md", light("branded-fkas-company")), 36);
      yield* run(figma, ["--file-key", FILE_KEY, "check"]);
      assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);
    })
  );

  it.effect(
    "renames a file's Fuse variant to Fuse identity in place and drops Auto density, keeping the pinned modes' ids",
    () =>
      Effect.gen(function* () {
        // The layout before the identity rename: the variant collection with Internal and
        // External modes, which frames pin, and Fuse density with an Auto mode first.
        const figma = new InMemoryFigma(FILE_KEY, TOKEN);
        const variant = figma.addCollection("Fuse variant", ["Internal", "External"]);
        figma.addVariable(variant, "light/primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
        const internalId = figma.modeId("Fuse variant", "Internal");
        const externalId = figma.modeId("Fuse variant", "External");
        figma.addCollection("Fuse density", ["Auto", "Dense", "Comfortable"]);
        const denseId = figma.modeId("Fuse density", "Dense");
        const comfortableId = figma.modeId("Fuse density", "Comfortable");

        yield* run(figma, ["--file-key", FILE_KEY, "check"]).pipe(Effect.flip);
        const planned = yield* output;
        assert.include(planned, "Fuse identity: rename collection from Fuse variant");
        assert.include(planned, "Fuse identity: rename mode Internal to Neutral");
        assert.include(planned, "Fuse identity: rename mode External to Branded");
        assert.include(planned, "Fuse density: delete mode Auto");

        yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

        // One collection keeps its id under the new name, and its modes keep theirs, so every
        // frame pinned to Internal or External now shows Neutral or Branded.
        assert.isTrue(figma.hasCollection(variant));
        assert.strictEqual(figma.collectionId("Fuse identity"), variant);
        assert.notInclude(figma.collectionNames(), "Fuse variant");
        assert.deepStrictEqual(figma.modeNames("Fuse identity"), ["Neutral", "Branded"]);
        assert.deepStrictEqual(figma.modeIds("Fuse identity"), [internalId, externalId]);
        // Auto is gone; Dense and Comfortable keep their ids, and Dense is now the default.
        assert.deepStrictEqual(figma.modeNames("Fuse density"), ["Dense", "Comfortable"]);
        assert.deepStrictEqual(figma.modeIds("Fuse density"), [denseId, comfortableId]);
        assert.strictEqual(
          hex(figma.resolve("Fuse tokens", "primary", light("branded-fkas-company"))),
          "#17343B"
        );
        yield* run(figma, ["--file-key", FILE_KEY, "check"]);
        assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);
      })
  );

  it.effect("renames the old modes of a Fuse identity a designer renamed by hand, keeping their ids", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.addCollection("Fuse identity", ["Internal", "External"]);
      const internalId = figma.modeId("Fuse identity", "Internal");
      const externalId = figma.modeId("Fuse identity", "External");

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      assert.deepStrictEqual(figma.modeNames("Fuse identity"), ["Neutral", "Branded"]);
      assert.deepStrictEqual(figma.modeIds("Fuse identity"), [internalId, externalId]);
      yield* run(figma, ["--file-key", FILE_KEY, "check"]);
      assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);
    })
  );

  it.effect("refuses to sync a Fuse identity that holds both Internal and Neutral, and writes nothing", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.addCollection("Fuse identity", ["Internal", "Neutral", "Branded"]);

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]).pipe(Effect.flip);
      assert.include(
        yield* errors,
        'In "Fuse identity", renaming its mode "Internal" to "Neutral" would clash'
      );
      assert.strictEqual(writes(figma), 0);
    })
  );

  it.effect("refuses to sync a file that holds Fuse variant beside Fuse identity, and writes nothing", () =>
    Effect.gen(function* () {
      // A half-done migration: someone created Fuse identity by hand and kept the old collection.
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const variant = figma.addCollection("Fuse variant", ["Internal", "External"]);
      figma.addCollection("Fuse identity", ["Neutral", "Branded"]);

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]).pipe(Effect.flip);
      assert.include(
        yield* errors,
        'The file holds both "Fuse identity" and the collection it replaces, "Fuse variant".'
      );
      assert.strictEqual(writes(figma), 0);
      assert.isTrue(figma.hasCollection(variant));
    })
  );
});
