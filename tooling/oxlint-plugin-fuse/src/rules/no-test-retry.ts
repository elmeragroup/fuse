import type { Context, ESTree, Rule } from "@oxlint/plugins";

import { propertyKeyName } from "../ast-names.ts";
import { allQualify, firstViolation } from "../quantify.ts";
import { calleeApis, entryFor, evaluate } from "../resolve.ts";
import type { Alt } from "../resolve.ts";
import { isTestFile } from "../source-file.ts";
import { runnerRoots } from "../test-context.ts";

/** The option keys that rerun a test: Vitest's `retry` and `repeats`, Playwright's `retries`. */
const RERUN_KEYS = ["retry", "repeats", "retries"] as const;

/** The test API roots whose options a rerun key configures. */
const RUNNERS = new Set(["it", "test", "describe", "suite", "bench"]);

/** Whether a call takes test or suite options: a test API call or `vi.setConfig`. */
function takesRunnerOptions(context: Context, call: ESTree.CallExpression): boolean {
  return (
    calleeApis(context, call.callee).includes("vi.setConfig") ||
    runnerRoots(context, call.callee).some((root) => root !== undefined && RUNNERS.has(root))
  );
}

/** Whether one rerun value alternative turns reruns off: `0` or `false`. */
function runsOnce(alternative: Alt): boolean {
  return (
    (alternative.kind === "number" && alternative.value === 0) ||
    (alternative.kind === "boolean" && !alternative.value)
  );
}

/**
 * No test reruns: no `retry`, `repeats` or `retries` option reaches a test, a suite or
 * `vi.setConfig`, and none appears anywhere in a Vitest or Playwright config. A rerun turns a red
 * test green without a fix, so a test that flakes is made deterministic or deleted in the same
 * change. A value that is `0` or `false` in every alternative reruns nothing and stays allowed.
 *
 * Scope: follows what `resolve.ts` follows, for the test API (named, aliased or namespace import,
 * through `.each` and modifiers) and for the options object (bindings, spreads with last-wins
 * precedence, and a local function's returned object). Beyond that: a `--retry` flag in a
 * `package.json` script or CI workflow is outside what an AST rule sees.
 */
export const noTestRetry: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid retry and repeat options on tests, suites and test configs." },
    messages: {
      rerun:
        "`{{key}}` reruns a test until it passes, which hides a flake instead of fixing it. Make the test deterministic or delete it.",
    },
    schema: [],
  },
  create(context) {
    const reported = new Set<ESTree.Node>();

    /** The rerun key a property sets to rerun: a rerun key whose value is not `0` or `false` in every alternative. */
    const rerunKeyOf = (property: ESTree.ObjectProperty): string | undefined => {
      const key = propertyKeyName(property);
      if (key === undefined || !RERUN_KEYS.some((rerun) => rerun === key)) return undefined;
      return allQualify(evaluate(context, property.value), runsOnce) ? undefined : key;
    };

    const check = (property: ESTree.ObjectProperty): void => {
      const key = rerunKeyOf(property);
      if (key === undefined || reported.has(property)) return;
      reported.add(property);
      context.report({ node: property.key, messageId: "rerun", data: { key } });
    };
    if (!isTestFile(context.filename)) return { Property: check };
    return {
      CallExpression(node) {
        if (!takesRunnerOptions(context, node)) return;
        for (const argument of node.arguments) {
          const options = evaluate(context, argument);
          // Any alternative that sets a rerun key reruns; the report sits on the first one's setting.
          for (const key of RERUN_KEYS) {
            const setting = firstViolation(options, (alternative) => {
              const entry = entryFor(alternative, key);
              if (entry === undefined || entry === "unknown") return undefined;
              return rerunKeyOf(entry.property) === undefined ? undefined : entry.property;
            });
            if (setting !== undefined) check(setting);
          }
        }
      },
    };
  },
};
