import { Effect } from "effect";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertFixtureOracle,
  assertSupplementalFixture,
  fixtureInputPath,
  issue02SupplementalFixtures,
  issue02TimingFixtures,
} from "../scripts/fixture-evidence.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureDirectory, "issue-02-tsconfig.json");

function runExtraction(filePath: string): Promise<ExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(filePath);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
}

describe("Issue 02 ProjectExtractor conformance", () => {
  it.each(issue02TimingFixtures.slice(0, 3))(
    "matches the immutable upstream oracle for $fixture",
    async (definition) => {
      assertFixtureOracle(definition, await runExtraction(fixtureInputPath(definition)));
    }
  );

  it("matches the complete reviewed TS7 component oracle and warning oracle", async () => {
    const definition = issue02TimingFixtures[3];
    const result = await runExtraction(fixtureInputPath(definition));
    assertFixtureOracle(definition, result);
  });

  it.each(issue02SupplementalFixtures)(
    "preserves the public module-resolution seam for $fixture",
    async (definition) => {
      const result = await runExtraction(fixtureInputPath(definition));
      assertSupplementalFixture(definition, result);
      expect(result.warnings).toEqual([]);
    }
  );
});
