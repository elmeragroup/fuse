import { Effect } from "effect";
import type { Error as EffectError } from "effect/Effect";
import { resolve } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

import { ProjectExtractor as PackageProjectExtractor } from "@elmeragroup/api-extractor";
import type {
  ExtractionResult,
  ProjectExtractorService,
  SyntaxOnlyExtractionResult,
} from "@elmeragroup/api-extractor";

import { ProjectExtractor as SourceProjectExtractor } from "../src/index.ts";
import type { BackendError, ExtractError, FileNotInProgramError } from "../src/index.ts";
import { InternalProjectExtractorTiming } from "../src/internal/timing.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures/basic");
const tsconfigPath = resolve(fixtureDirectory, "tsconfig.json");
const inputPath = resolve(fixtureDirectory, "input.ts");

type ExtractModuleError = EffectError<ReturnType<ProjectExtractorService["extractModule"]>>;
type ExtractModuleEffect = ReturnType<ProjectExtractorService["extractModule"]>;
// The indexed access resolves to the service's LAST overload — the dynamic-mode
// one — whose success channel is the union of both correlated result views.
type ExtractionResultSyntaxView = SyntaxOnlyExtractionResult;
type ExpectedExtractModuleEffect = Effect.Effect<
  ExtractionResult | ExtractionResultSyntaxView,
  BackendError | FileNotInProgramError | ExtractError,
  never
>;

describe("package entry point", () => {
  it("keeps the public extraction effect environment-free", () => {
    expectTypeOf<ExtractModuleEffect>().toEqualTypeOf<ExpectedExtractModuleEffect>();
  });

  it("keeps configuration failures on layer acquisition, not extraction", () => {
    expectTypeOf<ExtractModuleError>().toEqualTypeOf<BackendError | FileNotInProgramError | ExtractError>();
  });

  it("resolves the workspace package name to the source entry", () => {
    expect(PackageProjectExtractor).toBe(SourceProjectExtractor);
  });

  it("keeps compiler backend services out of the package surface", async () => {
    const publicApi = await import("@elmeragroup/api-extractor");
    expect(publicApi).not.toHaveProperty("CompilerBackend");
    expect(publicApi).toHaveProperty("ProjectExtractor");
  });

  it("keeps instrumentation off the public service object", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* PackageProjectExtractor;
          expect(Reflect.ownKeys(extractor)).toEqual(["extractModule"]);
        }).pipe(Effect.provide(PackageProjectExtractor.live({ tsconfigPath })))
      )
    );
  });

  it("does not activate timing from an extra runtime option on the public layer", () => {
    const runtimeOptions = Object.assign({ tsconfigPath }, { collectTiming: true });
    const layer = PackageProjectExtractor.live(runtimeOptions);
    expect(layer).toBeDefined();
    expect(InternalProjectExtractorTiming).not.toBe(PackageProjectExtractor);
  });

  it("keeps property options out of top-level exports and aligned provenance", async () => {
    const includeCalls: Array<{ name: string; depth: number }> = [];
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* PackageProjectExtractor;
          return yield* extractor.extractModule(inputPath, {
            shouldInclude: (data) => {
              includeCalls.push(data);
              return includeCalls.length % 2 === 0;
            },
            shouldResolveObject: ({ name, propertyCount, depth, propertyDepth }) => {
              expect(name).toBeTypeOf("string");
              expect(propertyCount).toBeTypeOf("number");
              expect(depth).toBeTypeOf("number");
              expect(propertyDepth).toBeTypeOf("number");
              return false;
            },
          });
        }).pipe(Effect.provide(PackageProjectExtractor.live({ tsconfigPath })))
      )
    );

    expect(includeCalls).toEqual([]);
    expect(result.module.exports.map((entry) => entry.name)).toEqual(["greet"]);
    expect(result.provenance.map((entry) => entry.path[0])).toEqual(["greet", "greet"]);
  });
});
