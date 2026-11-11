import { globSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { satisfies } from "semver";
import { expect, it } from "vitest";
import { parse } from "yaml";

import { asRecord, asString, isString } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

// The root `devEngines.runtime.version` is the one Node pin. pnpm downloads that release and runs
// every script on it, and CI's setup-node reads it from package.json. The other declarations of
// the Node version cannot read it, so this cross-checks them against it: each workspace's
// `engines.node` range must admit it, and the docs image must build on it.

/** @param {string} path */
function readText(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

/** @param {string} path */
function readManifest(path) {
  return asRecord(JSON.parse(readText(path)), path);
}

/** The pinned Node release, the oracle every other declaration must agree with. */
function pinnedNode() {
  const runtime = asRecord(
    asRecord(readManifest("package.json").devEngines, "devEngines").runtime,
    "runtime"
  );
  expect(runtime.name).toBe("node");
  return asString(runtime.version, "devEngines.runtime.version");
}

/** Every workspace manifest, root included, from the workspace globs as pnpm reads them. */
function workspaceManifestPaths() {
  const workspace = asRecord(parse(readText("pnpm-workspace.yaml")), "pnpm-workspace.yaml");
  const globs = (Array.isArray(workspace.packages) ? workspace.packages : []).map((glob) =>
    asString(glob, "workspace glob")
  );
  expect(globs, "pnpm-workspace.yaml packages").not.toHaveLength(0);
  const excluded = globs.filter((glob) => glob.startsWith("!")).map((glob) => glob.slice(1));
  const included = globs.filter((glob) => !glob.startsWith("!"));
  return [
    "package.json",
    ...globSync(
      included.map((glob) => `${glob}/package.json`),
      { cwd: repoRoot, exclude: excluded.map((glob) => `${glob}/package.json`) }
    ).filter((path) => !path.split(sep).includes("node_modules")),
  ];
}

it("admits the pinned Node in every workspace's engines.node range", () => {
  const pinned = pinnedNode();
  const ranges = workspaceManifestPaths().flatMap((path) => {
    const engines = asRecord(readManifest(path).engines ?? {}, `${path} engines`);
    return isString(engines.node) ? [{ path, range: engines.node }] : [];
  });
  expect(ranges.map(({ path }) => path)).toContain("package.json");
  for (const { path, range } of ranges) {
    expect(satisfies(pinned, range), `${path} engines.node ${range} admits ${pinned}`).toBe(true);
  }
});

it("builds the docs image on the pinned Node", () => {
  const arg = /^ARG NODE_VERSION=(\S+)$/m.exec(readText("apps/docs/Dockerfile"))?.[1];
  expect(arg).toBe(pinnedNode());
});
