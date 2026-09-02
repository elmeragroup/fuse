import { Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canonicalDifferencePaths,
  issue08MappedFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import type { ExtractionResult } from "../src/index.ts";
import { extractFixture } from "./support/extract.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-08-tsconfig.json");

function runExtraction(fixture: string, file: string): Promise<ExtractionResult> {
  return extractFixture({ tsconfigPath }, resolve(fixtureRoot, fixture, file));
}

describe("Issue 08 ported upstream mapped-type fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue08MappedFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue08MappedFixtures.map((definition) => [definition] as const))(
    "matches the immutable upstream oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, "output.json"));
      expect(result.warnings).toEqual([]);
    }
  );

  it("has an exact zero-leaf-difference record for every ported fixture", async () => {
    for (const definition of issue08MappedFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      const expected = Schema.decodeUnknownSync(Schema.Json)(
        JSON.parse(readFileSync(resolve(fixtureRoot, definition.fixture, "output.json"), "utf8"))
      );
      const actual = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(JSON.stringify(result.module)));
      expect(canonicalDifferencePaths(expected, actual)).toEqual([]);
    }
  });

  it("covers every mapped family with at least one ported fixture", () => {
    const families = new Set(issue08MappedFixtures.map((definition) => definition.family));
    expect([...families].sort()).toEqual(["external", "modifiers", "openDomain"]);
    expect({
      total: issue08MappedFixtures.length,
      reviewedDivergences: 0,
    }).toEqual({ total: 3, reviewedDivergences: 0 });
  });
});
