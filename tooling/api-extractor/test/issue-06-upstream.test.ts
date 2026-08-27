import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canonicalDifferencePaths,
  issue06CallableFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-06-tsconfig.json");

function runExtraction(fixture: string, file: string): Promise<ExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(resolve(fixtureRoot, fixture, file));
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
}

describe("Issue 06 ported upstream class and callable fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue06CallableFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue06CallableFixtures.map((definition) => [definition] as const))(
    "matches the immutable upstream oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, "output.json"));
    }
  );

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

  it("has an exact zero-leaf-difference record for every ported fixture", async () => {
    for (const definition of issue06CallableFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      const expected = Schema.decodeUnknownSync(Schema.Json)(
        JSON.parse(readFileSync(resolve(fixtureRoot, definition.fixture, "output.json"), "utf8"))
      );
      const actual = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(JSON.stringify(result.module)));
      expect(canonicalDifferencePaths(expected, actual)).toEqual([]);
    }
  });

  it("covers every callable family with at least one ported fixture", () => {
    const families = new Set(issue06CallableFixtures.map((definition) => definition.family));
    expect([...families].sort()).toEqual(["callable", "class", "method", "overload"]);
    expect({
      total: issue06CallableFixtures.length,
      reviewedDivergences: 0,
    }).toEqual({ total: 9, reviewedDivergences: 0 });
  });
});
