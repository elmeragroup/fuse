import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { asRecord } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

/** @param {string} file */
function readYaml(file) {
  return asRecord(parse(readFileSync(join(repoRoot, file), "utf8")), file);
}

describe("allowBuilds", () => {
  it("grants install scripts only to packages the lockfile installs", () => {
    // A grant for an absent package would silently run a future transitive copy's scripts unreviewed.
    const allowed = Object.keys(asRecord(readYaml("pnpm-workspace.yaml").allowBuilds, "allowBuilds"));
    const installed = new Set(
      Object.keys(asRecord(readYaml("pnpm-lock.yaml").packages, "lockfile packages")).map((key) =>
        key.slice(0, key.lastIndexOf("@"))
      )
    );
    expect(allowed.filter((name) => !installed.has(name))).toEqual([]);
  });
});
