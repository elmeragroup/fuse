import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import {
  assertTs7DivergenceEvidence,
  canonicalDifferencePaths,
  issue09TypeOperatorFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ProjectExtractor } from "../src/index.ts";
import type {
  BackendError,
  ExtractionResult,
  ExtractError,
  ExtractorOptions,
  FileNotInProgramError,
  ProjectExtractorService,
  SyntaxOnlyExtractionResult,
  SyntaxOnlyModuleNode,
} from "../src/index.ts";
import type { SemanticType, TypeOperatorResolutionKind } from "../src/model.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-09-tsconfig.json");

function runExtraction(
  fixture: string,
  file: string,
  options?: ExtractorOptions
): Promise<ExtractionResult | SyntaxOnlyExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(resolve(fixtureRoot, fixture, file), options);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
}

function oracleFile(definition: (typeof issue09TypeOperatorFixtures)[number]): string {
  return definition.oracle === "immutable-upstream" ? "output.json" : "output.tsgo.json";
}

describe("Issue 09 ported upstream type-operator fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue09TypeOperatorFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue09TypeOperatorFixtures.map((definition) => [definition] as const))(
    "matches the $0.oracle oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, oracleFile(definition)));
    }
  );

  it("has an exact zero-leaf-difference record for every immutable upstream oracle", async () => {
    if (!referenceAvailable) return;
    for (const definition of issue09TypeOperatorFixtures) {
      if (definition.oracle !== "immutable-upstream") continue;
      const result = await runExtraction(definition.fixture, definition.file);
      const expected = Schema.decodeUnknownSync(Schema.Json)(
        JSON.parse(readFileSync(resolve(fixtureRoot, definition.fixture, "output.json"), "utf8"))
      );
      const actual = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(JSON.stringify(result.module)));
      expect(canonicalDifferencePaths(expected, actual)).toEqual([]);
    }
  });

  it("validates the reviewed TS7 divergence record and its preserved upstream oracle", () => {
    const divergent = issue09TypeOperatorFixtures.filter(
      (definition) => definition.oracle === "reviewed-ts7"
    );
    expect(divergent).toHaveLength(1);
    for (const definition of divergent) {
      expect(() => assertTs7DivergenceEvidence(definition.fixture)).not.toThrow();
    }
  });

  it("emits no recoverable warnings for the ported family", async () => {
    for (const definition of issue09TypeOperatorFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.warnings).toEqual([]);
    }
  });

  it("covers every operator family with at least one ported fixture", () => {
    const families = new Set(issue09TypeOperatorFixtures.map((definition) => definition.family));
    expect([...families].sort()).toEqual(["alias", "conditional", "indexedAccess", "keyof"]);
    const unchanged = issue09TypeOperatorFixtures.filter(
      (definition) => definition.oracle === "immutable-upstream"
    );
    const reviewed = issue09TypeOperatorFixtures.filter((definition) => definition.oracle === "reviewed-ts7");
    expect({
      total: issue09TypeOperatorFixtures.length,
      unchanged: unchanged.length,
      reviewedDivergences: reviewed.length,
    }).toEqual({ total: 5, unchanged: 4, reviewedDivergences: 1 });
  });
});

describe("Issue 09 type-operator output modes", () => {
  it("preserves the authored operator with its resolved key set in resolved mode", async () => {
    // SAFETY: the resolved-mode call returns the full model by contract.
    const result = (await runExtraction("type-literal-union-resolution", "input.ts")) as ExtractionResult;
    const entry = result.module.exports.find((candidate) => candidate.name === "acceptsKeyofProp");
    if (entry === undefined) throw new Error("The fixture does not export acceptsKeyofProp");
    if (entry.type.kind !== "function") {
      throw new Error(`acceptsKeyofProp is a ${entry.type.kind}, not a function`);
    }
    const parameter = entry.type.callSignatures[0]?.parameters[0]?.type;
    expect(parameter).toMatchObject({
      kind: "typeOperator",
      operator: "keyof",
      type: { kind: "object", typeName: { name: "Params" }, properties: [] },
      resolutionKind: "exact",
    });
    // The operand keeps the authored expression; the checker's reduced key set
    // rides beside it — never instead of it.
    const operator = parameter?.kind === "typeOperator" ? parameter : undefined;
    expect(operator?.resolvedType).toBeDefined();
  });

  it("strips every resolved payload in syntaxOnly mode while keeping the operators", async () => {
    // SAFETY: the literal syntaxOnly call returns the payload-free view.
    const result = (await runExtraction("type-literal-union-resolution", "input.ts", {
      typeOperatorOutput: "syntaxOnly",
    })) as SyntaxOnlyExtractionResult;
    const serialized = JSON.stringify(result.module);
    // The same module still contains preserved operators…
    expect(serialized).toContain('"typeOperator"');
    // …and no resolved payloads anywhere inside them, at any nesting.
    expect(serialized).not.toContain("resolvedType");
    expect(serialized).not.toContain("resolutionKind");
  });
});

let correlatedService: ProjectExtractorService;

beforeAll(async () => {
  correlatedService = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        return yield* ProjectExtractor;
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
});

describe("Issue 09 output mode is correlated with the returned model type", () => {
  it("a literal syntaxOnly call exposes only payload-free operators", () => {
    const effect = correlatedService.extractModule("input.ts", { typeOperatorOutput: "syntaxOnly" });
    expectTypeOf(effect).toExtend<
      Effect.Effect<SyntaxOnlyExtractionResult, BackendError | FileNotInProgramError | ExtractError>
    >();
    // The correlation guarantee, as upstream's ParserOutput encodes it: every
    // preserved operator in a syntaxOnly module reports its payload slots as
    // `undefined | never`, so a resolved key set cannot be read out of
    // syntax-preserving output.
    type Operator = SyntaxOnlyModuleNode["exports"][number]["type"] extends infer Member
      ? Member extends { readonly kind: "typeOperator" }
        ? Member
        : never
      : never;
    expectTypeOf<NonNullable<Operator["resolvedType"]>>().toEqualTypeOf<never>();
    expectTypeOf<Operator["resolutionKind"]>().toEqualTypeOf<undefined>();
  });

  it("a syntax-only result cannot be assigned to the resolved view", () => {
    // Upstream's parser entry points reject this assignment (TS2322) because
    // ParserOutput's resolved branch requires every operator payload; the
    // ported ResolvedModuleNode mirrors that branch, so the two views are
    // exclusive at the assignment level too — not only at payload reads.
    expectTypeOf<SyntaxOnlyExtractionResult>().not.toExtend<ExtractionResult>();
  });

  it("a resolved module requires a key set on every preserved operator", () => {
    type Operator = ExtractionResult["module"]["exports"][number]["type"] extends infer Member
      ? Member extends { readonly kind: "typeOperator" }
        ? Member
        : never
      : never;
    expectTypeOf<Operator["resolvedType"]>().toEqualTypeOf<SemanticType>();
    expectTypeOf<Operator["resolutionKind"]>().toEqualTypeOf<TypeOperatorResolutionKind>();
  });

  it("default and literal resolved calls keep the fully resolved model", () => {
    const effect = correlatedService.extractModule("input.ts");
    expectTypeOf(effect).toExtend<
      Effect.Effect<ExtractionResult, BackendError | FileNotInProgramError | ExtractError>
    >();
    const resolved = correlatedService.extractModule("input.ts", { typeOperatorOutput: "resolved" });
    expectTypeOf(resolved).toExtend<
      Effect.Effect<ExtractionResult, BackendError | FileNotInProgramError | ExtractError>
    >();
  });

  it("a dynamically-typed option returns the union so consumers must narrow", () => {
    const dynamic: ExtractorOptions = {};
    const effect = correlatedService.extractModule("input.ts", dynamic);
    expectTypeOf(effect).toExtend<
      Effect.Effect<
        ExtractionResult | SyntaxOnlyExtractionResult,
        BackendError | FileNotInProgramError | ExtractError
      >
    >();
  });
});
