import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as Tracer from "effect/Tracer";

import { FigmaApi, FileKey } from "../src/figma-api.ts";
import { syncFile } from "../src/token-sync.ts";
import { makeVariableSet } from "../src/variable-set.ts";
import type { VariableSet, VariableSpec, VariableValue } from "../src/variable-set.ts";
import { writes } from "./cli-fixture.ts";
import { InMemoryFigma } from "./in-memory-figma.ts";

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const FILE_KEY = Schema.decodeSync(FileKey)("FuseFile123");
const TOKEN = "figd_secret-token-4711";

/** The REST adapter over the fake file, or over `client` when given, authenticated with `TOKEN`. */
function figmaApi(figma: InMemoryFigma, client: Layer.Layer<HttpClient.HttpClient> = figma.layer()) {
  return FigmaApi.layer.pipe(
    Layer.provide(client),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { FIGMA_TOKEN: TOKEN } })))
  );
}

/** A tracer that keeps every span it starts, the way an exporter would receive them. */
function recordingTracer() {
  const spans: Tracer.NativeSpan[] = [];
  const tracer = Tracer.make({
    span(options) {
      const span = new Tracer.NativeSpan(options);
      spans.push(span);
      return span;
    },
  });
  return { spans, tracer };
}

/** Everything a span exporter could publish about a span, as text. */
function exported(span: Tracer.NativeSpan): string[] {
  const attributes = [...span.attributes].map(([name, value]) => `${name}=${String(value)}`);
  const events = span.events.map(([name, , eventAttributes]) => `${name} ${JSON.stringify(eventAttributes)}`);
  const exit =
    span.status._tag === "Ended" && span.status.exit._tag === "Failure"
      ? [Cause.pretty(span.status.exit.cause)]
      : [];
  return [span.name, ...attributes, ...events, ...exit];
}

describe("FigmaApi and the token", () => {
  it.effect("masks the token on every request span of a sync", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const { spans, tracer } = recordingTracer();

      // Header capture is opt-in; a host that records every header must still see the mask.
      yield* syncFile(FILE_KEY, palette("destructive")).pipe(
        Effect.provide(figmaApi(figma)),
        Effect.provideService(HttpClient.TracerHeaderFilter, () => true),
        Effect.withTracer(tracer)
      );

      const requests = spans.filter((span) => span.attributes.has("http.request.method"));
      // Read, write and read back.
      assert.deepStrictEqual(
        requests.map((span) => span.attributes.get("http.request.method")),
        ["GET", "POST", "GET"]
      );
      for (const span of requests) {
        assert.strictEqual(span.attributes.get("http.request.header.x-figma-token"), "<redacted>");
      }
      for (const text of spans.flatMap(exported)) assert.notInclude(text, TOKEN);
    })
  );

  it.effect("keeps the token out of a transport failure and its spans", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      for (let count = 0; count < 5; count += 1) figma.dropNextConnection("GET");
      const { spans, tracer } = recordingTracer();

      const fiber = yield* Effect.forkChild(
        Effect.gen(function* () {
          const api = yield* FigmaApi;
          return yield* api.readVariables(FILE_KEY);
        }).pipe(Effect.provide(figmaApi(figma)), Effect.withTracer(tracer), Effect.flip)
      );
      yield* TestClock.adjust("1 minute");
      const failure = yield* Fiber.join(fiber);

      assert.strictEqual(failure._tag, "FigmaRequestFailed");
      assert.deepStrictEqual(failure.cause, {
        reason: "TransportError",
        method: "GET",
        url: "https://api.figma.com/v1/files/FuseFile123/variables/local",
      });
      assert.notInclude(yield* encodeJson(failure), TOKEN);
      assert.notInclude(String(failure), TOKEN);
      assert.strictEqual(spans.filter((span) => span.attributes.has("http.request.method")).length, 5);
      for (const text of spans.flatMap(exported)) assert.notInclude(text, TOKEN);
    })
  );
});

const RED = { r: 1, g: 0, b: 0, a: 1 };

/**
 * The variables `error` and `destructive`, in that order as in the Fuse tokens. `aliasing`
 * names the one that aliases the other, which holds red.
 */
function palette(aliasing: "error" | "destructive"): VariableSet {
  const other = { error: "destructive", destructive: "error" } as const;
  const variable = (name: "error" | "destructive"): VariableSpec => ({
    name,
    type: "COLOR",
    scopes: ["ALL_SCOPES"],
    webSyntax: undefined,
    description: "",
    values: new Map<string, VariableValue>([
      [
        "Value",
        name === aliasing
          ? { _tag: "Alias", target: { collection: "Palette", variable: other[name] } }
          : { _tag: "Color", color: RED },
      ],
    ]),
  });
  const result = makeVariableSet([
    { name: "Palette", modes: ["Value"], variables: [variable("error"), variable("destructive")] },
  ]);
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

/** A generated set: string variables in `Words`, one phrase per locale, and two aliases to them. */
type Phrasebook = {
  readonly set: VariableSet;
  readonly phrases: number;
  readonly locales: readonly string[];
  readonly text: (index: number, locale: string) => string;
};

/**
 * Make a phrasebook. A phrase repeats "blåbærsyltetøy " and a description repeats "Blåbærsyltetøy
 * på brødskive. ". Their å, æ and ø take two bytes each in UTF-8, so their bytes outnumber their
 * characters. `Aliases/greeting` aliases the first phrase and `Aliases/farewell` the last.
 */
function makePhrasebook(size: {
  readonly phrases: number;
  readonly locales: number;
  readonly phraseRepeats: number;
  readonly descriptionRepeats: number;
}): Phrasebook {
  const locales = Array.from({ length: size.locales }, (_, index) => `Locale ${String(index + 1)}`);
  const text = (index: number, locale: string) =>
    `${locale} phrase ${String(index)}: ${"blåbærsyltetøy ".repeat(size.phraseRepeats)}`;
  const description = "Blåbærsyltetøy på brødskive. ".repeat(size.descriptionRepeats);
  const words = Array.from({ length: size.phrases }, (_, index): VariableSpec => ({
    name: `phrase/${String(index)}`,
    type: "STRING",
    scopes: ["ALL_SCOPES"],
    webSyntax: undefined,
    description,
    values: new Map(
      locales.map((locale): [string, VariableValue] => [
        locale,
        { _tag: "String", value: text(index, locale) },
      ])
    ),
  }));
  const alias = (name: string, target: string): VariableSpec => ({
    name,
    type: "STRING",
    scopes: ["ALL_SCOPES"],
    webSyntax: undefined,
    description: "",
    values: new Map([["Value", { _tag: "Alias", target: { collection: "Words", variable: target } }]]),
  });
  const result = makeVariableSet([
    { name: "Words", modes: locales, variables: words },
    {
      name: "Aliases",
      modes: ["Value"],
      variables: [alias("greeting", "phrase/0"), alias("farewell", `phrase/${String(size.phrases - 1)}`)],
    },
  ]);
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return { set: result.success, phrases: size.phrases, locales, text };
}

/**
 * About 9.4 MB: 40 variables with 112 KB descriptions, 4.5 MB in all, and their 31 KB phrases
 * in 4 locales, 4.9 MB in all. The variables alone pass the limit, and so do the values.
 */
const large = makePhrasebook({ phrases: 40, locales: 4, phraseRepeats: 1700, descriptionRepeats: 3300 });

/**
 * About 5 MB in 20 phrases of 252 KB in one locale, without descriptions. It passes the limit
 * once, and a request holds at most 15 of its phrases, so its write takes exactly two requests.
 */
const twoRequests = makePhrasebook({ phrases: 20, locales: 1, phraseRepeats: 14_000, descriptionRepeats: 0 });

/** Check the file the way a designer's frame reads it, against the phrases the set was made from. */
function assertHolds(figma: InMemoryFigma, book: Phrasebook): void {
  const [first = "", ...rest] = book.locales;
  const last = rest.at(-1) ?? first;
  const middle = Math.floor(book.phrases / 2);
  assert.deepStrictEqual(figma.collectionNames(), ["Words", "Aliases"]);
  assert.deepStrictEqual(figma.modeNames("Words"), book.locales);
  assert.strictEqual(figma.variableNames("Words").length, book.phrases);
  assert.strictEqual(
    figma.resolve("Words", `phrase/${String(middle)}`, { Words: last }),
    book.text(middle, last)
  );
  assert.strictEqual(figma.resolve("Aliases", "greeting", { Words: last }), book.text(0, last));
  assert.strictEqual(figma.resolve("Aliases", "farewell", {}), book.text(book.phrases - 1, first));
}

/** The collection, mode and variable ids a file holds, by name, to check that a rerun keeps them. */
function ids(figma: InMemoryFigma): Map<string, string> {
  const found = new Map(figma.variableIds());
  for (const collection of figma.collectionNames()) {
    found.set(collection, figma.collectionId(collection));
    for (const mode of figma.modeNames(collection)) {
      found.set(`${collection} mode ${mode}`, figma.modeId(collection, mode));
    }
  }
  return found;
}

function sync(figma: InMemoryFigma, set: VariableSet, client?: Layer.Layer<HttpClient.HttpClient>) {
  return syncFile(FILE_KEY, set).pipe(Effect.provide(figmaApi(figma, client)));
}

/** The fake's client, with the response to the POST at `position` replaced by `replace`. */
function replacingResponse(
  figma: InMemoryFigma,
  position: number,
  replace: (
    response: HttpClientResponse.HttpClientResponse
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>
): Layer.Layer<HttpClient.HttpClient> {
  return Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, (inner) =>
      inner.pipe(
        HttpClient.transformResponse(
          Effect.flatMap((response) =>
            response.request.method === "POST" && writes(figma) === position
              ? replace(response)
              : Effect.succeed(response)
          )
        )
      )
    )
  ).pipe(Layer.provide(figma.layer()));
}

/** The part of Figma's response to a POST that maps temporary ids to real ones. */
const WriteResponse = Schema.Struct({
  meta: Schema.Struct({ tempIdToRealId: Schema.Record(Schema.String, Schema.String) }),
});

/** A set with one collection per name and nothing else in it. */
function collectionsNamed(names: readonly string[]): VariableSet {
  const result = makeVariableSet(names.map((name) => ({ name, modes: ["Value"], variables: [] })));
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

describe("a sync whose write passes Figma's 4 MB request limit", () => {
  it.effect("writes it in several requests, and a rerun converges after a failure between any two", () =>
    Effect.gen(function* () {
      const clean = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* sync(clean, large.set);
      assertHolds(clean, large);
      const requests = writes(clean);
      // The write is about 9.4 MB, so it needs at least three requests. The first holds every
      // collection and mode change. The variables alone pass the limit, so the first request
      // ends inside them and holds no values.
      assert.isAtLeast(requests, 3);
      const [first] = clean.acceptedWrites;
      assert.lengthOf(first?.variableCollections ?? [], 2);
      assert.lengthOf(first?.variableModes ?? [], large.locales.length + 1);
      assert.deepStrictEqual(first?.variableModeValues ?? [], []);

      for (let applied = 1; applied < requests; applied += 1) {
        const figma = new InMemoryFigma(FILE_KEY, TOKEN);
        figma.script({ method: "POST", status: 500, position: applied + 1 });
        const failure = yield* Effect.flip(sync(figma, large.set));
        assert.strictEqual(figma.acceptedWrites.length, applied);
        const kept = applied === 1 ? "the first request" : `the first ${String(applied)} requests`;
        assert.include(failure.message, `Figma kept ${kept} of this sync`);
        assert.notInclude(failure.message, "A new file can refuse every REST variable write");
        const before = ids(figma);

        yield* sync(figma, large.set);

        const after = ids(figma);
        for (const [name, id] of before) {
          assert.strictEqual(after.get(name), id, `${name} after ${String(applied)} requests`);
        }
        assertHolds(figma, large);
      }
    })
  );

  it.effect("retries only the rate-limited request and finishes the write", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      figma.script({ method: "POST", status: 429, headers: { "retry-after": "1" }, position: 2 });

      const fiber = yield* Effect.forkChild(sync(figma, twoRequests.set));
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(fiber);

      // Two requests, and the second one twice.
      assert.strictEqual(writes(figma), 3);
      assert.strictEqual(figma.acceptedWrites.length, 2);
      assertHolds(figma, twoRequests);
    })
  );

  it.effect("counts only the answered requests as kept when a response never arrives", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      // The fake applies the second request, and its response is lost on the way back.
      const client = replacingResponse(figma, 2, (response) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({
              request: response.request,
              cause: new Error("socket hang up"),
            }),
          })
        )
      );

      const failure = yield* Effect.flip(sync(figma, twoRequests.set, client));

      assert.strictEqual(figma.acceptedWrites.length, 2);
      assert.include(
        failure.message,
        "Figma kept the first request of this sync. Whether Figma applied the last request is unknown. The next sync reads the file and writes whatever is missing."
      );
      yield* sync(figma, twoRequests.set);
      assertHolds(figma, twoRequests);
    })
  );

  it.effect("fails without a second request when Figma's response omits a created id", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const omitted: string[] = [];
      const client = replacingResponse(figma, 1, (response) =>
        Effect.gen(function* () {
          const { meta } = yield* response.json.pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(WriteResponse)),
            Effect.orDie
          );
          const [first, ...rest] = Object.entries(meta.tempIdToRealId);
          if (first !== undefined) omitted.push(first[0]);
          return HttpClientResponse.fromWeb(
            response.request,
            Response.json({ meta: { tempIdToRealId: Object.fromEntries(rest) } })
          );
        })
      );

      const failure = yield* Effect.flip(sync(figma, twoRequests.set, client));

      assert.lengthOf(omitted, 1);
      assert.strictEqual(
        failure.message,
        `Could not write variables: Figma's response omits the real id of ${omitted[0] ?? ""}. Figma kept the first request of this sync, so the file is partly synced. Run sync again to write the rest.`
      );
      assert.strictEqual(writes(figma), 1);
    })
  );

  it.effect("sends nothing when one change alone passes the limit, and names it", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      const huge = makeVariableSet([
        {
          name: "Huge",
          modes: ["Value"],
          variables: [
            {
              name: "text",
              type: "STRING",
              scopes: ["ALL_SCOPES"],
              webSyntax: undefined,
              description: "",
              values: new Map([["Value", { _tag: "String", value: "x".repeat(4_100_000) }]]),
            },
          ],
        },
      ]);
      if (Result.isFailure(huge)) throw new Error(huge.failure.message);

      const failure = yield* Effect.flip(sync(figma, huge.success));

      assert.include(failure.message, 'The value of "Huge/text" in mode "Value" alone takes');
      assert.include(failure.message, "The sync sent nothing.");
      assert.strictEqual(writes(figma), 0);
    })
  );

  it.effect("sends nothing when the collection and mode changes together pass the limit", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      // Each collection fits a request of its own, and the two together do not.
      const set = collectionsNamed([`A ${"x".repeat(2_100_000)}`, `B ${"x".repeat(2_100_000)}`]);

      const failure = yield* Effect.flip(sync(figma, set));

      assert.include(failure.message, "The collection and mode changes take");
      assert.include(failure.message, "The sync sent nothing.");
      assert.strictEqual(writes(figma), 0);
    })
  );
});
