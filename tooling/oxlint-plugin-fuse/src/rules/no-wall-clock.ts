import type { ESTree, Rule } from "@oxlint/plugins";

import { clockTracker, realmOf } from "../fake-clock.ts";
import type { ClockApi } from "../fake-clock.ts";
import { anyViolates } from "../quantify.ts";
import { calleeNames, evaluate } from "../resolve.ts";
import type { Alt } from "../resolve.ts";
import { assertionOf } from "../test-context.ts";

/** The calls that read the wall clock, by their resolved name, with the clock API each reads. */
const CLOCK_READS = new Map<string, ClockApi>([
  ["performance.now", "performance"],
  ["Date.now", "Date"],
  ["process.hrtime", "hrtime"],
  ["process.hrtime.bigint", "hrtime"],
]);

/**
 * No timing assertions: a value that may be a wall-clock capture is neither subtracted nor
 * asserted, unless a simulated clock that fakes that API covers the capture, as `fake-clock.ts`
 * models one: `vi.useFakeTimers()` with its effective `toFake`, the repo's `useFakeTimeouts()`
 * (timers only) or `vi.useRealTimers()` for the test's own clock, and Playwright's `page.clock`
 * for captures inside a page `evaluate` callback. Time is captured by `Date.now()`,
 * `performance.now()`, `process.hrtime()` and `new Date()`, and `date.getTime()` reads the time its
 * date captured at construction. A budget measured on the machine running the test flakes under
 * load and proves nothing a user sees. Reading the clock for a unique name or to seed a fake clock
 * stays allowed.
 *
 * Scope: follows what `resolve.ts` follows, for the capture and every callee, and judges coverage
 * as `fake-clock.ts` does. Beyond that: a clock change inside a nested function, or at module or
 * `describe` level outside a hook, does not count, and `page.clock` never covers the test's own
 * clock.
 */
export const noWallClock: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid elapsed-time measurements and wall-clock assertions in tests." },
    messages: {
      budget:
        "This measures elapsed wall-clock time, which flakes under load. Assert the outcome instead; for time-dependent logic, drive a fake clock (vi.useFakeTimers, TestClock, page.clock).",
    },
    schema: [],
  },
  create(context) {
    const clocks = clockTracker(context);
    /** A clock capture: where the time is taken (which decides its coverage) and the API it reads. */
    type Capture = { readonly at: ESTree.Node; readonly api: ClockApi };
    const candidates: Array<{ readonly node: ESTree.Node; readonly values: ReadonlyArray<Alt> }> = [];

    /** Where an alternative that is `new Date()` with no argument captures the time: its construction. */
    const constructedNow = (alternative: Alt): ESTree.Node | undefined =>
      alternative.kind === "opaque" &&
      alternative.node.type === "NewExpression" &&
      alternative.node.arguments.length === 0 &&
      calleeNames(context, alternative.node.callee).includes("Date")
        ? alternative.node
        : undefined;

    /**
     * Where one alternative captures the time: a clock call (`Date.now()`, `performance.now()`,
     * `process.hrtime()`) where it is called, `new Date()` where it is constructed, and
     * `date.getTime()` or `date.valueOf()` where its date was constructed.
     */
    const capturesOf = (alternative: Alt): Capture[] => {
      const constructed = constructedNow(alternative);
      if (constructed !== undefined) return [{ at: constructed, api: "Date" }];
      if (alternative.kind !== "opaque" || alternative.node.type !== "CallExpression") return [];
      const call = alternative.node;
      const reads = calleeNames(context, call.callee).flatMap((name) => {
        const api = CLOCK_READS.get(name);
        return api === undefined ? [] : [{ at: call, api }];
      });
      const snapshots = evaluate(context, call.callee).flatMap((callee): Capture[] => {
        if (callee.kind !== "member" || (callee.key !== "getTime" && callee.key !== "valueOf")) return [];
        const at = constructedNow(callee.object);
        return at === undefined ? [] : [{ at, api: "Date" }];
      });
      return [...reads, ...snapshots];
    };

    /** Whether one alternative captures the time where no simulated clock covers it. */
    const onWallClock = (alternative: Alt): boolean =>
      capturesOf(alternative).some(({ at, api }) => !clocks.covers(at, api, realmOf(context, at)));

    return {
      BinaryExpression(node) {
        if (node.operator !== "-") return;
        // Each operand is its own value, judged on its own.
        candidates.push(
          { node, values: evaluate(context, node.left) },
          { node, values: evaluate(context, node.right) }
        );
      },
      CallExpression(node) {
        clocks.visit(node);
        for (const actual of assertionOf(context, node)?.actuals ?? []) {
          candidates.push({ node, values: evaluate(context, actual) });
        }
      },
      "Program:exit"() {
        const reported = new Set<ESTree.Node>();
        for (const { node, values } of candidates) {
          if (reported.has(node) || !anyViolates(values, onWallClock)) continue;
          reported.add(node);
          context.report({ node, messageId: "budget" });
        }
      },
    };
  },
};
