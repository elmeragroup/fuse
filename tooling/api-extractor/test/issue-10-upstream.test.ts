import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertTs7DivergenceEvidence,
  canonicalDifferencePaths,
  issue10ModuleSurfaceFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult, ExtractorOptions, SyntaxOnlyExtractionResult } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-10-tsconfig.json");

function runExtraction(
  fixture: string,
  file: string,
  options?: ExtractorOptions
): Promise<ExtractionResult | SyntaxOnlyExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(resolve(fixtureRoot, fixture, file), options);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
}

describe("Issue 10 ported module-surface fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue10ModuleSurfaceFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue10ModuleSurfaceFixtures.map((definition) => [definition] as const))(
    "matches the $0.oracle oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      const oracleFile = definition.oracle === "immutable-upstream" ? "output.json" : "output.tsgo.json";
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, oracleFile));
    }
  );

  it("has an exact zero-leaf-difference record for every immutable upstream oracle", async () => {
    if (!referenceAvailable) return;
    for (const definition of issue10ModuleSurfaceFixtures) {
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
    const divergent = issue10ModuleSurfaceFixtures.filter(
      (definition) => definition.oracle === "reviewed-ts7"
    );
    expect(divergent).toHaveLength(1);
    for (const definition of divergent) {
      expect(() => assertTs7DivergenceEvidence(definition.fixture)).not.toThrow();
    }
  });

  it("emits no recoverable warnings for the ported family", async () => {
    for (const definition of issue10ModuleSurfaceFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.warnings).toEqual([]);
    }
  });

  it("covers every module-surface family with at least one ported fixture", () => {
    const families = new Set(issue10ModuleSurfaceFixtures.map((definition) => definition.family));
    expect([...families].sort()).toEqual(["mergedDeclarations", "namespaces", "reexports"]);
    const unchanged = issue10ModuleSurfaceFixtures.filter(
      (definition) => definition.oracle === "immutable-upstream"
    );
    const reviewed = issue10ModuleSurfaceFixtures.filter(
      (definition) => definition.oracle === "reviewed-ts7"
    );
    expect({
      total: issue10ModuleSurfaceFixtures.length,
      unchanged: unchanged.length,
      reviewedDivergences: reviewed.length,
    }).toEqual({ total: 5, unchanged: 4, reviewedDivergences: 1 });
  });
});

describe("Issue 10 re-export provenance and authored names", () => {
  it("records the original name of a renamed module re-export on the export node", async () => {
    const result = await runExtraction("module-reexports-basic", "input.ts");
    const root = result.module.exports.find((entry) => entry.name === "Root");
    expect(root).toBeDefined();
    // `export { RootComponent as Root } from './source'` keeps the public name…
    if (root?.name !== "Root") throw new Error("the renamed export disappeared");
    // …and records the authored source name beside it.
    expect(root.reexportedFrom).toBe("RootComponent");
    // A local alias without a module specifier does not count as a re-export.
    const aliased = result.module.exports.find((entry) => entry.name === "aliasedOverloadedFunction");
    expect(aliased).toBeUndefined();
  });

  it("records the intermediate re-export chain in provenance while the declaration paths keep the origin", async () => {
    const result = await runExtraction("module-reexports-basic", "input.ts");
    const rootEntry = result.provenance.find((entry) => entry.path.join("/") === "Root");
    expect(rootEntry).toBeDefined();
    if (rootEntry === undefined) throw new Error("missing provenance for Root");
    // The origin is the declaring module; the chain is the forwarding hop.
    expect(rootEntry.declarationPaths.some((path) => path.endsWith("source.tsx"))).toBe(true);
    expect(rootEntry.reexportChain).toEqual(["test/fixtures/module-reexports-basic/input.ts"]);
    // A directly declared export has no chain.
    const localEntry = result.provenance.find((entry) => entry.path.join("/") === "localFunction");
    expect(localEntry?.reexportChain).toBeUndefined();
  });

  it("flattens a namespace export under its public name without emitting the namespace object", async () => {
    const result = await runExtraction("module-reexports-basic", "input.ts");
    const names = result.module.exports.map((entry) => entry.name);
    // No bare `Source` object export exists; every member carries the namespace.
    expect(names).not.toContain("Source");
    for (const prefix of ["Source.RootProps", "Source.RootComponent", "Source.RootComponent.Props"]) {
      expect(names).toContain(prefix);
    }
    const member = result.module.exports.find((entry) => entry.name === "Source.RootComponent");
    expect(member?.type).toMatchObject({
      kind: "component",
      typeName: { name: "RootComponent", namespaces: ["Source"] },
    });
  });
});
