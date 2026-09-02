import { resolve } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { ExtractionResult } from "../src/index.ts";
import type { SemanticType, TypeOperatorResolutionKind } from "../src/model.ts";
import { extractFixture, fixtureRoot } from "./support/extract.ts";

const tsconfigPath = resolve(fixtureRoot, "issue-09-tsconfig.json");

function runExtraction(fixture: string, file: string): Promise<ExtractionResult> {
  return extractFixture({ tsconfigPath }, resolve(fixtureRoot, fixture, file));
}

describe("type operators on the ported upstream fixtures", () => {
  it("preserves the authored operator beside its resolved key set", async () => {
    const result = await runExtraction("type-literal-union-resolution", "input.ts");
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

  it("attaches a resolved key set to every preserved operator", async () => {
    const result = await runExtraction("type-literal-union-resolution", "input.ts");
    const serialized = JSON.stringify(result.module);
    expect(serialized).toContain('"typeOperator"');
    expect(serialized.split('"typeOperator"').length).toBe(serialized.split('"resolutionKind"').length);
  });
});

describe("type operators in the model type", () => {
  it("a module requires a key set on every preserved operator", () => {
    type Operator = ExtractionResult["module"]["exports"][number]["type"] extends infer Member
      ? Member extends { readonly kind: "typeOperator" }
        ? Member
        : never
      : never;
    expectTypeOf<Operator["resolvedType"]>().toEqualTypeOf<SemanticType>();
    expectTypeOf<Operator["resolutionKind"]>().toEqualTypeOf<TypeOperatorResolutionKind>();
  });
});
