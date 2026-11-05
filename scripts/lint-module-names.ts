/**
 * Lints the module names the main `oxlint .` pass cannot reach. `.oxlintrc.json` enables
 * `fuse/no-vague-module-name` over the repository's source trees, so editors, `--print-config` and
 * `lint:fix` all see it, but some source files never reach that pass: those its `ignorePatterns`
 * skip, such as packages/fuse/scripts/*.mjs, whose untyped Node loader hooks the type-aware rules
 * cannot check, and those any `.gitignore` covers, tracked or not, such as apps/docs/next-env.d.ts.
 * This pass asks oxlint which files the main pass lints (`--debug=files`, from the same directory
 * and configuration), so it never predicts oxlint's ignore rules, and names every other source file
 * `scripts/repo-tree.ts` defines to oxlint, which lints a file it is named whatever would otherwise
 * exclude it. The two passes together read each of those files once.
 *
 * Usage: `node --experimental-strip-types scripts/lint-module-names.ts [root] [oxlint flags…]`.
 * The root defaults to the repository; the module-name fixtures pass a fixture tree.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { findFiles, isSourceFile, repoRoot, SOURCE_TREES } from "./repo-tree.ts";

const OXLINT = join(repoRoot, "node_modules/oxlint/bin/oxlint");

/** The source files under `root`, relative to it with forward slashes. */
function sourceFiles(root: string): string[] {
  return SOURCE_TREES.map((tree) => join(root, tree))
    .filter((tree) => existsSync(tree))
    .flatMap((tree) => findFiles(tree, isSourceFile))
    .map((path) => relative(root, path).split(sep).join("/"));
}

/**
 * The files the main pass lints under `root`, as oxlint lists them: one path a line, relative to
 * the directory it walks.
 *
 * @throws When oxlint cannot list them, so the pass never mistakes a failed listing for files the
 *   main pass skips.
 */
function mainPassFiles(root: string): ReadonlySet<string> {
  const run = spawnSync(process.execPath, [OXLINT, "--debug=files", "."], { cwd: root, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`oxlint could not list the files it lints:\n${run.stderr}`);
  return new Set(run.stdout.split("\n").filter((path) => path !== ""));
}

const [root = repoRoot, ...flags] = process.argv.slice(2);
const reached = mainPassFiles(root);
const unreached = sourceFiles(root).filter((file) => !reached.has(file));
// oxlint lints the working directory when it is named no file, so an empty set lints nothing.
if (unreached.length > 0) {
  const run = spawnSync(
    process.execPath,
    [
      OXLINT,
      "-c",
      join(repoRoot, "scripts/oxlint/module-names.oxlintrc.json"),
      "--deny-warnings",
      ...flags,
      ...unreached,
    ],
    { cwd: root, stdio: "inherit" }
  );
  process.exitCode = run.status ?? 1;
}
