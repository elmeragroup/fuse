import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import picomatch from "picomatch";
import { describe, expect, it } from "vitest";

import { repoRoot } from "../scripts/repo-tree.ts";
import { asRecord, asRecordArray, isString, readJsonObject } from "./json-object.mjs";

describe("the fuse lint plugin against the real tree", () => {
  // Unit under test: the plugin's owner paths and the configuration's file globs. Oracle: the
  // tracked files. A rule keyed to an owner or a glob that names no file checks nothing.
  it("refuses to load in a tree that lacks the owners its rules key on", async () => {
    const tree = mkdtempSync(join(tmpdir(), "fuse-lint-owners-"));
    try {
      cpSync(join(repoRoot, "scripts/oxlint"), join(tree, "scripts/oxlint"), { recursive: true });
      await expect(import(pathToFileURL(join(tree, "scripts/oxlint/fuse-plugin.ts")).href)).rejects.toThrow(
        /packages\/fuse\/src\/components\/chart\/chart-motion-mark\.ts/
      );
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  });

  it("loads in the repository, whose tree holds every owner", async () => {
    /** @type {unknown} */
    const loaded = await import(pathToFileURL(join(repoRoot, "scripts/oxlint/fuse-plugin.ts")).href);
    // A module namespace has no prototype, so its exports are copied onto a plain object first.
    const plugin = asRecord(asRecord(Object.assign({}, loaded), "plugin module").default, "plugin");
    expect(Object.keys(asRecord(plugin.rules, "rules")).length).toBeGreaterThan(0);
  });

  it("scopes every override to globs that match a tracked file", () => {
    // NUL-delimited, so a path git would quote in its plain output, such as a non-ASCII one, matches.
    const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" })
      .stdout.split("\0")
      .filter((path) => path !== "");
    const overrides = asRecordArray(readJsonObject(join(repoRoot, ".oxlintrc.json")).overrides, "overrides");
    const unmatched = overrides.flatMap((override) => {
      const globs = override.files;
      if (!Array.isArray(globs)) throw new Error("an override without files");
      return globs.filter(isString).filter((glob) => !tracked.some((file) => picomatch.isMatch(file, glob)));
    });
    expect(unmatched).toEqual([]);
  });
});
