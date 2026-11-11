import type { Context, ESTree, Rule } from "@oxlint/plugins";

import { descendants, isFunction, isPromiseCallback, unwrap } from "../ast-walk.ts";
import { isSimulated } from "../fake-clock.ts";
import { anyViolates } from "../quantify.ts";
import { calleeNames, evaluate, targetOf } from "../resolve.ts";
import type { CalleeTarget } from "../resolve.ts";

/** The modules that export the callback timers, which a fake clock does not patch once imported. */
const TIMER_MODULES = new Set(["node:timers", "timers"]);

/** The promise timer modules, whose `setTimeout(ms)` and `scheduler.wait(ms)` take the delay first. */
const PROMISE_TIMER_MODULES = new Set(["node:timers/promises", "timers/promises"]);

/** The promise timers, by their name off the module. */
const PROMISE_TIMERS = new Set(["setTimeout", "scheduler.wait"]);

/** The helpers whose first argument is how long to wait on the global timers, wherever they come from. */
const WAIT_HELPERS = new Set(["sleep", "delay"]);

/**
 * The helpers whose first argument is how long to wait for real under any fake timers: the repo's
 * `wait(ms)` (`packages/fuse/test/animation-frames.ts`) spins on animation frames and
 * `performance.now()`, which `useFakeTimeouts()` leaves alone.
 */
const REAL_WAIT_HELPERS = new Set(["wait"]);

/** The Playwright page method that waits a fixed time. */
const PAGE_WAIT = "waitForTimeout";

/** The test entries that run an Effect on the live clock, where `Effect.sleep` really waits. */
const LIVE_TESTS = /(?:^|\.)(?:live|scopedLive)$/u;

/** The assignment operators that step a counter. */
const STEPS = new Set(["+=", "-="]);

/**
 * A delayed call: its delay argument, `undefined` for one that waits no delay, and whether a fake
 * clock can take it over. A global callback timer and a `sleep`-style helper run on the global
 * timers, which a fake clock faking `setTimeout` takes over; every other wait is real.
 */
type Wait = { readonly delay: ESTree.Node | undefined; readonly fakeable: boolean };

/** A wait a local function hands a parameter to: the parameter's index, and whether the wait is fakeable. */
type Forward = { readonly index: number; readonly fakeable: boolean };

/**
 * Each local function's forwarded parameters, which depend on its file's syntax alone, except that
 * the second helper reached in a mutually recursive pair may cache a shorter list.
 */
const FORWARDS = new WeakMap<ESTree.Node, ReadonlyArray<Forward>>();

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
 * `node:timers/promises`, `sleep`, `delay`, `wait`, `page.waitForTimeout` or live `Effect.sleep`
 * waits a delay that is not zero. A fixed delay guesses how long the machine takes, so it flakes
 * under load and slows every run. A wait wrapped in a local helper is the wait its callers ask
 * for: a delay that is the helper's parameter, passed on unchanged through any chain of helpers, is
 * judged and reported at each call that sets it (its argument, or else the parameter's default),
 * never at the timer, so a disable names the one wait it allows. A delay a helper writes itself is
 * reported at the timer that writes it. Allowed: a delay every value of which is 0 (one turn), or
 * a parameter no call sets; a wait inside a polling loop, whose test or early exit checks state
 * rather than a stepped counter; `Effect.sleep` on the test clock; and a global `setTimeout` or
 * `sleep`-style helper that a simulated clock faking `setTimeout` covers, as `fake-clock.ts` models
 * one, at the call that sets the delay: in the test, in a setup hook after the hook's own install,
 * or in a helper or component that only covered tests call or render, aliases included. A callee
 * that may be a timer waits when any alternative does.
 *
 * Scope: follows what `resolve.ts` follows, for the timer and for the delay. Beyond that: an
 * imported wait helper with another name than `sleep`, `delay` or `wait` is not recognised; a local
 * helper is a wait only through a recognised wait it hands its parameter to, so one that waits
 * another way (spinning on `performance.now()`) is not; and imported and promise timers, `wait` and
 * `page.waitForTimeout` count as real waits under any fake clock, since Vitest's fake timers patch
 * only the globals.
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
    /** Whether a lone first argument is a delay: a number in any alternative. */
    const isDelay = (argument: ESTree.Node): boolean =>
      evaluate(context, argument).some((alternative) => alternative.kind === "number");

    /** Whether a call runs inside an `it.live`-style test, whose Effects read the real clock. */
    const onLiveClock = (node: ESTree.Node): boolean => {
      for (let parent = node.parent; parent !== null; parent = parent.parent) {
        if (parent.type !== "CallExpression") continue;
        if (calleeNames(context, parent.callee).some((name) => LIVE_TESTS.test(name))) return true;
      }
      return false;
    };

    /** A callback timer's wait: its second argument, or a lone numeric first argument. */
    const callbackWait = (call: ESTree.CallExpression, fakeable: boolean): Wait => {
      const [first, second] = call.arguments;
      if (second !== undefined) return { delay: second, fakeable };
      return { delay: first !== undefined && isDelay(first) ? first : undefined, fakeable };
    };

    /** The wait one target makes, or `undefined` for a target that waits on no clock. */
    const waitOf = (call: ESTree.CallExpression, target: CalleeTarget): Wait | undefined => {
      const name = target.path.join(".");
      const [first] = call.arguments;
      if (target.module !== undefined && PROMISE_TIMER_MODULES.has(target.module)) {
        return PROMISE_TIMERS.has(name) ? { delay: first, fakeable: false } : undefined;
      }
      if (target.module !== undefined && TIMER_MODULES.has(target.module)) {
        return name === "setTimeout" ? callbackWait(call, false) : undefined;
      }
      if (target.module === undefined && name === "setTimeout") return callbackWait(call, true);
      if (target.path.length === 2 && target.path[1] === PAGE_WAIT) return { delay: first, fakeable: false };
      if (target.path.length === 1 && WAIT_HELPERS.has(name)) return { delay: first, fakeable: true };
      if (target.path.length === 1 && REAL_WAIT_HELPERS.has(name)) return { delay: first, fakeable: false };
      if (name === "Effect.sleep" && onLiveClock(call)) return { delay: first, fakeable: false };
      return undefined;
    };

    /** The expression a call sets a parameter to: its argument, or else the parameter's default. */
    const argumentFor = (
      call: ESTree.CallExpression,
      fn: ESTree.Node,
      index: number
    ): ESTree.Node | undefined => {
      const argument = call.arguments[index];
      if (argument !== undefined) return argument;
      const param = isFunction(fn) ? fn.params[index] : undefined;
      return param?.type === "AssignmentPattern" ? param.right : undefined;
    };

    /**
     * The waits one call makes: each callee alternative's own wait, or, for a local function, the
     * waits its body hands its parameters to, with the delays this call sets them to.
     */
    const waitsOf = (call: ESTree.CallExpression): Wait[] =>
      evaluate(context, call.callee).flatMap((callee): Wait[] => {
        if (callee.kind === "function") {
          return forwardsOf(callee.fn).map(({ index, fakeable }) => ({
            delay: argumentFor(call, callee.fn, index),
            fakeable,
          }));
        }
        const target = targetOf(callee);
        const wait = target === undefined ? undefined : waitOf(call, target);
        return wait === undefined ? [] : [wait];
      });

    /**
     * The parameters a local function hands unchanged to a wait outside a polling loop, through
     * any chain of local helpers, computed once per function. A recursive call reads the entry
     * in progress, so a helper forwards nothing through calling itself.
     */
    const forwardsOf = (fn: ESTree.Node): ReadonlyArray<Forward> => {
      const cached = FORWARDS.get(fn);
      if (cached !== undefined) return cached;
      FORWARDS.set(fn, []);
      const forwards = descendants(context, fn, "into-functions").flatMap((node): Forward[] =>
        node.type !== "CallExpression" || isInPollingLoop(context, node)
          ? []
          : waitsOf(node).flatMap(({ delay, fakeable }) =>
              delay === undefined
                ? []
                : evaluate(context, delay).flatMap((alternative) =>
                    alternative.kind === "parameter" && alternative.fn === fn
                      ? [{ index: alternative.index, fakeable }]
                      : []
                  )
            )
      );
      FORWARDS.set(fn, forwards);
      return forwards;
    };

    /**
     * Whether a wait's delay waits real time at the call that sets it: an alternative that is
     * neither 0, nor a parameter (which the function's call sites set and answer for), nor, for a
     * fakeable wait, covered by a simulated clock at the call.
     */
    const waitsForReal = (call: ESTree.CallExpression, { delay, fakeable }: Wait): boolean =>
      delay !== undefined &&
      anyViolates(evaluate(context, delay), (alternative) => {
        if (alternative.kind === "parameter") return false;
        if (alternative.kind === "number" && alternative.value === 0) return false;
        return !fakeable || !isSimulated(context, call, "setTimeout");
      });

    return {
      CallExpression(node) {
        if (anyViolates(waitsOf(node), (wait) => waitsForReal(node, wait)) && !isInPollingLoop(context, node))
          context.report({ node, messageId: "delay" });
      },
    };
  },
};
