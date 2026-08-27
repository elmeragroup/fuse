import { Effect } from "effect";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures/issue-10-review");
const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");

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

describe("Issue 10 review findings", () => {
  it("reports a barrel cycle through namespace re-exports as a structured warning and terminates", async () => {
    // input -> Loop -> Back -> input: the second visit of the input module
    // hits the visited set, so flattening stops with one warning instead of
    // recursing forever.
    const result = await runExtraction("cycle", "input.ts");
    expect(result.warnings).toHaveLength(1);
    const warning = result.warnings[0];
    if (warning?.code !== "unresolved-re-export") {
      throw new Error(`expected unresolved-re-export, got ${warning?.code ?? "nothing"}`);
    }
    expect(warning.reason).toBe("cycle");
    expect(warning.name).toBe("Loop.Back.Loop");
    // The cut keeps extraction alive; no phantom exports are manufactured for
    // the branch that could not be followed.
    expect(result.module.exports).toEqual([]);
  });

  it("reports an unresolvable default export expression like upstream does", async () => {
    // `export default <arrow>` anchors no symbol under TypeScript 7's
    // declaration-shaped default exports; upstream emits the same condition
    // (`missing-default-export-symbol`) and skips the export.
    const result = await runExtraction("default-arrow", "input.ts");
    expect(result.module.exports).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    const warning = result.warnings[0];
    if (warning?.code !== "missing-default-export-symbol") {
      throw new Error(`expected missing-default-export-symbol, got ${warning?.code ?? "nothing"}`);
    }
    expect(warning.sourceText).toBe("() => ({ ok: true })");
    expect(warning.message).toContain('Could not find the symbol of default export "() => ({ ok: true })"');
  });

  it("records every intermediate forwarding file of a multi-hop re-export chain", async () => {
    // input -> middle -> origin: each forwarding file appears in
    // `reexportChain` outermost first, and the origin stays only in
    // `declarationPaths`. Both value and type-only re-exports are pinned.
    const result = await runExtraction("multi-hop", "input.ts");
    const names = result.module.exports.map((entry) => entry.name);
    expect(names).toEqual(["ping", "Pong"]);
    for (const name of ["ping", "Pong"]) {
      const entry = result.provenance.find((candidate) => candidate.path.join("/") === name);
      expect(entry).toBeDefined();
      if (entry === undefined) throw new Error(`missing provenance for ${name}`);
      expect(entry.reexportChain).toEqual([
        "fixtures/issue-10-review/multi-hop/input.ts",
        "fixtures/issue-10-review/multi-hop/middle.ts",
      ]);
      expect(entry.declarationPaths.some((path) => path.endsWith("origin.ts"))).toBe(true);
    }
  });

  it("never reports ambiguity for clean inputs: TypeScript rejects star collisions at typecheck time", async () => {
    // TS2308 makes a two-star collision on one name a compile ERROR, so a
    // project that passes the fixture typecheck gate cannot contain one. The
    // extractor still carries the `ambiguous` reason for projects extracted
    // without that guarantee; it is intentionally unrepresentable here because
    // every fixture input must typecheck independently.
    const result = await runExtraction("cycle", "input.ts");
    expect(
      result.warnings.some(
        (warning) => warning.code === "unresolved-re-export" && warning.reason === "ambiguous"
      )
    ).toBe(false);
  });
});
