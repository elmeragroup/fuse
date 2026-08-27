import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertTs7DivergenceEvidence,
  canonicalDifferencePaths,
  issue07GenericFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-07-tsconfig.json");

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

function oracleFile(definition: (typeof issue07GenericFixtures)[number]): string {
  return definition.oracle === "immutable-upstream" ? "output.json" : "output.tsgo.json";
}

describe("Issue 07 ported upstream generic and alias fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue07GenericFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue07GenericFixtures.map((definition) => [definition] as const))(
    "matches the $0.oracle oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, oracleFile(definition)));
    }
  );

  it("has an exact zero-leaf-difference record for every immutable upstream oracle", async () => {
    if (!referenceAvailable) return;
    for (const definition of issue07GenericFixtures) {
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
    const divergent = issue07GenericFixtures.filter((definition) => definition.oracle === "reviewed-ts7");
    expect(divergent).toHaveLength(1);
    for (const definition of divergent) {
      expect(() => assertTs7DivergenceEvidence(definition.fixture)).not.toThrow();
    }
  });

  it("emits no recoverable warnings for the ported family", async () => {
    for (const definition of issue07GenericFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.warnings).toEqual([]);
    }
  });

  it("covers every generic family with at least one ported fixture", () => {
    const families = new Set(issue07GenericFixtures.map((definition) => definition.family));
    expect([...families].sort()).toEqual([
      "alias",
      "constraint",
      "deduplication",
      "default",
      "method",
      "renaming",
      "shadowing",
      "substitution",
    ]);
    const unchanged = issue07GenericFixtures.filter(
      (definition) => definition.oracle === "immutable-upstream"
    );
    const reviewed = issue07GenericFixtures.filter((definition) => definition.oracle === "reviewed-ts7");
    expect({
      total: issue07GenericFixtures.length,
      unchanged: unchanged.length,
      reviewedDivergences: reviewed.length,
    }).toEqual({ total: 14, unchanged: 13, reviewedDivergences: 1 });
  });
});
