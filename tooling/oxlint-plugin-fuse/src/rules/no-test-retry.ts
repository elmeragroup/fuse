import type { Context, ESTree, Rule } from "@oxlint/plugins";

import { anyViolates } from "../quantify.ts";
import { calleeTargets, entryFor, evaluate, propertyName } from "../resolve.ts";
import type { Alt } from "../resolve.ts";
import { isTestFile } from "../source-file.ts";
import { runnerRoots } from "../test-context.ts";

/** The option keys that rerun a test: Vitest's `retry` and `repeats`, Playwright's `retries`. */
const RERUN_KEYS = ["retry", "repeats", "retries"] as const;

/** The test API roots whose options a rerun key configures. */
const RUNNERS = new Set(["it", "test", "describe", "suite", "bench"]);

/** Whether a call takes test or suite options: a test API call or `vi.setConfig`. */
function takesRunnerOptions(context: Context, call: ESTree.CallExpression): boolean {
  const apis = calleeTargets(context, call.callee).map((target) => target?.path.join("."));
  return (
    anyViolates(apis, (api) => api === "vi.setConfig") ||
    anyViolates(runnerRoots(context, call.callee), (root) => root !== undefined && RUNNERS.has(root))
  );
}

/**
 * No test reruns: no `retry`, `repeats` or `retries` option reaches a test, a suite or
 * `vi.setConfig`, and none appears anywhere in a Vitest or Playwright config. A rerun turns a red
 * test green without a fix, so a test that flakes is made deterministic or deleted in the same
 * change.
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
    const check = (property: ESTree.Node): void => {
      if (property.type !== "Property" || reported.has(property)) return;
      const key = propertyName(property);
      if (key === undefined || !RERUN_KEYS.some((rerun) => rerun === key)) return;
      reported.add(property);
      context.report({ node: property.key, messageId: "rerun", data: { key } });
    };
    if (!isTestFile(context.filename)) return { Property: check };
    return {
      CallExpression(node) {
        if (!takesRunnerOptions(context, node)) return;
        for (const argument of node.arguments) {
          const options = evaluate(context, argument);
          // Any alternative that sets a rerun key is a rerun.
          for (const key of RERUN_KEYS) {
            const settingOf = (alternative: Alt): ESTree.Node | undefined => {
              const entry = entryFor(alternative, key);
              return entry === undefined || entry === "unknown" || entry._tag !== "property"
                ? undefined
                : entry.property;
            };
            if (!anyViolates(options, (alternative) => settingOf(alternative) !== undefined)) continue;
            // The report sits on the first alternative's setting: one report per argument and key.
            const setting = options.map(settingOf).find((property) => property !== undefined);
            if (setting !== undefined) check(setting);
          }
        }
      },
    };
  },
};
