import type { Context, ESTree, Rule } from "@oxlint/plugins";

import { descendants, isFunction, isPromiseCallback, unwrap } from "../ast-walk.ts";
import { clockTracker } from "../fake-clock.ts";
import { allQualify, anyViolates } from "../quantify.ts";
import { calleeNames, evaluate, targetOf } from "../resolve.ts";
import type { Alt, CalleeTarget } from "../resolve.ts";

/** The global callback timers. */
const GLOBAL_TIMERS = new Set(["setTimeout"]);

/** The modules that export the callback timers, which a fake clock does not patch once imported. */
const TIMER_MODULES = new Set(["node:timers", "timers"]);

/** The promise timer modules, whose `setTimeout(ms)` and `scheduler.wait(ms)` take the delay first. */
const PROMISE_TIMER_MODULES = new Set(["node:timers/promises", "timers/promises"]);

/** The promise timers, by their name off the module. */
const PROMISE_TIMERS = new Set(["setTimeout", "scheduler.wait"]);

/** The helpers whose first argument is how long to wait, wherever they come from. */
const WAIT_HELPERS = new Set(["sleep", "delay"]);

/** The Playwright page method that waits a fixed time. */
const PAGE_WAIT = "waitForTimeout";

/** The test entries that run an Effect on the live clock, where `Effect.sleep` really waits. */
const LIVE_TESTS = /(?:^|\.)(?:live|scopedLive)$/u;

/** The assignment operators that step a counter. */
const STEPS = new Set(["+=", "-="]);

/**
 * The kinds of wait: a global callback timer and a `sleep`-style helper run on the global timers,
 * which a fake clock can take over; the others always wait for real.
 */
type WaitKind = "global" | "imported-timer" | "promise" | "helper" | "effect" | "page";

/** A delayed call: its delay argument, or `null` for one that waits no delay, and its kind. */
type Wait = { readonly delay: ESTree.Node | null; readonly kind: WaitKind };

/** The names a loop steps as counters: `i++`, `--i`, `i += 1`, `i -= 1`, anywhere in the loop. */
function countersOf(context: Context, loop: ESTree.Node): ReadonlySet<string> {
  const counters = new Set<string>();
  for (const node of descendants(context, loop, "this-function")) {
    const target =
      node.type === "UpdateExpression"
        ? node.argument
        : node.type === "AssignmentExpression" && STEPS.has(node.operator)
          ? node.left
          : undefined;
    if (target?.type === "Identifier") counters.add(target.name);
  }
  return counters;
}

/** Whether an expression mentions a stepped counter. */
function mentionsCounter(context: Context, node: ESTree.Node, counters: ReadonlySet<string>): boolean {
  return descendants(context, node, "this-function").some(
    (inner) => inner.type === "UpdateExpression" || (inner.type === "Identifier" && counters.has(inner.name))
  );
}

/**
 * Whether a loop or `if` test checks a condition other than a counter. A counter test steps or
 * compares a stepped counter (`i++ < 3`, `i--`, `attempt < MAX`); a condition reads state
 * (`!done`, `status !== "ready"`, `alive(pid)`); `true` checks nothing.
 */
function checksCondition(context: Context, test: ESTree.Node | null, counters: ReadonlySet<string>): boolean {
  if (test === null) return false;
  const expression = unwrap(test);
  switch (expression.type) {
    case "Literal":
      return false;
    case "LogicalExpression":
      return (
        checksCondition(context, expression.left, counters) ||
        checksCondition(context, expression.right, counters)
      );
    case "UpdateExpression":
      return false;
    case "Identifier":
      return !counters.has(expression.name);
    case "BinaryExpression":
      return !mentionsCounter(context, expression, counters);
    default:
      return true;
  }
}

/** Whether a loop body leaves early on a checked condition: a `break` or `return` under such an `if`. */
function exitsOnCondition(
  context: Context,
  loop: ESTree.Node,
  body: ESTree.Node,
  counters: ReadonlySet<string>
): boolean {
  return descendants(context, body, "this-function").some((node) => {
    if (node.type !== "ReturnStatement" && !(node.type === "BreakStatement" && node.label === null))
      return false;
    for (
      let parent: ESTree.Node | null = node.parent;
      parent !== null && parent !== loop;
      parent = parent.parent
    ) {
      if (parent.type === "IfStatement" && checksCondition(context, parent.test, counters)) return true;
    }
    return false;
  });
}

/**
 * Whether a node runs inside a polling loop: one whose test checks a condition other than a counter,
 * or one that leaves early on such a check. A counted loop or a loop over items is not a poll. A
 * `new Promise` executor between the node and the loop runs in the same turn, so it does not end
 * the search.
 */
function isInPollingLoop(context: Context, node: ESTree.Node): boolean {
  for (let parent = node.parent; parent !== null; parent = parent.parent) {
    switch (parent.type) {
      case "WhileStatement":
      case "DoWhileStatement":
      case "ForStatement": {
        const counters = countersOf(context, parent);
        return (
          checksCondition(context, parent.test, counters) ||
          exitsOnCondition(context, parent, parent.body, counters)
        );
      }
      case "ForOfStatement":
      case "ForInStatement":
        return exitsOnCondition(context, parent, parent.body, countersOf(context, parent));
      default:
        if (isFunction(parent) && !isPromiseCallback(parent)) return false;
    }
  }
  return false;
}

/**
 * No fixed delays: no global `setTimeout`, timer imported from `node:timers`, promise timer from
 * `node:timers/promises`, `sleep`, `delay`, `page.waitForTimeout` or live `Effect.sleep` waits a
 * delay that is not zero. A fixed delay guesses how long the machine takes, so it flakes under load
 * and slows every run. Allowed: a delay every value of which is 0 (one turn) or a caller's
 * parameter (forwarded); a wait inside a polling loop, whose test or early exit checks state rather
 * than a stepped counter; `Effect.sleep` on the test clock; and a global `setTimeout` or
 * `sleep`-style helper that a simulated clock faking `setTimeout` covers, as `fake-clock.ts` models
 * one, in the test, in a setup hook after the hook's own install, or in a helper that only covered
 * tests call, aliases included. A callee that may be a timer waits when any alternative does.
 *
 * Scope: follows what `resolve.ts` follows, for the timer and for the delay. Beyond that: a wait
 * helper with another name than `sleep` or `delay` is not recognised, and imported and promise
 * timers and `page.waitForTimeout` count as real waits under any fake clock, since Vitest's fake
 * timers patch only the globals.
 */
export const noFixedDelay: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid fixed-duration waits in tests." },
    messages: {
      delay:
        "A fixed delay guesses how long the machine takes, so it flakes under load. Wait on the condition (expect.poll, vi.waitFor, a Deferred) or drive a fake clock.",
    },
    schema: [],
  },
  create(context) {
    const clocks = clockTracker(context);
    const candidates: ESTree.CallExpression[] = [];

    /** Whether one delay alternative waits no time: the number 0, or a caller's parameter (forwarded). */
    const waitsNothing = (alternative: Alt): boolean =>
      (alternative.kind === "number" && alternative.value === 0) || alternative.kind === "parameter";

    /** Whether a delay is zero in every alternative. */
    const isZero = (delay: ESTree.Node): boolean => allQualify(evaluate(context, delay), waitsNothing);

    /** Whether a lone first argument is a delay: a number in any alternative. */
    const isDelay = (argument: ESTree.Node): boolean =>
      anyViolates(evaluate(context, argument), (alternative) => alternative.kind === "number");

    /** Whether a call runs inside an `it.live`-style test, whose Effects read the real clock. */
    const onLiveClock = (node: ESTree.Node): boolean => {
      for (let parent = node.parent; parent !== null; parent = parent.parent) {
        if (parent.type !== "CallExpression") continue;
        if (calleeNames(context, parent.callee).some((name) => LIVE_TESTS.test(name))) return true;
      }
      return false;
    };

    /** A callback timer's wait: its second argument, or a lone numeric first argument. */
    const callbackWait = (call: ESTree.CallExpression, kind: WaitKind): Wait => {
      const [first, second] = call.arguments;
      if (second !== undefined) return { delay: second, kind };
      return { delay: first !== undefined && isDelay(first) ? first : null, kind };
    };

    /** The wait one target makes, or `undefined` for a target that waits on no clock. */
    const waitOf = (call: ESTree.CallExpression, target: CalleeTarget): Wait | undefined => {
      const name = target.path.join(".");
      const [first] = call.arguments;
      if (target.module !== undefined && PROMISE_TIMER_MODULES.has(target.module)) {
        return PROMISE_TIMERS.has(name) ? { delay: first ?? null, kind: "promise" } : undefined;
      }
      if (target.module !== undefined && TIMER_MODULES.has(target.module)) {
        return name === "setTimeout" ? callbackWait(call, "imported-timer") : undefined;
      }
      if (target.module === undefined && GLOBAL_TIMERS.has(name)) return callbackWait(call, "global");
      if (target.path.length === 2 && target.path[1] === PAGE_WAIT)
        return { delay: first ?? null, kind: "page" };
      if (target.path.length === 1 && WAIT_HELPERS.has(name)) return { delay: first ?? null, kind: "helper" };
      if (name === "Effect.sleep" && onLiveClock(call)) return { delay: first ?? null, kind: "effect" };
      return undefined;
    };

    return {
      CallExpression(node) {
        clocks.visit(node);
        if (!isInPollingLoop(context, node)) candidates.push(node);
      },
      "Program:exit"() {
        for (const node of candidates) {
          // Each alternative the callee may name waits its own delay. A wait on the global timers is
          // exempt where a simulated clock faking `setTimeout` covers it; any other wait is real.
          const waitsForReal = (callee: Alt): boolean => {
            const target = targetOf(callee);
            const wait = target === undefined ? undefined : waitOf(node, target);
            if (wait?.delay === undefined || wait.delay === null || isZero(wait.delay)) return false;
            const fakeable = wait.kind === "global" || wait.kind === "helper";
            return !fakeable || !clocks.covers(node, "setTimeout");
          };
          if (anyViolates(evaluate(context, node.callee), waitsForReal))
            context.report({ node, messageId: "delay" });
        }
      },
    };
  },
};
