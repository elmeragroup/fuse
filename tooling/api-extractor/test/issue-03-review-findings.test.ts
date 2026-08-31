/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- fake backend identities are opaque seam sentinels. */

import { Effect, Layer, Schema } from "effect";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  BackendCompilerOperations,
  BackendExtractionSession,
  BackendSymbolHandle,
  BackendTypeHandle,
} from "../src/backend/contracts.ts";
import { CompilerBackend } from "../src/backend/service.ts";
import { projectExtractorLayer } from "../src/extractor.ts";
import { ExtractionResultSchema, ProjectExtractor } from "../src/index.ts";

const fakeTsconfigPath = resolve(import.meta.dirname, "fixtures/issue-03-object-apis/tsconfig.json");
const fakeInputPath = resolve(import.meta.dirname, "fixtures/issue-03-object-apis/input.ts");

const synthesizedSymbol = {} as BackendSymbolHandle;
const generatedSymbol = {} as BackendSymbolHandle;
const synthesizedType = {} as BackendTypeHandle;
const generatedType = {} as BackendTypeHandle;
const missingEnumSymbol = {} as BackendSymbolHandle;
const missingEnumType = {} as BackendTypeHandle;

function synthesizedCompiler(): BackendCompilerOperations {
  return {
    typeOfSymbol: (symbol) => (symbol === synthesizedSymbol ? synthesizedType : undefined),
    typeAtNode: () => undefined,
    typeFacts: (type) =>
      type === synthesizedType
        ? { typeText: "Synthesized", flags: ["Object"], isObject: true, symbol: synthesizedSymbol }
        : { typeText: "number", flags: ["Number"], intrinsic: "number" },
    symbolFacts: (symbol) =>
      symbol === synthesizedSymbol
        ? { name: "Synthesized", flags: [], declarationPaths: [], declarations: [] }
        : { name: "generated", flags: [], declarationPaths: [], declarations: [] },
    nodeFacts: () => ({ kind: "unknown", text: "", filePath: fakeInputPath, line: 1, column: 1 }),
    typeNameFacts: (type) => (type === synthesizedType ? { name: "Synthesized", namespaces: [] } : undefined),
    signaturesOfType: () => [],
    signatureFacts: () => ({ parameters: [], typeParameters: [] }),
    declarationOwnership: () => ({ kind: "project" }),
    propertiesOfType: (type) => (type === synthesizedType ? [generatedSymbol] : []),
    propertyType: (symbol) => (symbol === generatedSymbol ? generatedType : undefined),
    indexSignaturesOfType: () => [],
    baseConstraintOfType: () => undefined,
    isArrayType: () => false,
    isReadonlyType: () => false,
    typeToString: () => "number",
  };
}

function synthesizedSession(): BackendExtractionSession {
  return {
    compiler: synthesizedCompiler(),
    readModule: () => ({ name: "input", exports: [{ name: "Synthesized", symbol: synthesizedSymbol }] }),
    resolveModule: () => undefined,
    close: () => undefined,
  };
}

describe("Issue 03 review regressions", () => {
  it("returns declarationless synthesized properties through the public extraction seam", async () => {
    const session = synthesizedSession();
    const backendLayer = Layer.succeed(CompilerBackend, {
      openProject: () =>
        Effect.succeed({
          openExtraction: () => session,
          close: () => undefined,
        }),
    });
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* ProjectExtractor;
          return yield* extractor.extractModule(fakeInputPath);
        }).pipe(
          Effect.provide(
            projectExtractorLayer({ tsconfigPath: fakeTsconfigPath }).pipe(Layer.provide(backendLayer))
          )
        )
      )
    );

    expect(result.module.exports[0]?.type).toMatchObject({
      kind: "object",
      properties: [{ name: "generated", type: { kind: "intrinsic", intrinsic: "number" } }],
    });
    expect(result.provenance).toEqual([
      { path: ["Synthesized"], declarationPaths: [], synthesized: true },
      { path: ["Synthesized", "properties", "generated"], declarationPaths: [], synthesized: true },
    ]);
    expect(Schema.decodeUnknownSync(ExtractionResultSchema)(result)).toEqual(result);
  });

  it("returns missing enum declarations as independently decodable structured warnings", async () => {
    const compiler: BackendCompilerOperations = {
      ...synthesizedCompiler(),
      typeOfSymbol: (symbol) => (symbol === missingEnumSymbol ? missingEnumType : undefined),
      typeFacts: (type) =>
        type === missingEnumType
          ? { typeText: "MissingMode", flags: ["Enum"], isEnum: true, symbol: missingEnumSymbol }
          : { typeText: "number", flags: ["Number"], intrinsic: "number" },
      symbolFacts: (symbol) =>
        symbol === missingEnumSymbol
          ? { name: "MissingMode", flags: [], declarationPaths: [], declarations: [] }
          : { name: "value", flags: [], declarationPaths: [], declarations: [] },
      typeNameFacts: (type) =>
        type === missingEnumType ? { name: "MissingMode", namespaces: [] } : undefined,
    };
    const session: BackendExtractionSession = {
      compiler,
      readModule: () => ({ name: "input", exports: [{ name: "MissingMode", symbol: missingEnumSymbol }] }),
      resolveModule: () => undefined,
      close: () => undefined,
    };
    const backendLayer = Layer.succeed(CompilerBackend, {
      openProject: () => Effect.succeed({ openExtraction: () => session, close: () => undefined }),
    });
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* ProjectExtractor;
          return yield* extractor.extractModule(fakeInputPath);
        }).pipe(
          Effect.provide(
            projectExtractorLayer({ tsconfigPath: fakeTsconfigPath }).pipe(Layer.provide(backendLayer))
          )
        )
      )
    );

    expect(result.module.exports[0]?.type).toMatchObject({
      kind: "enum",
      typeName: { name: "MissingMode" },
      members: [],
    });
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "missing-enum-declaration",
        enumName: "MissingMode",
        parsedSymbolStack: [fakeInputPath, "MissingMode"],
      }),
    ]);
    expect(Schema.decodeUnknownSync(ExtractionResultSchema)(result)).toEqual(result);
  });
});
