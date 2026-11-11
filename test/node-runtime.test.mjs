import { readFileSync } from "node:fs";
import { join } from "node:path";
import { satisfies } from "semver";
import { expect, it } from "vitest";

import { asRecord, asString } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

// The root `devEngines.runtime.version` is the one Node pin. pnpm downloads that release and runs
// every script on it, and CI's setup-node reads it from package.json. Two declarations of the Node
// version cannot read it, so this cross-checks them against it: the root `engines.node` range
// contributors install with must admit it, and the docs image must build on it.

/** @param {string} path */
function readText(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

const rootManifest = asRecord(JSON.parse(readText("package.json")), "package.json");
const runtime = asRecord(asRecord(rootManifest.devEngines, "devEngines").runtime, "devEngines.runtime");
if (runtime.name !== "node") {
  throw new Error(`devEngines.runtime.name is ${String(runtime.name)}, not node`);
}
/** The pinned Node release, the oracle every other declaration must agree with. */
const pinned = asString(runtime.version, "devEngines.runtime.version");

it("admits the pinned Node in the root engines.node range", () => {
  const range = asString(asRecord(rootManifest.engines, "engines").node, "engines.node");
  expect(satisfies(pinned, range), `engines.node ${range} admits ${pinned}`).toBe(true);
});

it("builds the docs image on the pinned Node", () => {
  const arg = /^ARG NODE_VERSION=(\S+)$/m.exec(readText("apps/docs/Dockerfile"))?.[1];
  expect(arg).toBe(pinned);
});
