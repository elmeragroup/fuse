import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { repoRoot } from "../scripts/repo-tree.ts";
import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { configuredTree, removeTrees, sorted, writeTree } from "./lint-fixtures.mjs";
import { turboTasks } from "./workflow.mjs";

/**
 * Unit under test: the two module-name passes together, the main `oxlint .` pass and
 * scripts/lint-module-names.ts. Oracle: the vague names written here among the files the retired
 * filesystem walker read, each reported once, by whichever pass reaches it: every reach case the
 * main pass has (an `ignorePatterns` match, gitignored files untracked and tracked, a nested
 * `.gitignore`, a `!` re-include) and the files outside the walker's set, which neither reports.
 */
describe("the module-name passes", () => {
  /** @type {string[]} */
  const trees = [];

  afterAll(() => {
    removeTrees(trees);
  });

  /** @type {readonly { readonly path: string; readonly reported: boolean }[]} */
  const FILES = [
    // The main pass reaches these.
    { path: "apps/probe/src/helpers.ts", reported: true },
    { path: "tooling/probe/common.mjs", reported: true },
    { path: "packages/fuse/src/styles/utils.ts", reported: false },
    // The main configuration's ignorePatterns skip the package's loader hooks.
    { path: "packages/fuse/scripts/helpers.mjs", reported: true },
    { path: "packages/fuse/scripts/ts-hooks.mjs", reported: false },
    // Gitignored and untracked, some at paths git quotes in its plain output.
    { path: "apps/probe/local/misc.ts", reported: true },
    { path: "apps/prøve/local/helpers.ts", reported: true },
    { path: "apps/with space/local/common.ts", reported: true },
    // Tracked, then gitignored.
    { path: "apps/probe/tracked/helpers.ts", reported: true },
    // Ignored by a nested .gitignore.
    { path: "apps/probe/nested/inner/common.ts", reported: true },
    // Ignored with its folder, one file re-included by a `!` pattern.
    { path: "apps/probe/negated/misc.ts", reported: true },
    { path: "apps/probe/negated/utils.ts", reported: true },
    // Installed and built output, generated modules, dot-entries and files outside the trees.
    { path: "packages/probe/dist/helpers.js", reported: false },
    { path: "apps/probe/src/generated/helpers.ts", reported: false },
    { path: "packages/.probe/utils.ts", reported: false },
    { path: "misc.ts", reported: false },
  ];

  /**
   * The files a pass reports under the module-name rule.
   *
   * @param {import("node:child_process").SpawnSyncReturns<string>} run - The pass's oxlint run.
   * @returns {string[]} The reported files, once per report.
   */
  function reported(run) {
    const parsed = asRecord(JSON.parse(run.stdout), "oxlint JSON output");
    return asRecordArray(parsed.diagnostics, "diagnostics")
      .filter((diagnostic) => asString(diagnostic.code, "diagnostic code") === "fuse(no-vague-module-name)")
      .map((diagnostic) => asString(diagnostic.filename, "diagnostic filename"));
  }

  it("reports each vague name the retired walker read once, by whichever pass reaches it", () => {
    const tree = configuredTree("fuse-module-names-", trees);
    writeTree(
      tree,
      FILES.map(({ path }) => ({ path, lines: ["export const probe = 1;"] }))
    );
    const git = (/** @type {string[]} */ ...args) => spawnSync("git", args, { cwd: tree, encoding: "utf8" });
    git("init", "--quiet");
    git("add", "apps/probe/tracked/helpers.ts");
    writeFileSync(
      join(tree, ".gitignore"),
      [
        "node_modules",
        "apps/probe/local/",
        "apps/prøve/local/",
        "apps/with space/local/",
        "apps/probe/tracked/",
        "apps/probe/negated/*",
        "!apps/probe/negated/utils.ts",
        "",
      ].join("\n")
    );
    mkdirSync(dirname(join(tree, "apps/probe/nested/.gitignore")), { recursive: true });
    writeFileSync(join(tree, "apps/probe/nested/.gitignore"), "inner/\n");

    const main = spawnSync(
      process.execPath,
      [join(repoRoot, "node_modules/oxlint/bin/oxlint"), "-f", "json", "."],
      {
        cwd: tree,
        encoding: "utf8",
      }
    );
    const names = spawnSync(
      process.execPath,
      ["--experimental-strip-types", join(repoRoot, "scripts/lint-module-names.ts"), tree, "-f", "json"],
      { cwd: repoRoot, encoding: "utf8" }
    );
    const both = [...reported(main), ...reported(names)];
    expect(sorted(both)).toEqual(sorted(FILES.filter((file) => file.reported).map(({ path }) => path)));
    expect(new Set(both).size).toBe(both.length);
  });
});

describe("the module-name pass in the task graph", () => {
  // Unit under test: turbo.json's `//#lint:module-names`. Oracle: the files the pass reads, some
  // gitignored, which no input hash covers, so a cached result could replay green over a new one.
  it("always runs, and runs in the check aggregate", () => {
    const tasks = turboTasks(["run", "check"]);
    const task = tasks.find((candidate) => candidate.taskId === "//#lint:module-names");
    if (task === undefined) throw new Error("the check aggregate does not run //#lint:module-names");
    expect(asRecord(task.resolvedTaskDefinition, "resolved task definition").cache).toBe(false);
  });
});
