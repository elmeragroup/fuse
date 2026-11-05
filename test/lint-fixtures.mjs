import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { repoRoot } from "../scripts/repo-tree.ts";
import { asRecord, asRecordArray, asString, isString, readJsonObject } from "./json-object.mjs";

/**
 * The fixture runner the lint-rule suites share: fixtures laid out at the repository paths the
 * rules govern, in temporary trees that never enter the checkout, linted under the real
 * `.oxlintrc.json`, so each case proves both a rule and the override that scopes it.
 */

/** The codes under test: the `fuse` plugin and the built-in rules the config scopes to moved contracts. */
export const UNDER_TEST = /^(?:fuse\(|eslint\(no-restricted-(?:globals|imports)\))/;

/**
 * @typedef {object} Fixture
 * @property {string} name - The case, as the test names it.
 * @property {string} path - The repository path oxlint lints the source under.
 * @property {readonly string[]} lines - The source, one entry per line.
 * @property {readonly string[]} reports - Each expected `code:line`, for the codes under test only.
 */

/**
 * Makes an empty temporary tree and collects it for removal.
 *
 * @param {string} prefix - The tree's name prefix.
 * @param {string[]} trees - Collects the tree so the suite removes it afterwards.
 * @returns {string} The tree's absolute path.
 */
export function fixtureTree(prefix, trees) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  trees.push(root);
  return root;
}

/**
 * Writes files into a tree, each at its repository path.
 *
 * @param {string} root - The tree.
 * @param {readonly { readonly path: string; readonly lines: readonly string[] }[]} files - The files.
 */
export function writeTree(root, files) {
  for (const file of files) {
    mkdirSync(join(root, dirname(file.path)), { recursive: true });
    writeFileSync(join(root, file.path), `${file.lines.join("\n")}\n`);
  }
}

/**
 * Removes the trees a suite made.
 *
 * @param {readonly string[]} trees - The trees.
 */
export function removeTrees(trees) {
  for (const tree of trees) rmSync(tree, { recursive: true, force: true });
}

/**
 * @param {readonly string[]} reports
 * @returns {string[]} The reports in code-point order, so the comparison ignores report order.
 */
export function sorted(reports) {
  return [...reports].sort((left, right) => left.localeCompare(right));
}

/**
 * The repository's oxlint configuration for a temporary tree: the same rules, overrides and
 * plugins, with local plugin paths made absolute. Type-aware linting is off because the temporary
 * tree has no tsconfig programs, and no rule under test reads types.
 *
 * @returns {Record<string, unknown>}
 */
export function fixtureConfig() {
  const config = readJsonObject(join(repoRoot, ".oxlintrc.json"));
  const { options: _typeAware, $schema: _schema, ...rest } = config;
  if (!Array.isArray(config.jsPlugins)) throw new Error(".oxlintrc.json jsPlugins is not an array");
  /** @type {unknown[]} */
  const plugins = config.jsPlugins;
  return {
    ...rest,
    jsPlugins: plugins.map((plugin) =>
      isString(plugin) && plugin.startsWith("./") ? join(repoRoot, plugin) : plugin
    ),
  };
}

/**
 * A temporary tree laid out like the repository's root: the repository configuration as
 * `.oxlintrc.json`, a root manifest, and the installed packages, which the package plugins resolve
 * from and the turbo plugin's manifest read needs.
 *
 * @param {string} prefix - The tree's name prefix.
 * @param {string[]} trees - Collects the tree so the suite removes it afterwards.
 * @returns {string} The tree's absolute path.
 */
export function configuredTree(prefix, trees) {
  const root = fixtureTree(prefix, trees);
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"));
  writeFileSync(join(root, "package.json"), '{ "name": "fuse-lint-fixtures", "private": true }\n');
  writeFileSync(join(root, ".oxlintrc.json"), JSON.stringify(fixtureConfig(), null, 2));
  return root;
}

/**
 * Writes `fixtures` into a configured tree, lints them in one oxlint run under the repository
 * configuration, and returns each fixture's reports for the codes under test. Each fixture is named
 * to oxlint, which lints a named file even where `ignorePatterns` would skip it, so a fixture sits
 * at a path the main pass reaches.
 *
 * @param {readonly Fixture[]} fixtures
 * @param {string[]} trees - Collects the tree so the suite removes it afterwards.
 * @returns {Map<string, string[]>} Sorted `code:line` reports by fixture path.
 */
export function lintFixtures(fixtures, trees) {
  const root = configuredTree("fuse-lint-rules-", trees);
  writeTree(root, fixtures);
  const run = spawnSync(
    process.execPath,
    [
      join(repoRoot, "node_modules/oxlint/bin/oxlint"),
      "-c",
      ".oxlintrc.json",
      "-f",
      "json",
      ...fixtures.map((fixture) => fixture.path),
    ],
    { cwd: root, encoding: "utf8" }
  );
  // oxlint exits 1 when it reports an error; anything else is a configuration or plugin failure.
  if (run.status !== 0 && run.status !== 1) throw new Error(`oxlint failed:\n${run.stderr}${run.stdout}`);
  /** @type {Map<string, string[]>} */
  const reports = new Map(fixtures.map((fixture) => [fixture.path, []]));
  const parsed = asRecord(JSON.parse(run.stdout), "oxlint JSON output");
  for (const diagnostic of asRecordArray(parsed.diagnostics, "diagnostics")) {
    const code = asString(diagnostic.code, "diagnostic code");
    if (!UNDER_TEST.test(code)) continue;
    const [label] = asRecordArray(diagnostic.labels, "diagnostic labels");
    const line = asRecord(asRecord(label, "first label").span, "label span").line;
    reports.get(asString(diagnostic.filename, "diagnostic filename"))?.push(`${code}:${String(line)}`);
  }
  return new Map([...reports].map(([path, found]) => [path, sorted(found)]));
}
