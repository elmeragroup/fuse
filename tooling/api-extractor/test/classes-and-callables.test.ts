import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ExtractionResult } from "../src/index.ts";
import { extractFixture, fixtureRoot } from "./support/extract.ts";

const tsconfigPath = resolve(fixtureRoot, "issue-06-tsconfig.json");

function runExtraction(fixture: string, file: string): Promise<ExtractionResult> {
  return extractFixture({ tsconfigPath }, resolve(fixtureRoot, fixture, file));
}

describe("classes and callables on the ported upstream fixtures", () => {
  it("reports the construct signatures a non-class shape carries as structured warnings", async () => {
    const result = await runExtraction("class-members-visibility-and-signatures", "input.ts");
    const expected = [
      {
        code: "unrepresented-construct-signatures",
        structuralPath: ["Constructable", "constructSignatures"],
        signatureCount: 1,
      },
      {
        code: "unrepresented-construct-signatures",
        structuralPath: ["ConstructableType", "constructSignatures"],
        signatureCount: 1,
      },
    ];
    const actual = result.warnings
      .filter((warning) => warning.code === "unrepresented-construct-signatures")
      .map((warning) => ({
        code: warning.code,
        structuralPath: [...warning.structuralPath],
        signatureCount: warning.signatureCount,
      }));
    expect(actual).toEqual(expected);
  });

  it("degrades the indexed-access parameter of a generic method to a silent any", async () => {
    // Issue 06 pinned an `unsupported-type-fallback` warning here because the
    // resolver had no representation for `T[K]` under unresolved parameters.
    // Issue 09's index-like fallback mirrors upstream's `resolveIndexLikeType`
    // — expand the base constraint when one exists, otherwise report `any`
    // silently, "an expected limitation rather than a parser bug" — so the
    // model still matches the immutable oracle and the extra warning is gone.
    const result = await runExtraction("class-method-generic-signatures", "input.ts");
    expect(
      result.warnings.filter(
        (warning) =>
          warning.code === "unsupported-type-fallback" &&
          warning.parsedSymbolStack.at(-2) === "Repository" &&
          warning.parsedSymbolStack.at(-1) === "parameter: value"
      )
    ).toHaveLength(0);
    const repository = result.module.exports.find((entry) => entry.name === "Repository");
    if (repository === undefined) throw new Error("The fixture does not export Repository");
    if (repository.type.kind !== "class") {
      throw new Error(`Repository is a ${repository.type.kind}, not a class`);
    }
    const signature = repository.type.methods[0]?.callSignatures[0];
    const value = signature?.parameters.find((parameter) => parameter.name === "value");
    expect(value?.type).toEqual({ kind: "intrinsic", intrinsic: "any" });
  });

  it("resolves the callable-intersection React payloads as upstream does", async () => {
    // The fixture's own comment says upstream disregards the extra properties
    // of `Callable & ExtraData`; its React-side union arms (anonymous
    // construct-only members of `JSXElementConstructor`) are likewise reported
    // by upstream as bare objects rather than unsupported-type fallbacks, so
    // the module stays byte-identical to the immutable oracle with no
    // recoverable warnings at all.
    const result = await runExtraction("function-callable-intersection-extra-properties", "input.tsx");
    expect(result.warnings.map((warning) => warning.code)).toEqual([]);
  });

  it("emits no warnings for the overload and re-export ports", async () => {
    for (const [fixture, file] of [
      ["class-method-overload-signatures", "input.ts"],
      ["class-private-members-type-alias-filtering", "input.ts"],
      ["function-declaration-expression-arrow", "input.ts"],
      ["jsdoc-comments-and-overloads", "input.tsx"],
      ["merged-interface-signature-typeparams", "input.ts"],
      ["module-reexport-imported-class-type", "input.ts"],
    ] as const) {
      const result = await runExtraction(fixture, file);
      expect(result.warnings).toEqual([]);
    }
  });
});
