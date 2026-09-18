import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { findFiles, repoRoot } from "./workflow.mjs";

/** Repository trees whose module basenames the naming rule governs. */
const SOURCE_TREES = ["apps", "packages", "scripts", "tooling", "test"];

/**
 * Vague module basenames the naming rule bans. A test suffix (`utils.test.ts`) names a test, not
 * the module, so it does not match.
 */
const VAGUE_BASENAME = /^(utils|helpers|common|misc)\.[cm]?[jt]sx?$/;

/**
 * The rule statement the failure message carries once, before the offending paths.
 * `docs/spec/tooling.md` §7.6 is its canonical statement.
 */
const RULE =
  "module basenames utils, helpers, common, misc are banned; name the module after what it owns " +
  "(docs/spec/tooling.md §7.6)";

/**
 * The one path the rule lets through: pinned by the `@elmeragroup/internal` focus-ring rules;
 * rename when the rules take the owner path as a rule option (plan ticket 11).
 */
const ALLOWED_VAGUE_PATHS = new Set(["packages/ui/src/styles/utils.ts"]);

/**
 * Whether a module basename is banned as vague.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isVagueModule(name) {
  return VAGUE_BASENAME.test(name);
}

describe("module names", () => {
  it("bans vague module basenames outside the allowlist", () => {
    const offenders = SOURCE_TREES.flatMap((tree) => findFiles(join(repoRoot, tree), isVagueModule))
      .map((path) => relative(repoRoot, path).split(sep).join("/"))
      .filter((path) => !ALLOWED_VAGUE_PATHS.has(path));
    expect(offenders, `${RULE}\n${offenders.join("\n")}`).toEqual([]);
  });
});
