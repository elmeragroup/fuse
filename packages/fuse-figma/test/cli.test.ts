import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber, Runtime } from "effect";
import { TestClock } from "effect/testing";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import {
  BRAND_MODES,
  errors,
  FILE_KEY,
  hex,
  light,
  output,
  reads,
  run,
  TOKEN,
  writes,
} from "./cli-fixture.ts";
import { InMemoryFigma } from "./in-memory-figma.ts";

/** The picker scopes, in alphabetical order because Figma does not document one, and the code syntax of a variable. */
function pickers(figma: InMemoryFigma, collection: string, variable: string) {
  const { scopes, codeSyntax } = figma.metadata(collection, variable);
  return { scopes: scopes.toSorted(), codeSyntax };
}

/** A value as a designer stores it in the fake file. */
type StoredValue = Parameters<InMemoryFigma["setValue"]>[3];

describe("fuse-figma sync", () => {
  it.effect("creates the six Fuse collections in an empty file", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.collectionNames(), [
        "Fuse primitives",
        "Fuse brand",
        "Fuse segment",
        "Fuse variant",
        "Fuse tokens",
        "Fuse density",
      ]);
      assert.deepStrictEqual(figma.modeNames("Fuse tokens"), ["Light", "Dark"]);
      assert.deepStrictEqual(figma.modeNames("Fuse variant"), ["Internal", "External"]);
      assert.deepStrictEqual(figma.modeNames("Fuse segment"), ["Private", "Company"]);
      assert.deepStrictEqual(figma.modeNames("Fuse brand"), [...BRAND_MODES.values()]);
      assert.deepStrictEqual(figma.modeNames("Fuse primitives"), ["Value"]);
      assert.deepStrictEqual(figma.modeNames("Fuse density"), ["Auto", "Dense", "Comfortable"]);
      // 94 contract tokens plus 5 radius rungs.
      assert.strictEqual(figma.variableNames("Fuse tokens").length, 99);
      // Those 99 per scheme, plus 39 density metrics.
      assert.strictEqual(figma.variableNames("Fuse variant").length, 198 + 39);
      // Per scheme and variant, then per scheme, variant and segment.
      assert.strictEqual(figma.variableNames("Fuse segment").length, 396);
      assert.strictEqual(figma.variableNames("Fuse brand").length, 792);
      assert.strictEqual(figma.variableNames("Fuse primitives").length, 25);
      // 26 control metrics, 4 row, 2 label, 3 surface padding and 4 surface gap metrics.
      assert.strictEqual(figma.variableNames("Fuse density").length, 39);
      assert.strictEqual(writes(figma), 1);
      assert.include(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect("sets code syntax and picker scopes on the variables designers can bind", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "primary"), {
        scopes: ["ALL_FILLS", "STROKE_COLOR"],
        codeSyntax: { WEB: "var(--primary)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "radius"), {
        scopes: ["CORNER_RADIUS"],
        codeSyntax: { WEB: "var(--radius)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "font-sans"), {
        scopes: ["FONT_FAMILY"],
        codeSyntax: { WEB: "var(--font-sans)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "selection-title-weight"), {
        scopes: ["FONT_STYLE"],
        codeSyntax: { WEB: "var(--selection-title-weight)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "secondary-hover"), {
        scopes: ["FRAME_FILL", "SHAPE_FILL"],
        codeSyntax: { WEB: "var(--secondary-hover)" },
      });
      // radius-step spaces the radius scale, so no picker offers it for a corner.
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "radius-step"), {
        scopes: [],
        codeSyntax: { WEB: "var(--radius-step)" },
      });
      // The neutral ramp holds one value in every theme, so no picker offers it.
      assert.deepStrictEqual(pickers(figma, "Fuse primitives", "neutral-500"), {
        scopes: [],
        codeSyntax: { WEB: "var(--neutral-500)" },
      });
      // The hidden variables only feed aliases, so no picker offers them and they carry no code.
      for (const [collection, variable] of [
        ["Fuse variant", "light/primary"],
        ["Fuse variant", "density/control-h-md"],
        ["Fuse segment", "light/external/primary"],
        ["Fuse brand", "light/external/company/primary"],
      ] as const) {
        assert.deepStrictEqual(pickers(figma, collection, variable), { scopes: [], codeSyntax: {} });
      }
      // The built CSS defines no --radius-sm and most other rungs, so the rungs carry the calc().
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "radius-xs").codeSyntax, {
        WEB: "calc(var(--radius) - 3 * var(--radius-step, 0px))",
      });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "radius-sm"), {
        scopes: ["CORNER_RADIUS"],
        codeSyntax: { WEB: "calc(var(--radius) - 2 * var(--radius-step, 0px))" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "radius-md"), {
        scopes: ["CORNER_RADIUS"],
        codeSyntax: { WEB: "calc(var(--radius) - var(--radius-step, 0px))" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "radius-lg").codeSyntax, { WEB: "var(--radius)" });
      assert.deepStrictEqual(pickers(figma, "Fuse tokens", "radius-xl").codeSyntax, {
        WEB: "calc(var(--radius) + 2 * var(--radius-step, 0px))",
      });
      assert.deepStrictEqual(pickers(figma, "Fuse brand", "dark/internal/private/radius-md"), {
        scopes: [],
        codeSyntax: {},
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "control-h-md"), {
        scopes: ["WIDTH_HEIGHT"],
        codeSyntax: { WEB: "var(--control-h-md)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "control-px-icon-sm"), {
        scopes: ["GAP"],
        codeSyntax: { WEB: "var(--control-px-icon-sm)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "control-gap-lg"), {
        scopes: ["GAP"],
        codeSyntax: { WEB: "var(--control-gap-lg)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "control-text"), {
        scopes: ["FONT_SIZE"],
        codeSyntax: { WEB: "var(--control-text)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "control-leading"), {
        scopes: ["LINE_HEIGHT"],
        codeSyntax: { WEB: "var(--control-leading)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "label-text"), {
        scopes: ["FONT_SIZE"],
        codeSyntax: { WEB: "var(--label-text)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "label-leading"), {
        scopes: ["LINE_HEIGHT"],
        codeSyntax: { WEB: "var(--label-leading)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "row-h"), {
        scopes: ["WIDTH_HEIGHT"],
        codeSyntax: { WEB: "var(--row-h)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "row-py"), {
        scopes: ["GAP"],
        codeSyntax: { WEB: "var(--row-py)" },
      });
      assert.deepStrictEqual(pickers(figma, "Fuse density", "surface-gap-md"), {
        scopes: ["GAP"],
        codeSyntax: { WEB: "var(--surface-gap-md)" },
      });
    })
  );

  it.effect("offers each color only in the pickers for where Fuse paints it", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // Oracle: a surface fills frames and shapes, an ink fills text and shapes and strokes
      // vectors, and a line strokes. The three fills together are ALL_FILLS.
      const expected = [
        ["Fuse tokens", "card", ["FRAME_FILL", "SHAPE_FILL"]],
        ["Fuse tokens", "card-foreground", ["SHAPE_FILL", "STROKE_COLOR", "TEXT_FILL"]],
        ["Fuse tokens", "ring", ["STROKE_COLOR"]],
        ["Fuse tokens", "secondary", ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"]],
        ["Fuse tokens", "primary-foreground", ["ALL_FILLS", "STROKE_COLOR"]],
        // Not text-grade, so the text fill picker leaves it out.
        ["Fuse tokens", "feature-foreground", ["FRAME_FILL", "SHAPE_FILL"]],
        ["Fuse primitives", "neutral-50", []],
        ["Fuse primitives", "brand-fkas", ["FRAME_FILL", "SHAPE_FILL"]],
        ["Fuse primitives", "brand-fkas-foreground", ["SHAPE_FILL", "STROKE_COLOR", "TEXT_FILL"]],
      ] as const;
      for (const [collection, variable, scopes] of expected) {
        assert.deepStrictEqual(
          pickers(figma, collection, variable).scopes,
          [...scopes],
          `${collection}/${variable}`
        );
      }
    })
  );

  it.effect("describes every variable a designer can bind, and leaves the hidden ones blank", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // Unit under test: the descriptions the sync stores. Oracle: the theme catalog's own
      // description of each token, rung, primitive and density metric.
      const catalog = resolveThemeCatalog();
      const [theme] = catalog.themes;
      const described = [
        ...Object.values(theme.schemes.light.tokens).map((entry) => ["Fuse tokens", entry] as const),
        ...Object.values(theme.schemes.light.rungs)
          .filter((rung) => rung.name !== "radius-popover")
          .map((entry) => ["Fuse tokens", entry] as const),
        ...Object.values(catalog.primitives).map((entry) => ["Fuse primitives", entry] as const),
        ...catalog.density.map((entry) => ["Fuse density", entry] as const),
      ];
      const mismatched = described.filter(
        ([collection, entry]) =>
          entry.description === "" || figma.metadata(collection, entry.name).description !== entry.description
      );
      assert.deepStrictEqual(
        mismatched.map(([collection, entry]) => `${collection}/${entry.name}`),
        []
      );
      assert.strictEqual(described.length, 99 + 25 + 39);
      assert.include(figma.metadata("Fuse tokens", "feature-foreground").description, "not text-grade");
      for (const collection of ["Fuse variant", "Fuse segment", "Fuse brand"]) {
        const blank = figma
          .variableNames(collection)
          .filter((variable) => figma.metadata(collection, variable).description !== "");
        assert.deepStrictEqual(blank, [], collection);
      }
    })
  );

  it.effect("keeps a designer's Android and iOS code syntax when it corrects the web entry", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const id = figma.variableIds().get("Fuse tokens/primary");
      if (id === undefined) throw new Error("the first sync creates primary");
      const synced = figma.metadata("Fuse tokens", "primary");
      figma.setMetadata("Fuse tokens", "primary", {
        ...synced,
        codeSyntax: { WEB: "var(--old-primary)", ANDROID: "R.color.primary", iOS: "Color.primary" },
      });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // The fake replaces code syntax on an update, so the write must carry every platform.
      assert.deepStrictEqual(figma.acceptedWrites.at(-1)?.variables, [
        {
          action: "UPDATE",
          id,
          scopes: synced.scopes,
          codeSyntax: { WEB: "var(--primary)", ANDROID: "R.color.primary", iOS: "Color.primary" },
          description: synced.description,
        },
      ]);
      assert.deepStrictEqual(figma.metadata("Fuse tokens", "primary"), {
        ...synced,
        codeSyntax: { WEB: "var(--primary)", ANDROID: "R.color.primary", iOS: "Color.primary" },
      });
    })
  );

  it.effect("writes nothing when the file already matches", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.strictEqual(writes(figma), 1);
      assert.include(yield* output, `Figma file ${FILE_KEY} already matches the Fuse tokens.`);
    })
  );

  it.effect.each([
    { value: "a drifted value", drift: (): StoredValue => ({ r: 1, g: 0, b: 0, a: 1 }) },
    {
      value: "a composed color",
      drift: (figma: InMemoryFigma): StoredValue => ({
        color: { type: "VARIABLE_ALIAS", id: figma.variableIds().get("Fuse primitives/brand-fkas") ?? "" },
        opacity: 50,
      }),
    },
    {
      value: "a value newer than the sync",
      drift: (): StoredValue => ({ type: "FUTURE_VALUE", payload: "mix" }),
    },
  ])("rewrites $value in a variable it owns in place, keeping every variable id", ({ drift }) =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const idsBefore = figma.variableIds();
      const synced = hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-private")));
      figma.setValue("Fuse brand", "light/external/private/primary", "Fjordkraft", drift(figma));

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.variableIds(), idsBefore);
      const repair = figma.acceptedWrites.at(-1);
      assert.deepStrictEqual(repair?.variableModeValues?.length, 1);
      assert.strictEqual(repair?.variables?.length ?? 0, 0);
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-private"))),
        synced
      );
    })
  );

  it.effect("leaves code syntax alone on the variables whose web syntax it does not set", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const id = figma.variableIds().get("Fuse segment/light/external/primary");
      if (id === undefined) throw new Error("the first sync creates light/external/primary");
      figma.setMetadata("Fuse segment", "light/external/primary", {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--designer)", ANDROID: "R.color.designer" },
        description: "A designer's note.",
      });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // The write carries no codeSyntax at all, so it is safe whether Figma merges or replaces it.
      assert.deepStrictEqual(figma.acceptedWrites.at(-1)?.variables, [
        { action: "UPDATE", id, scopes: [], description: "" },
      ]);
      assert.deepStrictEqual(figma.metadata("Fuse segment", "light/external/primary"), {
        scopes: [],
        codeSyntax: { WEB: "var(--designer)", ANDROID: "R.color.designer" },
        description: "",
      });
    })
  );

  it.effect("leaves collections it does not own alone and prunes stale entries in the ones it does", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const brandId = figma.addCollection("Brand (designers)", ["Default"]);
      figma.addVariable(brandId, "accent", "COLOR", { r: 0.2, g: 0.4, b: 0.6, a: 1 });
      const accent = figma.resolve("Brand (designers)", "accent", {});
      const tokensId = figma.addCollection("Fuse tokens", ["Light", "Dark", "Sepia"]);
      figma.addVariable(tokensId, "legacy-accent", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
      const primaryId = figma.addVariable(tokensId, "primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.variableNames("Brand (designers)"), ["accent"]);
      assert.deepStrictEqual(figma.resolve("Brand (designers)", "accent", {}), accent);
      assert.strictEqual(figma.collectionId("Fuse tokens"), tokensId);
      assert.deepStrictEqual(figma.modeNames("Fuse tokens"), ["Light", "Dark"]);
      assert.notInclude(figma.variableNames("Fuse tokens"), "legacy-accent");
      assert.strictEqual(figma.variableIds().get("Fuse tokens/primary"), primaryId);
      assert.include(yield* output, "Fuse tokens: delete variable legacy-accent");
    })
  );

  it.effect("replaces a collection's only mode when the tokens do not name it", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.addCollection("Fuse primitives", ["Mode 1"]);
      const modeId = figma.modeId("Fuse primitives", "Mode 1");

      // The fake refuses a batch that leaves a collection without a mode, so this passes
      // only when the new mode exists before the old one goes.
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.modeNames("Fuse primitives"), ["Value"]);
      assert.notInclude(figma.modeIds("Fuse primitives"), modeId);
      const printed = yield* output;
      assert.include(printed, "Fuse primitives: create mode Value");
      assert.include(printed, "Fuse primitives: delete mode Mode 1");
    })
  );

  it.effect("ignores library collections and extensions that share a Fuse collection's name", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const libraryId = figma.addLibraryCollection("Fuse tokens", ["Light", "Dark"]);
      const libraryPrimary = figma.addVariable(libraryId, "primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
      const brandId = figma.addCollection("Brand (designers)", ["Light", "Dark"]);
      const extensionId = figma.addExtension("Fuse brand", brandId);

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.collectionNames(), [
        "Brand (designers)",
        "Fuse primitives",
        "Fuse brand",
        "Fuse segment",
        "Fuse variant",
        "Fuse tokens",
        "Fuse density",
      ]);
      assert.isTrue(figma.hasCollection(extensionId));
      assert.isTrue(figma.hasCollection(libraryId));
      assert.strictEqual(figma.variableNames("Fuse brand").length, 792);
      assert.deepStrictEqual(figma.variableById(libraryPrimary).values, [
        { r: 0, g: 0, b: 0, a: 1 },
        { r: 0, g: 0, b: 0, a: 1 },
      ]);
      assert.include(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect("does not match a deleted variable that layers still reference", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const tokensId = figma.addCollection("Fuse tokens", ["Light", "Dark"]);
      const deleted = figma.addVariable(tokensId, "primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
      figma.deleteButKeepReferenced(deleted);

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      const primary = figma.variableIds().get("Fuse tokens/primary");
      assert.isDefined(primary);
      assert.notStrictEqual(primary, deleted);
      assert.isTrue(figma.variableById(deleted).deletedButReferenced);
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("external-elma-company"))),
        "#00313C"
      );
    })
  );

  it.effect("fails when reading the file back still differs from the tokens", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.afterNextWrite(() =>
        figma.setValue("Fuse brand", "light/external/private/primary", "Fjordkraft", {
          r: 1,
          g: 0,
          b: 0,
          a: 1,
        })
      );

      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "sync"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(writes(figma), 1);
      assert.include(
        yield* errors,
        "Figma accepted the update, but the file still differs from the tokens in 1 place. Run `check` to see them."
      );
      assert.notInclude(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect("restores an alias a designer reversed", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      // A designer points error at destructive, the reverse of the tokens. Figma refuses a
      // cycle, so destructive first gets a literal in every brand.
      for (const brand of figma.modeNames("Fuse brand")) {
        figma.setValue("Fuse brand", "light/external/company/destructive", brand, { r: 1, g: 0, b: 0, a: 1 });
      }
      const destructive = figma.variableIds().get("Fuse brand/light/external/company/destructive") ?? "";
      figma.setValue("Fuse brand", "light/external/company/error", "Elmera", {
        type: "VARIABLE_ALIAS",
        id: destructive,
      });

      // The fake checks for a cycle after each value, so this passes only when error gets its
      // literal back before destructive aliases it again.
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "destructive", light("external-elma-company")).slice(3, 5),
        ["Fuse brand/light/external/company/destructive", "Fuse brand/light/external/company/error"]
      );
      assert.include(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect("syncs past a designer collection whose values and types are newer than the sync", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const brandId = figma.addCollection("Brand (designers)", ["Default"]);
      figma.addVariable(brandId, "gradient", "FUTURE_TYPE", { type: "FUTURE_VALUE", payload: "linear" });
      figma.addVariable(brandId, "accent", "COLOR", { type: "FUTURE_VALUE", payload: "mix" });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      yield* run(figma, ["--file-key", FILE_KEY, "check"]);

      assert.include(yield* output, "reading it back matches the tokens");
      assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);
      assert.deepStrictEqual(figma.variableNames("Brand (designers)"), ["gradient", "accent"]);
    })
  );

  it.effect("refuses to take over a variable whose type is newer than the sync", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const tokensId = figma.addCollection("Fuse tokens", ["Light", "Dark"]);
      figma.addVariable(tokensId, "radius", "FUTURE_TYPE", { type: "FUTURE_VALUE", payload: "" });

      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "sync"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(writes(figma), 0);
      assert.include(
        yield* errors,
        '"Fuse tokens/radius" is a FUTURE_TYPE variable in Figma but the tokens define a FLOAT.'
      );
    })
  );
});

describe("fuse-figma check", () => {
  it.effect("prints the plan for an empty file and writes nothing", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "check"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(writes(figma), 0);
      assert.deepStrictEqual(figma.collectionNames(), []);
      const printed = yield* output;
      // Up to 10 changes of a kind are listed one by one, and larger groups are counted.
      assert.include(printed, "Fuse tokens: create collection");
      assert.include(printed, "Fuse tokens: create mode Light");
      assert.include(printed, "Fuse tokens: create mode Dark");
      assert.include(printed, "Fuse brand: create mode Telinet (private only)");
      assert.include(printed, "Fuse brand: create variable ×792");
      assert.notInclude(printed, "Fuse brand: create variable light/external/private/primary");
      assert.include(printed, "Fuse segment: create variable ×396");
      assert.include(printed, "Fuse variant: create variable ×237");
      assert.include(printed, "Fuse density: create mode Auto");
      assert.include(printed, "Fuse density: create mode Comfortable");
      assert.include(printed, "Fuse density: create variable ×39");
    })
  );

  it.effect("passes on a synced file and fails on drift without writing", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      yield* run(figma, ["--file-key", FILE_KEY, "check"]);
      assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);

      figma.setValue("Fuse tokens", "ring", "Dark", { r: 0, g: 1, b: 0, a: 1 });
      figma.setMetadata("Fuse tokens", "primary", {
        ...figma.metadata("Fuse tokens", "primary"),
        description: "A designer's note.",
      });
      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "check"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(Runtime.getErrorExitCode(failure), 2);
      assert.strictEqual(writes(figma), 1);
      const printed = yield* output;
      assert.include(printed, "Fuse tokens: set value of ring in Dark");
      assert.include(printed, "Fuse tokens: update scopes, code syntax or description of primary");
      assert.include(
        yield* errors,
        `Figma file ${FILE_KEY} differs from the Fuse tokens in 2 places. Run \`sync\` to update it.`
      );
    })
  );

  it.effect("exits 1 when the check cannot run, so drift stays distinguishable", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);

      const refused = yield* Effect.flip(
        run(figma, ["--file-key", FILE_KEY, "check"], { FIGMA_TOKEN: "figd_wrong" })
      );
      const conflict = new InMemoryFigma(FILE_KEY, TOKEN);
      const tokensId = conflict.addCollection("Fuse tokens", ["Light", "Dark"]);
      conflict.addVariable(tokensId, "radius", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
      const retyped = yield* Effect.flip(run(conflict, ["--file-key", FILE_KEY, "check"]));

      assert.strictEqual(Runtime.getErrorExitCode(refused), 1);
      assert.strictEqual(Runtime.getErrorExitCode(retyped), 1);
    })
  );
});

describe("fuse-figma talking to Figma", () => {
  it.effect("waits out a rate-limited read for as long as Retry-After asks", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.script({ method: "GET", status: 429, headers: { "retry-after": "30" } });

      const fiber = yield* Effect.forkChild(run(figma, ["--file-key", FILE_KEY, "check"]).pipe(Effect.flip));
      yield* TestClock.adjust("29 seconds");
      assert.strictEqual(figma.requests.length, 1);
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(fiber);

      assert.strictEqual(figma.requests.length, 2);
      assert.include(yield* output, "Figma request failed (429); retry 1 of 4 in 30s.");
    })
  );

  it.effect("fails at once when Retry-After asks for a longer wait than the sync allows", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.script({ method: "GET", status: 429, headers: { "retry-after": "3600" } });

      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "check"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(figma.requests.length, 1);
      assert.notInclude(yield* output, "retry 1 of 4");
      assert.include(
        yield* errors,
        "Figma asked the sync to wait 3600 seconds before the next request, longer than the 60 seconds it waits; try again later."
      );
    })
  );

  it.effect("does not repeat a write that failed on the server", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.script({ method: "POST", status: 500 });

      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "sync"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(writes(figma), 1);
      assert.include(yield* errors, "Could not write variables: Figma answered 500 (Scripted failure).");
    })
  );

  it.effect("retries a rate-limited write once Retry-After has passed", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.script({ method: "POST", status: 429, headers: { "retry-after": "1" } });

      const fiber = yield* Effect.forkChild(run(figma, ["--file-key", FILE_KEY, "sync"]));
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(fiber);

      assert.strictEqual(writes(figma), 2);
      assert.strictEqual(figma.acceptedWrites.length, 1);
      assert.include(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect.each([
    {
      fault: "hit a server error",
      inject: (figma: InMemoryFigma) => figma.script({ method: "GET", status: 503 }),
    },
    { fault: "whose connection dropped", inject: (figma: InMemoryFigma) => figma.dropNextConnection("GET") },
  ])("retries a read that $fault", ({ inject }) =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      inject(figma);

      const fiber = yield* Effect.forkChild(run(figma, ["--file-key", FILE_KEY, "sync"]));
      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);

      // The failed read, its retry, and the read-back after the write.
      assert.strictEqual(reads(figma), 3);
      assert.strictEqual(writes(figma), 1);
      assert.include(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect("gives up on a read after the first request and four retries", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      for (let count = 0; count < 6; count += 1) figma.script({ method: "GET", status: 500 });

      const fiber = yield* Effect.forkChild(run(figma, ["--file-key", FILE_KEY, "check"]).pipe(Effect.flip));
      yield* TestClock.adjust("10 minutes");
      const failure = yield* Fiber.join(fiber);

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(figma.requests.length, 5);
      assert.include(yield* errors, "Could not read variables: Figma answered 500 (Scripted failure).");
    })
  );

  it.effect("explains a refused token", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);

      yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "check"], { FIGMA_TOKEN: "figd_wrong" }));

      const printed = yield* errors;
      assert.include(printed, "Could not read variables: Figma answered 403 (Invalid token).");
      assert.include(printed, "Enterprise plan");
      assert.notInclude(printed, "figd_wrong");
    })
  );

  it.effect("needs FIGMA_TOKEN to sync but not to print help", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--help"], {});
      assert.include(yield* output, "check");

      yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "sync"], {}));
      assert.include(yield* errors, "Set FIGMA_TOKEN to a Figma personal access token");
      assert.strictEqual(figma.requests.length, 0);
    })
  );

  it.effect("reads the file key from FIGMA_FILE_KEY and rejects keys that are not one", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["check"], { FIGMA_TOKEN: TOKEN, FIGMA_FILE_KEY: FILE_KEY }).pipe(Effect.flip);
      assert.deepStrictEqual(figma.requests[0], {
        method: "GET",
        path: `/v1/files/${FILE_KEY}/variables/local`,
      });

      const failure = yield* Effect.flip(run(figma, ["--file-key", "../other", "check"]));
      assert.strictEqual(failure._tag, "ShowHelp");
      assert.strictEqual(figma.requests.length, 1);
    })
  );
});
