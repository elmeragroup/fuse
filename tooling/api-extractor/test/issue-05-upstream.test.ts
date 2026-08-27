import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canonicalDifferencePaths,
  issue05ContainerFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-05-tsconfig.json");

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

describe("Issue 05 ported upstream container fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue05ContainerFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue05ContainerFixtures.map((definition) => [definition] as const))(
    "matches the immutable upstream oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, "output.json"));
      expect(result.warnings).toEqual([]);
    }
  );

  it("has an exact zero-leaf-difference record for every ported fixture", async () => {
    for (const definition of issue05ContainerFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      const expected = Schema.decodeUnknownSync(Schema.Json)(
        JSON.parse(readFileSync(resolve(fixtureRoot, definition.fixture, "output.json"), "utf8"))
      );
      const actual = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(JSON.stringify(result.module)));
      expect(canonicalDifferencePaths(expected, actual)).toEqual([]);
    }
  });

  it("covers every container family with at least one ported fixture", () => {
    const families = new Set(issue05ContainerFixtures.map((definition) => definition.container));
    expect([...families].sort()).toEqual([
      "array",
      "indexSignature",
      "mappedKey",
      "readonlyArray",
      "record",
      "recursive",
      "tuple",
    ]);
    expect({
      total: issue05ContainerFixtures.length,
      reviewedDivergences: 0,
    }).toEqual({ total: 25, reviewedDivergences: 0 });
  });
});
