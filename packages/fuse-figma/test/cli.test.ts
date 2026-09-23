import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Fiber, FileSystem, Layer, Path, Runtime, Stdio, Terminal } from "effect";
import { TestClock, TestConsole } from "effect/testing";
import { CliOutput } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";

import { runCli } from "../src/cli.ts";
import { InMemoryFigma } from "./in-memory-figma.ts";

const FILE_KEY = "FuseFile123";
const TOKEN = "figd_test-token";

const cliEnvironment = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(100),
      rows: Effect.succeed(40),
      readInput: Effect.die("the CLI never reads input"),
      readLine: Effect.die("the CLI never reads input"),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("the CLI never spawns processes"))
  ),
  CliOutput.layer(CliOutput.defaultFormatter({ colors: false }))
);

function environment(figma: InMemoryFigma, env: Record<string, string> = { FIGMA_TOKEN: TOKEN }) {
  return Layer.mergeAll(cliEnvironment, figma.layer(), ConfigProvider.layer(ConfigProvider.fromEnv({ env })));
}

function run(figma: InMemoryFigma, argv: readonly string[], env?: Record<string, string>) {
  return runCli(argv).pipe(Effect.provide(environment(figma, env)));
}

const output = Effect.map(TestConsole.logLines, (lines) => lines.map(String).join("\n"));
const errors = Effect.map(TestConsole.errorLines, (lines) => lines.map(String).join("\n"));

function writes(figma: InMemoryFigma): number {
  return figma.requests.filter((request) => request.method === "POST").length;
}

function reads(figma: InMemoryFigma): number {
  return figma.requests.filter((request) => request.method === "GET").length;
}

function hex(value: ReturnType<InMemoryFigma["resolve"]>): string {
  if (!(value instanceof Object)) throw new Error(`expected a color, got ${String(value)}`);
  const byte = (channel: number) =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${byte(value.r)}${byte(value.g)}${byte(value.b)}`;
}

const light = (theme: string) => ({ "Fuse tokens": "Light", "Fuse themes": theme });
const dark = (theme: string) => ({ "Fuse tokens": "Dark", "Fuse themes": theme });

describe("fuse-figma sync", () => {
  it.effect("creates the three Fuse collections in an empty file", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.collectionNames(), ["Fuse primitives", "Fuse themes", "Fuse tokens"]);
      assert.deepStrictEqual(figma.modeNames("Fuse tokens"), ["Light", "Dark"]);
      assert.deepStrictEqual(figma.modeNames("Fuse primitives"), ["Value"]);
      const themeModes = figma.modeNames("Fuse themes");
      assert.strictEqual(themeModes.length, 20);
      assert.includeMembers(themeModes, [
        "internal-fkas-private",
        "external-elma-company",
        "external-fkab-company",
        "external-fkse-private",
      ]);
      assert.notInclude(themeModes, "external-fkab-private");
      assert.strictEqual(figma.variableNames("Fuse tokens").length, 79);
      assert.strictEqual(figma.variableNames("Fuse themes").length, 158);
      assert.strictEqual(figma.variableNames("Fuse primitives").length, 23);
      assert.strictEqual(writes(figma), 1);
      assert.include(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect("resolves token values the way a designer's frame sees them", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // Pinned in the docs DTCG export for the same theme.
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("external-elma-company"))),
        "#3C6470"
      );
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary-foreground", light("external-fkas-private"))),
        "#FFFFFF"
      );
      assert.strictEqual(figma.resolve("Fuse tokens", "radius", light("external-elma-company")), 6);
      // 1.8125rem at the 16px root.
      assert.strictEqual(figma.resolve("Fuse tokens", "radius-button", light("external-fkas-private")), 29);
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
        ["Fuse tokens/secondary-hover", "Fuse themes/light/secondary-hover"]
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
        "Fuse themes/light/brand",
        "Fuse primitives/brand-tkas",
      ]);
      // destructive aliases the error role of the same scheme.
      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "destructive", dark("external-tkas-company")).slice(0, 3),
        ["Fuse tokens/destructive", "Fuse themes/dark/destructive", "Fuse themes/dark/error"]
      );
    })
  );

  it.effect("sets code syntax and picker scopes on the variables designers can bind", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.metadata("Fuse tokens", "primary"), {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--primary)" },
      });
      assert.deepStrictEqual(figma.metadata("Fuse tokens", "radius"), {
        scopes: ["CORNER_RADIUS"],
        codeSyntax: { WEB: "var(--radius)" },
      });
      assert.deepStrictEqual(figma.metadata("Fuse tokens", "font-sans"), {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--font-sans)" },
      });
      assert.deepStrictEqual(figma.metadata("Fuse tokens", "secondary-hover"), {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--secondary-hover)" },
      });
      // radius-step spaces the radius scale, so no picker offers it for a corner.
      assert.deepStrictEqual(figma.metadata("Fuse tokens", "radius-step"), {
        scopes: [],
        codeSyntax: { WEB: "var(--radius-step)" },
      });
      assert.deepStrictEqual(figma.metadata("Fuse primitives", "neutral-500"), {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--neutral-500)" },
      });
      assert.deepStrictEqual(figma.metadata("Fuse themes", "light/primary"), { scopes: [], codeSyntax: {} });
    })
  );

  it.effect("keeps a designer's Android and iOS code syntax when it corrects the web entry", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const id = figma.variableIds().get("Fuse tokens/primary");
      if (id === undefined) throw new Error("the first sync creates primary");
      figma.setMetadata("Fuse tokens", "primary", {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--old-primary)", ANDROID: "R.color.primary", iOS: "Color.primary" },
      });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // The fake replaces code syntax on an update, so the write must carry every platform.
      assert.deepStrictEqual(figma.acceptedWrites.at(-1)?.variables, [
        {
          action: "UPDATE",
          id,
          scopes: ["ALL_SCOPES"],
          codeSyntax: { WEB: "var(--primary)", ANDROID: "R.color.primary", iOS: "Color.primary" },
        },
      ]);
      assert.deepStrictEqual(figma.metadata("Fuse tokens", "primary"), {
        scopes: ["ALL_SCOPES"],
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

  it.effect("repairs a drifted value in place, keeping every variable id", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const idsBefore = figma.variableIds();
      const synced = hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-private")));
      figma.setValue("Fuse themes", "light/primary", "external-fkas-private", { r: 1, g: 0, b: 0, a: 1 });

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

  it.effect("rewrites a composed color in a variable it owns", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const synced = hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-private")));
      const accent = figma.variableIds().get("Fuse primitives/brand-fkas") ?? "";
      figma.setValue("Fuse themes", "light/primary", "external-fkas-private", {
        color: { type: "VARIABLE_ALIAS", id: accent },
        opacity: 50,
      });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.strictEqual(figma.acceptedWrites.at(-1)?.variableModeValues?.length, 1);
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
      const id = figma.variableIds().get("Fuse themes/light/primary");
      if (id === undefined) throw new Error("the first sync creates light/primary");
      figma.setMetadata("Fuse themes", "light/primary", {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--designer)", ANDROID: "R.color.designer" },
      });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // The write carries no codeSyntax at all, so it is safe whether Figma merges or replaces it.
      assert.deepStrictEqual(figma.acceptedWrites.at(-1)?.variables, [{ action: "UPDATE", id, scopes: [] }]);
      assert.deepStrictEqual(figma.metadata("Fuse themes", "light/primary"), {
        scopes: [],
        codeSyntax: { WEB: "var(--designer)", ANDROID: "R.color.designer" },
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

  it.effect("deletes a mode the tokens dropped instead of renaming it to the mode they added", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.addCollection("Fuse tokens", ["Light", "Sepia"]);
      const lightId = figma.modeId("Fuse tokens", "Light");
      const sepiaId = figma.modeId("Fuse tokens", "Sepia");

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.modeNames("Fuse tokens"), ["Light", "Dark"]);
      const [keptId, darkId] = figma.modeIds("Fuse tokens");
      assert.strictEqual(keptId, lightId);
      // Frames pinned to Sepia lose the mode; none of them silently turn Dark.
      assert.notStrictEqual(darkId, sepiaId);
      assert.notInclude(figma.modeIds("Fuse tokens"), sepiaId);
      // The new Dark mode holds the dark aliases.
      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "primary", dark("external-elma-company")).slice(0, 2),
        ["Fuse tokens/primary", "Fuse themes/dark/primary"]
      );
      const printed = yield* output;
      assert.include(printed, "Fuse tokens: delete mode Sepia");
      assert.include(printed, "Fuse tokens: create mode Dark");
      assert.notInclude(printed, "rename");
    })
  );

  it.effect("ignores library collections and extensions that share a Fuse collection's name", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const libraryId = figma.addLibraryCollection("Fuse tokens", ["Light", "Dark"]);
      const libraryPrimary = figma.addVariable(libraryId, "primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 });
      const brandId = figma.addCollection("Brand (designers)", ["Light", "Dark"]);
      figma.addExtension("Fuse themes", brandId);

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(figma.collectionNames(), [
        "Brand (designers)",
        "Fuse primitives",
        "Fuse themes",
        "Fuse tokens",
      ]);
      assert.strictEqual(figma.variableNames("Fuse themes").length, 158);
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
        "#3C6470"
      );
    })
  );

  it.effect("fails when reading the file back still differs from the tokens", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.afterNextWrite(() =>
        figma.setValue("Fuse themes", "light/primary", "external-fkas-private", { r: 1, g: 0, b: 0, a: 1 })
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
      // cycle, so destructive first gets a literal in every theme.
      for (const theme of figma.modeNames("Fuse themes")) {
        figma.setValue("Fuse themes", "light/destructive", theme, { r: 1, g: 0, b: 0, a: 1 });
      }
      const destructive = figma.variableIds().get("Fuse themes/light/destructive") ?? "";
      figma.setValue("Fuse themes", "light/error", "external-elma-company", {
        type: "VARIABLE_ALIAS",
        id: destructive,
      });

      // The fake checks for a cycle after each value, so this passes only when error gets its
      // literal back before destructive aliases it again.
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.deepStrictEqual(
        figma.aliasChain("Fuse tokens", "destructive", light("external-elma-company")).slice(0, 3),
        ["Fuse tokens/destructive", "Fuse themes/light/destructive", "Fuse themes/light/error"]
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

  it.effect("rewrites a value newer than the sync in a variable it owns", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const synced = hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-private")));
      figma.setValue("Fuse themes", "light/primary", "external-fkas-private", {
        type: "FUTURE_VALUE",
        payload: "mix",
      });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.strictEqual(figma.acceptedWrites.at(-1)?.variableModeValues?.length, 1);
      assert.strictEqual(
        hex(figma.resolve("Fuse tokens", "primary", light("external-fkas-private"))),
        synced
      );
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

  it.effect("refuses to change a variable's type", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const tokensId = figma.addCollection("Fuse tokens", ["Light", "Dark"]);
      figma.addVariable(tokensId, "radius", "COLOR", { r: 0, g: 0, b: 0, a: 1 });

      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "sync"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(writes(figma), 0);
      assert.include(
        yield* errors,
        '"Fuse tokens/radius" is a COLOR variable in Figma but the tokens define a FLOAT.'
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
      assert.include(printed, "Fuse themes: create mode ×20");
      assert.notInclude(printed, "Fuse themes: create mode external-elma-company");
      assert.include(printed, "Fuse themes: create variable ×158");
    })
  );

  it.effect("passes on a synced file and fails on drift without writing", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      yield* run(figma, ["--file-key", FILE_KEY, "check"]);
      assert.include(yield* output, `Figma file ${FILE_KEY} matches the Fuse tokens.`);

      figma.setValue("Fuse tokens", "ring", "Dark", { r: 0, g: 1, b: 0, a: 1 });
      figma.setMetadata("Fuse tokens", "primary", { scopes: [], codeSyntax: { WEB: "var(--primary)" } });
      const failure = yield* Effect.flip(run(figma, ["--file-key", FILE_KEY, "check"]));

      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(Runtime.getErrorExitCode(failure), 2);
      assert.strictEqual(writes(figma), 1);
      const printed = yield* output;
      assert.include(printed, "Fuse tokens: set value of ring in Dark");
      assert.include(printed, "Fuse tokens: update scopes or code syntax of primary");
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

  it.effect("retries a read that hit a server error", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.script({ method: "GET", status: 503 });

      const fiber = yield* Effect.forkChild(run(figma, ["--file-key", FILE_KEY, "sync"]));
      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);

      // The failed read, its retry, and the read-back after the write.
      assert.strictEqual(reads(figma), 3);
      assert.strictEqual(writes(figma), 1);
      assert.include(yield* output, "reading it back matches the tokens");
    })
  );

  it.effect("retries a read whose connection dropped", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.dropNextConnection("GET");

      const fiber = yield* Effect.forkChild(run(figma, ["--file-key", FILE_KEY, "sync"]));
      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);

      assert.strictEqual(reads(figma), 3);
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
