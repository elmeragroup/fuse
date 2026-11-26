import type { ESTree, Rule } from "@oxlint/plugins";

import { isFunction, unwrap } from "../ast-walk.ts";
import { firstViolation } from "../quantify.ts";
import type { Alt } from "../resolve.ts";
import { evaluate } from "../resolve.ts";

/** Node's calls that create a temporary directory. */
const TEMP_DIR_CALLS: ReadonlySet<string> = new Set([
  "mkdtemp",
  "mkdtempSync",
  "mkdtempDisposable",
  "mkdtempDisposableSync",
]);

/** Node's file system modules, which export those calls. */
const NODE_FS = /^(?:node:)?fs(?:\/promises)?$/u;

/** The test runner modules that export a suite opener. */
const SUITE_MODULES: ReadonlySet<string> = new Set(["vitest", "@effect/vitest"]);

/** The exports of those modules that open a suite. */
const SUITE_EXPORTS: ReadonlySet<string> = new Set(["describe", "suite"]);

/** The suite modifiers Vitest's `SuiteAPI` chains, each read off a suite opener as another one. */
const SUITE_MODIFIERS: ReadonlySet<string> = new Set(["concurrent", "only", "skip", "todo", "shuffle"]);

/** The `SuiteAPI` factories that take a condition and return a suite opener. */
const CONDITION_FACTORIES: ReadonlySet<string> = new Set(["skipIf", "runIf"]);

/** The `SuiteAPI` factories that take a table and return a function that opens a suite per row. */
const TABLE_FACTORIES: ReadonlySet<string> = new Set(["each", "for"]);

/**
 * A test file creates its temporary directories in a hook or a test, never at module level or in
 * a suite callback. Vitest runs those two when it collects the file, even when a `-t` filter or a
 * failed collection then skips every test and the `afterAll` that would remove the directory. The
 * directory outlives the run: one under the repo holds generated files that fail the next
 * `pnpm lint`, and one under the OS temp dir stays there. A `using` binding does not help at those
 * sites, since it removes the directory before any test runs.
 *
 * The rule flags `mkdtemp`, `mkdtempSync`, `mkdtempDisposable` and `mkdtempDisposableSync` when
 * `evaluate` traces the call to `node:fs` or `node:fs/promises` (with or without `node:`): a named
 * import under any alias, or a member of a namespace or default import of either module, or of
 * `node:fs`'s `promises`. It flags them when every function around the call is a suite callback:
 * an argument of `describe` or `suite` from `vitest` or `@effect/vitest`, or of `@effect/vitest`'s
 * `layer(...)`, under any alias or namespace. The callee may go through the suite modifiers and
 * factories of Vitest's `SuiteAPI` first (`describe.skip`, `describe.runIf(enabled).concurrent`,
 * `describe.each(table)`, `` describe.each`table` ``), or through a binding of one
 * (`const cases = describe.each(table)`). A test registered on the collector a suite call returns
 * (`describe(...).test(...)`) runs with the tests, and so does a non-static class field
 * initializer, which runs when the class is constructed. The config scopes the rule to test files.
 *
 * It misses a helper function that creates the directory and is itself called at module level,
 * since the call sits in a function the rule cannot tell runs at collection, and for the same
 * reason a class whose instance field creates one when a suite callback constructs it. It misses
 * an alias of a tagged table (``const cases = describe.each`…` ``). It misses a suite
 * opened through a callback parameter (`it.layer(...)` inside a `layer` callback), a `require`d
 * `fs`, and an `fs` passed in as a parameter, since `evaluate` cannot trace them to an import.
 */
export const noTempDirAtCollection: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid creating a temporary directory at module level or in a suite callback of a test file; create it in a test or a hook.",
    },
    messages: {
      collected:
        "Vitest runs this `{{name}}` when it collects the file, so a run that skips every test leaves the directory behind. Create it in `beforeAll` and return a function that removes it, or create it in the test body with `using dir = mkdtempDisposableSync(...)`.",
    },
    schema: [],
  },
  create(context) {
    /**
     * Whether a callee opens a suite. `evaluate` reads a tagged template as `opaque`, so a tagged
     * table (`` describe.each`table` ``) is read off its tag.
     */
    const opensSuite = (callee: ESTree.Node): boolean => {
      const expression = unwrap(callee);
      if (expression.type === "TaggedTemplateExpression")
        return evaluate(context, expression.tag).some(isTableFactory);
      return evaluate(context, expression).some(isSuiteOpener);
    };

    /**
     * Whether every function around `node` is a suite callback, so the node runs at collection. A
     * non-static class field initializer runs when the class is constructed, so the walk stops there.
     */
    const runsAtCollection = (node: ESTree.Node): boolean => {
      let child = node;
      for (let parent: ESTree.Node | null = node.parent; parent !== null; parent = parent.parent) {
        if (isFunction(parent) && !isSuiteCallback(parent)) return false;
        if (isInstanceField(parent) && parent.value === child) return false;
        child = parent;
      }
      return true;
    };

    /** Whether a function is an argument of a call that opens a suite. */
    const isSuiteCallback = (fn: ESTree.Node): boolean => {
      const call = fn.parent;
      return (
        call?.type === "CallExpression" &&
        call.arguments.some((argument) => argument === fn) &&
        opensSuite(call.callee)
      );
    };

    return {
      CallExpression(node) {
        const name = firstViolation(evaluate(context, node.callee), tempDirCall);
        if (name !== undefined && runsAtCollection(node))
          context.report({ node, messageId: "collected", data: { name } });
      },
    };
  },
};

/** The name of the temporary directory call a callee may be, or `undefined`. */
function tempDirCall(callee: Alt): string | undefined {
  if (callee.kind === "import")
    return NODE_FS.test(callee.source) && TEMP_DIR_CALLS.has(callee.imported) ? callee.imported : undefined;
  if (callee.kind === "member" && TEMP_DIR_CALLS.has(callee.key) && isFsModule(callee.object))
    return callee.key;
  return undefined;
}

/**
 * Whether a value is a Node file system module: a default import, or `promises` read off `node:fs`.
 * A namespace import needs no case, since `evaluate` reads its member as an import of that name.
 */
function isFsModule(value: Alt): boolean {
  if (value.kind === "import")
    return NODE_FS.test(value.source) && (value.imported === "default" || value.imported === "promises");
  return value.kind === "member" && value.key === "promises" && isFsModule(value.object);
}

/** Whether a class member is a non-static field, whose initializer runs at construction. */
function isInstanceField(node: ESTree.Node): node is ESTree.PropertyDefinition | ESTree.AccessorProperty {
  return (node.type === "PropertyDefinition" || node.type === "AccessorProperty") && !node.static;
}

/**
 * Whether a value is a `SuiteAPI`: a suite export, a suite modifier read off one, or a condition
 * factory called on one (`describe.runIf(enabled)`).
 */
function isSuiteApi(value: Alt): boolean {
  switch (value.kind) {
    case "import":
      return SUITE_MODULES.has(value.source) && SUITE_EXPORTS.has(value.imported);
    case "member":
      return SUITE_MODIFIERS.has(value.key) && isSuiteApi(value.object);
    case "call":
      return (
        value.callee.kind === "member" &&
        CONDITION_FACTORIES.has(value.callee.key) &&
        isSuiteApi(value.callee.object)
      );
    default:
      return false;
  }
}

/** Whether a value is a table factory read off a `SuiteAPI`, such as `describe.each`. */
function isTableFactory(value: Alt): boolean {
  return value.kind === "member" && TABLE_FACTORIES.has(value.key) && isSuiteApi(value.object);
}

/**
 * Whether calling a value opens a suite: a `SuiteAPI`, a table factory's result
 * (`describe.each(table)`), or `@effect/vitest`'s `layer(...)`.
 */
function isSuiteOpener(value: Alt): boolean {
  if (isSuiteApi(value)) return true;
  if (value.kind !== "call") return false;
  const { callee } = value;
  return callee.kind === "import"
    ? callee.source === "@effect/vitest" && callee.imported === "layer"
    : isTableFactory(callee);
}
