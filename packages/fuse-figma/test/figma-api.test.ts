import { assert, describe, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Fiber, Layer, Result, Schema, Tracer } from "effect";
import { TestClock } from "effect/testing";

import { FigmaApi, FileKey } from "../src/figma-api.ts";
import { syncFile } from "../src/token-sync.ts";
import { makeVariableSet } from "../src/variable-set.ts";
import type { VariableSet, VariableSpec, VariableValue } from "../src/variable-set.ts";
import { InMemoryFigma } from "./in-memory-figma.ts";

const FILE_KEY = Schema.decodeUnknownSync(FileKey)("FuseFile123");
const TOKEN = "figd_secret-token-4711";

/** The REST adapter over the fake file, authenticated with `TOKEN`. */
function figmaApi(figma: InMemoryFigma) {
  return FigmaApi.layer.pipe(
    Layer.provide(figma.layer()),
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

      yield* syncFile(FILE_KEY, palette("destructive")).pipe(
        Effect.provide(figmaApi(figma)),
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
      assert.notInclude(JSON.stringify(failure), TOKEN);
      assert.notInclude(String(failure), TOKEN);
      assert.strictEqual(spans.filter((span) => span.attributes.has("http.request.method")).length, 5);
      for (const text of spans.flatMap(exported)) assert.notInclude(text, TOKEN);
    })
  );
});

describe("syncFile against the fake file", () => {
  it.effect("reverses an alias without passing through a cycle", () =>
    Effect.gen(function* () {
      const figma = new InMemoryFigma(FILE_KEY, TOKEN);
      yield* syncFile(FILE_KEY, palette("destructive")).pipe(Effect.provide(figmaApi(figma)));
      const destructive = figma.variableIds().get("Palette/destructive");
      const error = figma.variableIds().get("Palette/error");
      if (destructive === undefined || error === undefined) throw new Error("the first sync creates both");

      // The tokens flip the alias. Written in set order, error would alias destructive while
      // destructive still aliased error, and the fake checks for a cycle after each value.
      yield* syncFile(FILE_KEY, palette("error")).pipe(Effect.provide(figmaApi(figma)));

      assert.deepStrictEqual(figma.acceptedWrites.at(-1)?.variableModeValues, [
        { variableId: destructive, modeId: figma.modeId("Palette", "Value"), value: RED },
        {
          variableId: error,
          modeId: figma.modeId("Palette", "Value"),
          value: { type: "VARIABLE_ALIAS", id: destructive },
        },
      ]);
      assert.deepStrictEqual(figma.aliasChain("Palette", "error", {}), [
        "Palette/error",
        "Palette/destructive",
      ]);
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
