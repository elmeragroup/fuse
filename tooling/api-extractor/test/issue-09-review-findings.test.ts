import { Effect } from "effect";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";
import type { SemanticType } from "../src/model.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures/issue-09-review");

async function extract(file: string): Promise<ExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(resolve(fixtureDirectory, file));
      }).pipe(
        Effect.provide(ProjectExtractor.live({ tsconfigPath: resolve(fixtureDirectory, "tsconfig.json") }))
      )
    )
  );
}

function exportType(result: ExtractionResult, name: string): SemanticType {
  const entry = result.module.exports.find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`Missing export ${name}`);
  return entry.type;
}

function expectKeyOperator(type: SemanticType, label: string) {
  if (type.kind !== "typeOperator") {
    throw new Error(`${label} is a ${type.kind}, not a preserved keyof`);
  }
  const { resolvedType } = type;
  if (type.resolutionKind !== "exact") {
    throw new Error(`${label} resolved as ${type.resolutionKind}, not exact`);
  }
  if (resolvedType.kind !== "union") {
    throw new Error(`${label}'s key set is a ${resolvedType.kind}, not a union`);
  }
  return { operand: type.type, members: resolvedType.types };
}

/** Exact member set; canonicalization orders key sets, so membership is unordered. */
function expectMembers(members: readonly SemanticType[], expected: readonly SemanticType[]) {
  expect(members).toHaveLength(expected.length);
  for (const candidate of expected) {
    expect(members).toContainEqual(candidate);
  }
}

describe("Issue 09 review findings", () => {
  it("resolves a unique-symbol key to symbol instead of degrading to any", async () => {
    // A `unique symbol` member of a keyof key set carries TypeFlags.UniqueESSymbol.
    // Upstream's intrinsic resolver maps ESSymbol || UniqueESSymbol to the same
    // `symbol` intrinsic (`intrinsicTypeResolver.ts`), and its concrete-operator
    // rule re-enters session.resolve for such members — so `keyof` over an
    // object keyed by one reports `"named" | symbol` with no warning.
    const result = await extract("unique-symbols.ts");
    expect(result.warnings).toEqual([]);
    const { operand, members } = expectKeyOperator(exportType(result, "BrandedKeys"), "BrandedKeys");
    // The operand stays the named shallow object; only the key set is checked here.
    expect(operand).toMatchObject({ kind: "object", typeName: { name: "Branded" }, properties: [] });
    expectMembers(members, [
      { kind: "literal", value: '"named"' },
      // The symbol intrinsic carries the declaring constant's name, exactly as
      // upstream's IntrinsicNode('symbol', typeName) does.
      { kind: "intrinsic", intrinsic: "symbol", typeName: { name: "brand" } },
    ]);
  });

  it("reports an exported unique symbol constant as the symbol intrinsic", async () => {
    // The reviewer also asked about the bare shape: `declare const s: unique
    // symbol` exports a type whose only flag is UniqueESSymbol. It flows through
    // the same intrinsic mapping upstream applies, so it resolves to `symbol`
    // rather than an `any` fallback with a spurious warning.
    const result = await extract("unique-symbols.ts");
    expect(result.warnings).toEqual([]);
    // The intrinsic carries the constant's name, as upstream's
    // IntrinsicNode('symbol', typeName) does.
    expect(exportType(result, "bareSymbol")).toEqual({
      kind: "intrinsic",
      intrinsic: "symbol",
      typeName: { name: "bareSymbol" },
    });
  });

  it("preserves a local intersection operand with its exact key set", async () => {
    // `keyof (A & B)` keeps the authored intersection as its operand — the
    // checker reduces it, but the operator expression is what the model
    // preserves — and resolves both members' keys exactly.
    const result = await extract("intersection-keyof.ts");
    expect(result.warnings).toEqual([]);
    const { operand, members } = expectKeyOperator(exportType(result, "CombinedKeys"), "CombinedKeys");
    if (operand.kind !== "intersection") {
      throw new Error(`The operand is a ${operand.kind}, not the authored intersection`);
    }
    expect(
      operand.types.map((member) => (member.kind === "object" ? member.typeName?.name : undefined))
    ).toEqual(["Layout", "Style"]);
    expectMembers(members, [
      { kind: "literal", value: '"color"' },
      { kind: "literal", value: '"width"' },
    ]);
  });
});
