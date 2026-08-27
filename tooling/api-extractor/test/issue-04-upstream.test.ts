import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertTs7DivergenceEvidence,
  canonicalDifferencePaths,
  issue04CanonicalizationFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-04-tsconfig.json");

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

function oracleFile(definition: (typeof issue04CanonicalizationFixtures)[number]): string {
  return definition.oracle === "immutable-upstream" ? "output.json" : "output.tsgo.json";
}

describe("Issue 04 ported upstream union and intersection fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue04CanonicalizationFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue04CanonicalizationFixtures.map((definition) => [definition] as const))(
    "matches the $0.oracle oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, oracleFile(definition)));
      expect(result.warnings).toEqual([]);
    }
  );

  it("has an exact zero-leaf-difference record for every immutable upstream oracle", async () => {
    if (!referenceAvailable) return;
    for (const definition of issue04CanonicalizationFixtures) {
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
    const divergent = issue04CanonicalizationFixtures.filter(
      (definition) => definition.oracle === "reviewed-ts7"
    );
    expect(divergent).toHaveLength(1);
    for (const definition of divergent) {
      expect(() => assertTs7DivergenceEvidence(definition.fixture)).not.toThrow();
    }
  });

  it("reports the ported conformance totals", () => {
    const unchanged = issue04CanonicalizationFixtures.filter(
      (definition) => definition.oracle === "immutable-upstream"
    );
    const reviewed = issue04CanonicalizationFixtures.filter(
      (definition) => definition.oracle === "reviewed-ts7"
    );
    expect({
      total: issue04CanonicalizationFixtures.length,
      unchanged: unchanged.length,
      reviewedDivergences: reviewed.length,
    }).toEqual({ total: 12, unchanged: 11, reviewedDivergences: 1 });
  });
});
