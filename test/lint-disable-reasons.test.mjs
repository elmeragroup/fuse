import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findFiles, repoRelativePath, repoRoot, SOURCE_EXTENSION, SOURCE_TREES } from "./workflow.mjs";

/**
 * A disable directive inside a line or block comment, in both spellings oxlint honours. Requiring
 * the comment opener keeps prose mentions of the directive out of the scan.
 */
const DISABLE_DIRECTIVE = /(?:\/\/|\/\*)\s*(?:oxlint|eslint)-disable(?:-next-line|-line)?/;

/** The separator between a directive and its reason. */
const REASON_SEPARATOR = " -- ";

/** Non-space characters a reason must carry so it says more than "needed". */
const MINIMUM_REASON_LENGTH = 8;

/**
 * The rule statement the failure message carries once, before the offenders.
 * `docs/spec/tooling.md` §7.6 is its canonical statement.
 */
const RULE =
  `every disable comment carries \`${REASON_SEPARATOR}\` and a reason of at least ` +
  `${MINIMUM_REASON_LENGTH} non-space characters; a disable without a ` +
  `\`${REASON_SEPARATOR.trim()} reason\` fails \`pnpm test:repo-policy\` (docs/spec/tooling.md §7.6)`;

/**
 * Whether a file basename is a JS/TS module that can carry a disable directive.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isLintableSource(name) {
  return SOURCE_EXTENSION.test(name);
}

/**
 * Labels every directive in one file's text whose reason is missing or too short as
 * `path:line rule`, so a failure names the site and the rule it silences.
 *
 * Known soft spots, accepted at this size: a string literal that spells a directive is scanned as
 * one, and a block directive whose reason sits on a following line reads as bare. House style
 * keeps directives single-line and out of string literals.
 *
 * @param {string} path - Absolute file path.
 * @param {string} text - File contents.
 * @returns {string[]} One label per directive without a sufficient reason.
 */
function bareDirectives(path, text) {
  const label = repoRelativePath(path);
  /** @type {string[]} */
  const offenders = [];
  text.split("\n").forEach((line, index) => {
    const marker = DISABLE_DIRECTIVE.exec(line);
    if (marker === null) return;
    const rest = line.slice(marker.index + marker[0].length);
    const separator = rest.indexOf(REASON_SEPARATOR);
    const rawReason = separator === -1 ? "" : rest.slice(separator + REASON_SEPARATOR.length);
    // Strip the closing delimiter and code that can follow a directive before counting, so a
    // JSX closer (`*/}`) does not count as reason text.
    const reason = rawReason.replace(/[\s*/}]+$/, "");
    if (reason.replace(/\s/g, "").length >= MINIMUM_REASON_LENGTH) return;
    const rules = (separator === -1 ? rest : rest.slice(0, separator)).replace(/[\s*/}]+$/, "").trim();
    offenders.push(`${label}:${index + 1} ${rules === "" ? "(all rules)" : rules}`);
  });
  return offenders;
}

describe("lint disable reasons", () => {
  it("requires a reason on every oxlint/eslint-disable directive", () => {
    const offenders = SOURCE_TREES.flatMap((tree) =>
      findFiles(join(repoRoot, tree), isLintableSource).flatMap((path) =>
        bareDirectives(path, readFileSync(path, "utf8"))
      )
    );
    expect(offenders, `${RULE}\n${offenders.join("\n")}`).toEqual([]);
  });
});
