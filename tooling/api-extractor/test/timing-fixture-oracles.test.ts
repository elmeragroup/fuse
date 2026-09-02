import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertFixtureOracle,
  assertSupplementalFixture,
  fixtureInputPath,
  issue02SupplementalFixtures,
  issue02TimingFixtures,
} from "../scripts/fixture-evidence.ts";
import { extractFixture } from "./support/extract.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureDirectory, "issue-02-tsconfig.json");

describe("Issue 02 ProjectExtractor conformance", () => {
  it.each(issue02TimingFixtures.slice(0, 3))(
    "matches the immutable upstream oracle for $fixture",
    async (definition) => {
      assertFixtureOracle(definition, await extractFixture({ tsconfigPath }, fixtureInputPath(definition)));
    }
  );

  it("matches the complete reviewed TS7 component oracle and warning oracle", async () => {
    const definition = issue02TimingFixtures[3];
    if (definition === undefined) throw new Error("Missing reviewed Issue 02 timing fixture.");
    const result = await extractFixture({ tsconfigPath }, fixtureInputPath(definition));
    assertFixtureOracle(definition, result);
  });

  it.each(issue02SupplementalFixtures)(
    "preserves the public module-resolution seam for $fixture",
    async (definition) => {
      const result = await extractFixture({ tsconfigPath }, fixtureInputPath(definition));
      assertSupplementalFixture(definition, result);
      expect(result.warnings).toEqual([]);
    }
  );
});
