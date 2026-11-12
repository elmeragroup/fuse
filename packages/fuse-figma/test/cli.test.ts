import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber, Runtime } from "effect";
import { TestClock } from "effect/testing";

import { errors, FILE_KEY, hex, light, output, reads, run, TOKEN, writes } from "./cli-fixture.ts";
import { InMemoryFigma } from "./in-memory-figma.ts";

describe("fuse-figma sync", () => {
  it.effect("writes nothing when the file already matches", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      assert.strictEqual(writes(figma), 1);
      assert.include(yield* output, `Figma file ${FILE_KEY} already matches the Fuse tokens.`);
    })
  );

  it.effect("leaves code syntax alone on the variables whose web syntax it does not set", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);
      const id = figma.variableIds().get("Fuse segment/light/branded/primary");
      if (id === undefined) throw new Error("the first sync creates light/branded/primary");
      figma.setMetadata("Fuse segment", "light/branded/primary", {
        scopes: ["ALL_SCOPES"],
        codeSyntax: { WEB: "var(--designer)", ANDROID: "R.color.designer" },
        description: "A designer's note.",
      });

      yield* run(figma, ["--file-key", FILE_KEY, "sync"]);

      // The write carries no codeSyntax at all, so it is safe whether Figma merges or replaces it.
      assert.deepStrictEqual(figma.acceptedWrites.at(-1)?.variables, [
        { action: "UPDATE", id, scopes: [], description: "" },
      ]);
      assert.deepStrictEqual(figma.metadata("Fuse segment", "light/branded/primary"), {
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
        hex(figma.resolve("Fuse tokens", "primary", light("branded-elma-company"))),
        "#00313C"
      );
    })
  );

  it.effect("fails when reading the file back still differs from the tokens", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.afterNextWrite(() =>
        figma.setValue("Fuse brand", "light/branded/private/primary", "Fjordkraft", {
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
      assert.include(printed, "Fuse brand: create variable ×1744");
      assert.notInclude(printed, "Fuse brand: create variable light/branded/private/primary");
      assert.include(printed, "Fuse segment: create variable ×872");
      assert.include(printed, "Fuse identity: create variable ×436");
      assert.include(printed, "Fuse density: create mode Dense");
      assert.notInclude(printed, "Fuse density: create mode Auto");
      assert.include(printed, "Fuse density: create mode Comfortable");
      assert.include(printed, "Fuse density: create variable ×55");
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
