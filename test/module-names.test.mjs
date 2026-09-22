import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findFiles, isSourceFile, repoRelativePath, repoRoot, SOURCE_TREES } from "./repo-tree.mjs";

/**
 * Vague module names the naming rule bans. A test suffix (`utils.test.ts`) names a test, not the
 * module, so only a source file whose name before the extension is exactly a banned word matches.
 */
const VAGUE_MODULE_NAME = /^(utils|helpers|common|misc)$/;

/**
 * The rule statement the failure message carries once, before the offending paths.
 */
const RULE = "module basenames utils, helpers, common, misc are banned; name the module after what it owns";

/**
 * The one path the rule lets through. It stays allowlisted until the `@elmeragroup/internal`
 * focus-ring rules take the owner path as a rule option.
 */
const ALLOWED_VAGUE_PATHS = new Set(["packages/fuse/src/styles/utils.ts"]);

/**
 * Whether a module basename is banned as vague.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isVagueModule(name) {
  return isSourceFile(name) && VAGUE_MODULE_NAME.test(name.slice(0, name.lastIndexOf(".")));
}

describe("module names", () => {
  it("bans vague module basenames outside the allowlist", () => {
    const offenders = SOURCE_TREES.flatMap((tree) => findFiles(join(repoRoot, tree), isVagueModule))
      .map((path) => repoRelativePath(path))
      .filter((path) => !ALLOWED_VAGUE_PATHS.has(path));
    expect(offenders, `${RULE}\n${offenders.join("\n")}`).toEqual([]);
  });
});
