import { Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertReactDivergenceEvidence,
  canonicalDifferencePaths,
  differenceDigest,
  issue03UpstreamFixtures,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ModuleNodeSchema } from "../src/index.ts";
import type { ModuleNode } from "../src/index.ts";
import { extractFixture } from "./support/extract.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-03-tsconfig.json");
const fixtures = issue03UpstreamFixtures.map(({ fixture, file }) => [fixture, file] as const);

function runExtraction(filePath: string) {
  return extractFixture({ tsconfigPath }, filePath);
}

function expectedModule(fixture: string): ModuleNode {
  return Schema.decodeUnknownSync(ModuleNodeSchema)(
    JSON.parse(readFileSync(resolve(fixtureRoot, fixture, "output.json"), "utf8"))
  );
}

describe("Issue 03 pinned upstream semantic oracles", () => {
  it("keeps every copied Issue 03 input and immutable output byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const [fixture, file] of fixtures) {
      expect(readFileSync(resolve(fixtureRoot, fixture, file), "utf8")).toBe(
        readFileSync(resolve(upstreamFixtureRoot, fixture, file), "utf8")
      );
      expect(readFileSync(resolve(fixtureRoot, fixture, "output.json"), "utf8")).toBe(
        readFileSync(resolve(upstreamFixtureRoot, fixture, "output.json"), "utf8")
      );
    }
  });

  it.each(fixtures)("matches the immutable output for %s", async (fixture, file) => {
    const result = await runExtraction(resolve(fixtureRoot, fixture, file));
    expect(result.module).toEqual(expectedModule(fixture));
    expect(result.warnings).toEqual([]);
  });

  it("has an exact zero-leaf-difference record for the TS7 object fixture", async () => {
    const fixture = "object-property-count-limit-scope";
    const result = await runExtraction(resolve(fixtureRoot, fixture, "input.tsx"));
    const expected = Schema.decodeUnknownSync(Schema.Json)(
      JSON.parse(readFileSync(resolve(fixtureRoot, fixture, "output.json"), "utf8"))
    );
    const actual = Schema.decodeUnknownSync(Schema.Json)(result.module);
    const paths = canonicalDifferencePaths(expected, actual);
    expect(paths).toEqual([]);
    expect(differenceDigest(paths)).toBe(differenceDigest([]));
    expect(result.warnings).toEqual([]);
  });

  it("validates the reviewed TS7 divergence digest and preserved upstream oracle", () => {
    expect(() => assertReactDivergenceEvidence()).not.toThrow();
  });
});
