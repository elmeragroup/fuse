import { Effect, Schema } from "effect";
import { isAbsolute, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ExtractionResultSchema, ProjectExtractor, ProvenanceSchema } from "../src/index.ts";
import type { ExtractionResult, ExtractorOptions, ShouldResolveObjectData } from "../src/index.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures/issue-03-object-apis");
const tsconfigPath = resolve(fixtureDirectory, "tsconfig.json");
const inputPath = resolve(fixtureDirectory, "input.ts");
const reviewFixtureDirectory = resolve(import.meta.dirname, "fixtures/issue-03-review");
const reviewTsconfigPath = resolve(reviewFixtureDirectory, "tsconfig.json");
const reviewInputPath = resolve(reviewFixtureDirectory, "input.tsx");
const baseUiFixtureDirectory = resolve(import.meta.dirname, "fixtures/base-ui-component");
const baseUiTsconfigPath = resolve(import.meta.dirname, "fixtures/issue-02-tsconfig.json");
const baseUiInputPath = resolve(baseUiFixtureDirectory, "input.tsx");

function runExtraction(options?: ExtractorOptions): Promise<ExtractionResult> {
  // SAFETY: no caller overrides `typeOperatorOutput`, so every extraction here
  // runs in the default resolved mode whose preserved operators all carry
  // their resolved payloads.
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(inputPath, options);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  ) as Promise<ExtractionResult>;
}

function runReviewExtraction(options?: ExtractorOptions): Promise<ExtractionResult> {
  // SAFETY: no caller overrides `typeOperatorOutput`, so every extraction here
  // runs in the default resolved mode whose preserved operators all carry
  // their resolved payloads.
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(reviewInputPath, options);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath: reviewTsconfigPath })))
    )
  ) as Promise<ExtractionResult>;
}

function runBaseUiExtraction(): Promise<ExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(baseUiInputPath);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath: baseUiTsconfigPath })))
    )
  );
}

describe("Issue 03 object APIs, documentation, enums, and provenance", () => {
  it("extracts interface members and enum members through extractModule", async () => {
    const result = await runExtraction();
    const options = result.module.exports.find((entry) => entry.name === "Options");
    const mode = result.module.exports.find((entry) => entry.name === "Mode");

    expect(options).toMatchObject({
      name: "Options",
      documentation: {
        description: "Options accepted by the public operation.",
        tags: [
          { name: "deprecated", value: "Use NewOptions instead." },
          { name: "since", value: "1.0" },
        ],
      },
      type: {
        kind: "object",
        properties: [
          {
            name: "label",
            optional: true,
            type: {
              kind: "union",
              types: [
                { kind: "intrinsic", intrinsic: "string" },
                { kind: "intrinsic", intrinsic: "undefined" },
              ],
            },
          },
          {
            name: "nested",
            optional: false,
            type: {
              kind: "object",
              properties: [{ name: "id", optional: false, type: { kind: "intrinsic", intrinsic: "number" } }],
            },
          },
          {
            name: "format",
            optional: false,
            type: {
              kind: "function",
              callSignatures: [
                {
                  parameters: [
                    { name: "value", optional: false, type: { kind: "intrinsic", intrinsic: "string" } },
                  ],
                  returnValueType: { kind: "intrinsic", intrinsic: "string" },
                },
              ],
            },
          },
        ],
      },
    });
    expect(mode).toMatchObject({
      name: "Mode",
      type: {
        kind: "enum",
        typeName: { name: "Mode" },
        members: [
          { name: "Fast", value: "fast", documentation: { description: "Fast operation." } },
          { name: "Slow", value: 2, documentation: { description: "Slow operation." } },
        ],
      },
    });
  });

  it("anchors return-value provenance beneath object-valued functions and methods", async () => {
    const result = await runExtraction();
    const make = result.module.exports.find((entry) => entry.name === "makeReturnShape");
    const methods = result.module.exports.find((entry) => entry.name === "ReturnMethods");

    expect(make?.type).toMatchObject({
      kind: "function",
      callSignatures: [
        {
          returnValueType: {
            kind: "object",
            properties: [{ name: "value", type: { kind: "intrinsic", intrinsic: "string" } }],
          },
        },
      ],
    });
    expect(methods?.type).toMatchObject({
      kind: "object",
      properties: [
        {
          name: "make",
          type: {
            kind: "function",
            callSignatures: [
              {
                returnValueType: {
                  kind: "object",
                  properties: [{ name: "value" }],
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["makeReturnShape", "callSignatures", "0", "returnValueType", "properties", "value"],
        }),
        expect.objectContaining({
          path: [
            "ReturnMethods",
            "properties",
            "make",
            "callSignatures",
            "0",
            "returnValueType",
            "properties",
            "value",
          ],
        }),
      ])
    );
    expect(result.provenance).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["makeReturnShape", "callSignatures", "0", "properties", "value"],
        }),
      ])
    );
  });

  it("preserves ordinary destructuring defaults on parameter-object properties", async () => {
    const result = await runExtraction();
    const configure = result.module.exports.find((entry) => entry.name === "configure");
    expect(configure?.type.kind).toBe("function");
    if (configure?.type.kind !== "function") return;

    const parameter = configure.type.callSignatures[0]?.parameters[0];
    expect(parameter).toBeDefined();
    if (parameter === undefined) return;
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["configure", "callSignatures", "0", "parameters", parameter.name, "properties", "enabled"],
          defaultInitializer: "false",
        }),
      ])
    );
  });

  it("keeps stable repository-relative provenance and authored defaults", async () => {
    const result = await runExtraction();
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["Options"],
          declarationPaths: ["test/fixtures/issue-03-object-apis/input.ts"],
          synthesized: false,
        }),
        expect.objectContaining({
          path: ["Options", "properties", "label"],
          declarationPaths: ["test/fixtures/issue-03-object-apis/input.ts"],
          synthesized: false,
          readonly: true,
        }),
        expect.objectContaining({
          path: ["use", "callSignatures", "0", "parameters", "options"],
          declarationPaths: ["test/fixtures/issue-03-object-apis/input.ts"],
          synthesized: false,
          defaultInitializer: "{ nested: { id: 1 }, format: String }",
        }),
      ])
    );
  });

  it("decodes semantic output and provenance as independent schemas", async () => {
    const result = await runExtraction();

    expect(Schema.decodeUnknownSync(ExtractionResultSchema)(result)).toEqual(result);
    expect(Schema.decodeUnknownSync(ProvenanceSchema)(result.provenance)).toEqual(result.provenance);
    expect(() =>
      Schema.decodeUnknownSync(ProvenanceSchema)([
        {
          path: ["Options"],
          declarationPaths: ["input.ts"],
          synthesized: "no",
        },
      ])
    ).toThrow();
  });

  it("honors inclusion and object-resolution policies with deterministic callback data", async () => {
    const includeResult = await runExtraction({
      shouldInclude: ({ name }) => name !== "id",
    });
    const options = includeResult.module.exports.find((entry) => entry.name === "Options");
    expect(options?.type.kind).toBe("object");
    if (options?.type.kind === "object") {
      expect(options.type.properties.find((property) => property.name === "nested")?.type).toMatchObject({
        kind: "object",
        properties: [],
      });
    }

    const resolveCalls: ShouldResolveObjectData[] = [];
    const resolvedResult = await runExtraction({
      shouldResolveObject: (data) => {
        resolveCalls.push(data);
        return data.name !== "Options";
      },
    });
    const resolvedOptions = resolvedResult.module.exports.find((entry) => entry.name === "Options");
    expect(resolvedOptions?.type).toMatchObject({ kind: "object", properties: [] });
    expect(resolveCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Options", propertyCount: 3, propertyDepth: 0 }),
      ])
    );
  });

  it("runs object resolution before inclusion and applies the default to undefined nested decisions", async () => {
    const events: string[] = [];
    const result = await runReviewExtraction({
      shouldResolveObject: (data) => {
        events.push(`resolve:${data.name}:${data.propertyCount}:${data.propertyDepth}`);
        return undefined;
      },
      shouldInclude: ({ name }) => {
        events.push(`include:${name}`);
        return name !== "excluded";
      },
    });

    const rootResolution = events.findIndex((event) => event.startsWith("resolve:ResolutionOptions:2:0"));
    const rootInclusion = events.findIndex((event) => event === "include:nested");
    expect(rootResolution).toBeGreaterThanOrEqual(0);
    expect(rootInclusion).toBeGreaterThan(rootResolution);
    expect(events).toContain("resolve:Nested:51:1");
    const options = result.module.exports.find((entry) => entry.name === "options");
    expect(options).toMatchObject({
      type: {
        kind: "object",
        properties: [{ name: "nested", type: { kind: "object", properties: [] } }],
      },
    });
  });

  it("counts only public members of wide class aliases before applying default object resolution", async () => {
    const resolveCalls: ShouldResolveObjectData[] = [];
    const result = await runReviewExtraction({
      shouldResolveObject: (data) => {
        if (data.name === "ThatClass" || data.name === "PublicDerived") resolveCalls.push(data);
        return undefined;
      },
    });

    expect(resolveCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "ThatClass", propertyCount: 1 }),
        expect.objectContaining({ name: "PublicDerived", propertyCount: 2 }),
      ])
    );

    const direct = result.module.exports.find((entry) => entry.name === "DirectAlias");
    const derived = result.module.exports.find((entry) => entry.name === "DerivedAlias");
    expect(direct?.type).toMatchObject({
      kind: "object",
      properties: [{ name: "open" }],
    });
    expect(derived?.type).toMatchObject({
      kind: "object",
      properties: [{ name: "open" }, { name: "own" }],
    });
  });

  it("maps component props and destructuring defaults onto final semantic provenance paths", async () => {
    const result = await runReviewExtraction();
    const button = result.module.exports.find((entry) => entry.name === "Button");
    const directButton = result.module.exports.find((entry) => entry.name === "DirectButton");
    expect(button?.type).toMatchObject({
      kind: "component",
      props: [{ name: "isPending", optional: true }],
    });
    expect(directButton?.type).toMatchObject({
      kind: "component",
      props: [{ name: "isPending", optional: true }],
    });
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["Button", "props", "isPending"],
          defaultInitializer: "false",
        }),
        expect.objectContaining({
          path: ["DirectButton", "props", "isPending"],
          defaultInitializer: "false",
        }),
      ])
    );
    const paths = result.provenance.map((entry) => JSON.stringify(entry.path));
    expect(new Set(paths).size).toBe(paths.length);
    expect(result.provenance.some((entry) => entry.path.includes("callSignatures"))).toBe(false);
    expect(
      result.provenance.some((entry) => entry.path[0] === "Button" && entry.path[1] === "parameter: __0")
    ).toBe(false);
    expect(result.provenance.some((entry) => entry.path.join(".").includes("kind"))).toBe(false);
  });

  it("keeps declaration provenance case-preserving and rooted at an explicit repository cwd", async () => {
    const mixedRoot = resolve(reviewFixtureDirectory, "MixedRepo");
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* ProjectExtractor;
          return yield* extractor.extractModule(resolve(mixedRoot, "packages/UI/src/Widget.ts"));
        }).pipe(
          Effect.provide(
            ProjectExtractor.live({
              tsconfigPath: resolve(mixedRoot, "tsconfig.json"),
              cwd: mixedRoot,
            })
          )
        )
      )
    );
    expect(result.provenance).toEqual(
      expect.arrayContaining([expect.objectContaining({ declarationPaths: ["packages/UI/src/Widget.ts"] })])
    );
    expect(result.provenance).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ declarationPaths: ["packages/ui/src/widget.ts"] })])
    );
    expect(
      result.provenance.every((entry) => entry.declarationPaths.every((path) => !isAbsolute(path)))
    ).toBe(true);
  });

  it("uses the resolved default cwd for nested-tsconfig provenance roots", async () => {
    const mixedRoot = resolve(reviewFixtureDirectory, "MixedRepo");
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* ProjectExtractor;
          return yield* extractor.extractModule(resolve(mixedRoot, "packages/UI/src/Widget.ts"));
        }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath: resolve(mixedRoot, "tsconfig.json") })))
      )
    );
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          declarationPaths: ["test/fixtures/issue-03-review/MixedRepo/packages/UI/src/Widget.ts"],
        }),
      ])
    );
    expect(result.provenance).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ declarationPaths: ["packages/ui/src/widget.ts"] })])
    );
  });

  it("keeps every Base UI provenance entry on the final component tree", async () => {
    const result = await runBaseUiExtraction();
    const paths = result.provenance.map((entry) => JSON.stringify(entry.path));
    expect(new Set(paths).size).toBe(paths.length);
    expect(
      result.provenance.some((entry) => entry.path.some((segment) => segment.startsWith("parameter: ")))
    ).toBe(false);
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["BaseUIComponent1", "props", "render"] }),
        expect.objectContaining({
          path: ["BaseUIComponent1", "props", "render", "callSignatures", "0", "parameters", "props"],
        }),
      ])
    );
  });
});
