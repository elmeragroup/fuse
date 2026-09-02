import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ExtractionResult } from "../src/index.ts";
import { extractFixture, fixtureRoot } from "./support/extract.ts";

const tsconfigPath = resolve(fixtureRoot, "issue-10-tsconfig.json");

function runExtraction(fixture: string, file: string): Promise<ExtractionResult> {
  return extractFixture({ tsconfigPath }, resolve(fixtureRoot, fixture, file));
}

describe("re-export provenance and authored names", () => {
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
