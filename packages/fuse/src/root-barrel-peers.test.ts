import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { OPTIONAL_PEER_ENTRIES, walkImportedSourceFiles } from "../scripts/entries";

// Unit under test: the module graph `@elmeragroup/fuse` loads. Oracle: OPTIONAL_PEER_ENTRIES,
// whose peers only their own entries may load, so `import { Button } from "@elmeragroup/fuse"`
// never resolves a package the consumer may not have installed. Why a test and not a lint rule:
// the boundary is the graph the root reaches, and charts legitimately import data-table's pure
// pagination text, so no per-file import rule can state it.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The module specifiers a source file imports or re-exports at runtime, type-only ones left out. */
function runtimeImports(file: string): string[] {
  const { module } = parseSync(file, readFileSync(join(packageRoot, file), "utf8"));
  return [
    ...module.staticImports
      .filter((entry) => entry.entries.length === 0 || entry.entries.some((item) => !item.isType))
      .map((entry) => entry.moduleRequest.value),
    ...module.staticExports.flatMap(({ entries }) =>
      entries.flatMap((entry) =>
        entry.moduleRequest === null || entry.isType ? [] : [entry.moduleRequest.value]
      )
    ),
  ];
}

describe("the root barrel", () => {
  const reached = walkImportedSourceFiles(packageRoot, ["src/index.ts"]);

  it.each([...new Set(Object.values(OPTIONAL_PEER_ENTRIES))])("reaches no module that loads %s", (peer) => {
    expect(reached).toContain("src/components/button/button.tsx");
    expect(reached.filter((file) => runtimeImports(file).includes(peer))).toEqual([]);
  });
});
