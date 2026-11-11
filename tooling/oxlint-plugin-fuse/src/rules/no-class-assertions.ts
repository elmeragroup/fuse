import type { ESTree, Rule } from "@oxlint/plugins";

import { nameChain } from "../ast-names.ts";
import { descendants, unwrap } from "../ast-walk.ts";
import { allQualify, anyViolates } from "../quantify.ts";
import {
  calleeNames,
  enter,
  evaluate,
  memberName,
  propertyName,
  returnedValues,
  stringValues,
} from "../resolve.ts";
import type { ActivePath, Alt } from "../resolve.ts";
import { assertionOf, evidenceSets, reachOf } from "../test-context.ts";

/** The `classList` methods whose string arguments put a class on an element. */
const CLASS_WRITES = new Set(["add", "toggle", "replace"]);

/** A prop that hands a part its classes: `className`, `class`, or a part's `triggerClassName`. */
const CLASS_PROP = /^(?:class|className|[a-z][A-Za-z]*ClassName)$/u;

/** One expected class value: its alternatives, and its spelling for the report. */
type Expected = { readonly alternatives: ReadonlyArray<Alt>; readonly spelling: string };

/** A class assertion waiting for the classes its evidence supplies. */
type Pending = { readonly node: ESTree.Node; readonly expected: ReadonlyArray<Expected> };

/** The class tokens a string holds. */
function tokensOf(text: string): string[] {
  return text.split(/\s+/u).filter(Boolean);
}

/**
 * No class pins: an assertion on an element's classes (`toHaveClass`, `toHaveAttribute("class")`,
 * `className`, `classList` or `getAttribute("class")`, read directly or through a binding, in any
 * value an `expect.poll` callback returns, under any alias of `expect`) names only classes its own
 * test supplies: through a `className` prop (or a part's, such as `triggerClassName`), a props
 * object or `classList.add`, in the test, the setup hooks that run before it, or the fixtures and
 * helpers they reach. A test registered more than once must supply the class in every run, each
 * with its own suite's hooks. An assertion in a helper outside any test counts only what its own
 * function reaches. That proves a consumer's class reaches the right part. A component's own
 * classes are its implementation, so assert the computed style, role or state they produce
 * instead. An expected value is exempt only when every alternative qualifies: a string whose
 * classes are supplied, a pattern that matches a supplied class, or a call the evaluator does not
 * follow, such as an imported recipe's output, which is a cross-check. A call that only reshapes
 * literals (`"h-9".trim()`) still pins them. A value reads classes, and an attribute name is
 * `"class"`, when any alternative is.
 *
 * Scope: follows what `resolve.ts` follows, for supplied classes, expected classes and class
 * reads alike, and finds a test, its runs and its setup hooks as `test-context.ts` does. Beyond
 * that: classes supplied through an `it.each` table outside the test callback are not followed,
 * and a call the evaluator cannot follow (an imported helper) counts as a cross-check whatever it
 * returns.
 */
export const noClassAssertions: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid assertions on class names the test did not supply." },
    messages: {
      pinned:
        "This pins the component's own class `{{token}}`, which a behavior-preserving refactor changes. Assert the computed style, role or state it produces; a class assertion is for a className the test passes in.",
    },
    schema: [],
  },
  create(context) {
    const pending: Pending[] = [];
    const suppliedByRoots = new Map<string, ReadonlySet<string>>();

    /** Every string a supplied value may be, a class callback's returns included. */
    const suppliedStrings = (value: ESTree.Node): string[] =>
      evaluate(context, value).flatMap((alternative) =>
        alternative.kind === "function"
          ? returnedValues(context, alternative.fn).flatMap((returned) =>
              stringValues(evaluate(context, returned))
            )
          : stringValues([alternative])
      );

    /**
     * The classes one run's evidence supplies: its test, the setup hooks that run before it, and
     * every fixture or helper they reach; outside a test, its own function's reach. Every value a
     * supplied class may be is supplied.
     */
    const suppliedBy = (roots: ReadonlyArray<ESTree.Node>): ReadonlySet<string> => {
      const key = roots.map((root) => `${root.start}:${root.end}`).join(",");
      const cached = suppliedByRoots.get(key);
      if (cached !== undefined) return cached;
      const supplied = new Set<string>();
      const add = (value: ESTree.Node): void => {
        for (const text of suppliedStrings(value)) for (const token of tokensOf(text)) supplied.add(token);
      };
      for (const region of reachOf(context, roots)) {
        for (const node of descendants(context, region, "into-functions")) {
          if (node.type === "JSXAttribute" && CLASS_PROP.test(nameChain(node.name).join("."))) {
            const value = node.value;
            if (value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression") {
              add(value.expression);
            } else if (value !== null) {
              add(value);
            }
          } else if (node.type === "Property" && CLASS_PROP.test(propertyName(node) ?? "")) {
            add(node.value);
          } else if (node.type === "CallExpression") {
            const callee = unwrap(node.callee);
            if (
              callee.type === "MemberExpression" &&
              CLASS_WRITES.has(memberName(callee) ?? "") &&
              anyViolates(evaluate(context, callee.object), isClassList)
            ) {
              for (const argument of node.arguments) add(argument);
            }
          }
        }
      }
      suppliedByRoots.set(key, supplied);
      return supplied;
    };

    /** Whether an alternative is an element's `classList`. */
    const isClassList = (alternative: Alt): boolean =>
      alternative.kind === "member" && alternative.key === "classList";

    /**
     * Whether one alternative reads an element's classes: `.className` or `.classList`, the
     * string or list methods after it (`.split(" ")`, `Array.from(…)`, `[...…]`), or
     * `getAttribute(name)` where any alternative of the name is `"class"`.
     */
    const readsClasses = (alternative: Alt, path: ActivePath = new Set()): boolean => {
      if (alternative.kind === "member") {
        return (
          alternative.key === "className" ||
          alternative.key === "classList" ||
          readsClasses(alternative.object, path)
        );
      }
      if (alternative.kind === "array") {
        const inner = enter(path, alternative.node);
        if (inner === undefined || alternative.node.type !== "ArrayExpression") return false;
        return alternative.node.elements.some(
          (element) =>
            element?.type === "SpreadElement" &&
            anyViolates(evaluate(context, element.argument), (spread) => readsClasses(spread, inner))
        );
      }
      if (alternative.kind !== "opaque" || alternative.node.type !== "CallExpression") return false;
      const call = alternative.node;
      const inner = enter(path, call);
      if (inner === undefined) return false;
      const [argument] = call.arguments;
      if (calleeNames(context, call.callee).includes("Array.from")) {
        return (
          argument !== undefined &&
          anyViolates(evaluate(context, argument), (from) => readsClasses(from, inner))
        );
      }
      return anyViolates(evaluate(context, call.callee), (callee) => {
        if (callee.kind !== "member") return false;
        if (callee.key === "getAttribute") return argument !== undefined && namesClass(argument);
        return readsClasses(callee.object, inner);
      });
    };

    /** Whether any alternative of an attribute name is `"class"`. */
    const namesClass = (node: ESTree.Node): boolean =>
      anyViolates(evaluate(context, node), (name) => name.kind === "string" && name.value === "class");

    /**
     * The classes one actual alternative asks about when it is a membership test:
     * `x.classList.contains(arg)`, or `includes(arg)` on a read of the classes such as
     * `x.className.split(/\s+/).includes(arg)`. Every argument is a class it asks about.
     */
    const membershipOf = (alternative: Alt): ReadonlyArray<ESTree.Node> => {
      if (alternative.kind !== "opaque" || alternative.node.type !== "CallExpression") return [];
      const call = alternative.node;
      const asks = anyViolates(
        evaluate(context, call.callee),
        (callee) =>
          callee.kind === "member" &&
          ((callee.key === "contains" && isClassList(callee.object)) ||
            (callee.key === "includes" && readsClasses(callee.object)))
      );
      return asks ? call.arguments : [];
    };

    /** An expected value: its alternatives and its spelling. */
    const expectedOf = (node: ESTree.Node): Expected => ({
      alternatives: evaluate(context, node),
      spelling: context.sourceCode.getText(node),
    });

    /**
     * The class one expected alternative pins against what a run supplies, or `undefined` when it
     * qualifies: a string whose every token is supplied, a pattern that matches a supplied class,
     * a list whose every element qualifies, or a call the evaluator does not follow (an imported
     * recipe's output), which is a cross-check.
     */
    const pinnedBy = (
      alternative: Alt,
      supplied: ReadonlySet<string>,
      spelling: string
    ): string | undefined => {
      switch (alternative.kind) {
        case "string": {
          const tokens = tokensOf(alternative.value);
          if (tokens.length === 0) return '""';
          return tokens.find((token) => !supplied.has(token));
        }
        case "regex": {
          const pattern = new RegExp(alternative.pattern, alternative.flags);
          return [...supplied].some((token) => pattern.test(token))
            ? undefined
            : `/${alternative.pattern}/${alternative.flags}`;
        }
        case "array": {
          if (!alternative.complete) return spelling;
          for (const element of alternative.elements) {
            if (element === null) continue;
            const pinned = pinnedIn({ alternatives: evaluate(context, element), spelling }, supplied);
            if (pinned !== undefined) return pinned;
          }
          return undefined;
        }
        case "opaque":
          return alternative.node.type === "CallExpression" || alternative.node.type === "NewExpression"
            ? undefined
            : spelling;
        default:
          return spelling;
      }
    };

    /** The class an expected value pins: undefined only when every alternative qualifies. */
    const pinnedIn = (expected: Expected, supplied: ReadonlySet<string>): string | undefined => {
      const pins = (alternative: Alt): string | undefined =>
        pinnedBy(alternative, supplied, expected.spelling);
      if (allQualify(expected.alternatives, (alternative) => pins(alternative) === undefined))
        return undefined;
      // The report names the first alternative's pin; an unknown alternative pins its spelling.
      return expected.alternatives.map(pins).find((pin) => pin !== undefined) ?? expected.spelling;
    };

    return {
      CallExpression(node) {
        const assertion = assertionOf(context, node);
        if (assertion === undefined || assertion.actuals.length === 0) return;
        const { matcher, expected } = assertion;
        const [first, second] = expected;
        if (matcher === "toHaveClass") {
          // A trailing options object (`{ exact: true }`) configures the matcher; it names no class.
          const classes = expected.filter(
            (argument) => !allQualify(evaluate(context, argument), (option) => option.kind === "object")
          );
          pending.push({ node, expected: classes.map(expectedOf) });
          return;
        }
        if (matcher === "toHaveAttribute" && first !== undefined && namesClass(first)) {
          pending.push({ node, expected: second === undefined ? [] : [expectedOf(second)] });
          return;
        }
        for (const actual of assertion.actuals) {
          const actuals = evaluate(context, actual);
          const asked = actuals.flatMap(membershipOf);
          if (asked.length > 0) pending.push({ node, expected: asked.map(expectedOf) });
          else if (first !== undefined && anyViolates(actuals, (value) => readsClasses(value))) {
            pending.push({ node, expected: [expectedOf(first)] });
          }
        }
      },
      "Program:exit"() {
        for (const { node, expected } of pending) {
          // The exemption must hold in every run of the assertion's test, each with its own hooks.
          for (const roots of evidenceSets(context, node)) {
            const supplied = suppliedBy(roots);
            const pinned = expected
              .map((entry) => pinnedIn(entry, supplied))
              .find((pin) => pin !== undefined);
            if (pinned === undefined) continue;
            context.report({ node, messageId: "pinned", data: { token: pinned } });
            break;
          }
        }
      },
    };
  },
};
