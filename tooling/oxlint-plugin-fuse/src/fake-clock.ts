import type { Context, ESTree } from "@oxlint/plugins";

import { isFunction, isPromiseCallback } from "./ast-walk.ts";
import { calleeTargets, entryFor, evaluate } from "./resolve.ts";
import type { Alt, CalleeTarget } from "./resolve.ts";
import {
  callSitesOf,
  executionsOf,
  owningBody,
  pageCallSitesOf,
  positionIn,
  runsInPage,
  sharedName,
} from "./test-context.ts";
import type { Certainty } from "./test-context.ts";

/**
 * Simulated-clock tracking for the test-file rules.
 *
 * The model: every clock install or restore is an event that is `guaranteed` or `possible`. It is
 * `guaranteed` when every alternative of its callee is the same API, its call sits in its body
 * with no branch between them (`test-context.ts`'s `positionIn`), and, for an event in a setup
 * hook, the hook's registration is `guaranteed` too; anything else is `possible`. A call inside a
 * nested function of a body is no event of that body.
 *
 * Coverage is judged where time is captured: a clock read (`Date.now()`, `performance.now()`,
 * `process.hrtime()`, `new Date()` construction, and `date.getTime()` at its date's construction)
 * or a wait. For every way the body around it runs (`executionsOf`), coverage folds from empty over
 * the events of the setup hooks that run first, then the body's own events before that point: a
 * `guaranteed` event replaces coverage with the APIs it fakes, and a `possible` one intersects it.
 * The capture is covered only when every run covers it. A capture in a helper is judged at every
 * call site, and in a page `evaluate` callback at every `evaluate` call.
 *
 * The host (the test's own `Date`, timers and `performance`) and the page (code inside a page
 * `evaluate` callback) have separate clocks: `vi` changes the host's, `page.clock` the page's.
 */

/** A clock API a test can fake: one scheduling or reading API each. */
export type ClockApi = "setTimeout" | "setInterval" | "setImmediate" | "Date" | "performance" | "hrtime";

/** Where a clock read or wait runs: the test process, or a page `evaluate` callback. */
export type ClockRealm = "host" | "page";

/** The `toFake` names that schedule or read time, by the API each fakes. `clear*` fakes nothing. */
const FAKEABLE = new Map<string, ClockApi>([
  ["setTimeout", "setTimeout"],
  ["setInterval", "setInterval"],
  ["setImmediate", "setImmediate"],
  ["Date", "Date"],
  ["performance", "performance"],
  ["hrtime", "hrtime"],
]);

/** What `vi.useFakeTimers()` fakes with no `toFake`: Vitest's default, every API here. */
const ALL_APIS: ReadonlySet<ClockApi> = new Set(FAKEABLE.values());

/** What Playwright's `clock.install()` and `pauseAt()` take over in the page. */
const PAGE_CLOCK_APIS: ReadonlySet<ClockApi> = new Set(["setTimeout", "setInterval", "Date", "performance"]);

/** One clock change: the realm it changes, the APIs it leaves faked, and the API that makes it. */
type Change = { readonly realm: ClockRealm; readonly faked: ReadonlySet<ClockApi>; readonly api: string };

/** One clock event in one realm: its call, the APIs it surely leaves faked, and whether its callee is one API. */
type ClockEvent = {
  readonly call: ESTree.CallExpression;
  readonly realm: ClockRealm;
  readonly faked: ReadonlySet<ClockApi>;
  readonly sameApi: boolean;
};

/** Tracks the clock changes of one file and answers whether a capture's time is simulated. */
export type ClockTracker = {
  /** Record the clock change a call makes, if any. Feed it every call in the file. */
  readonly visit: (call: ESTree.CallExpression) => void;
  /**
   * Whether a capture runs under a simulated clock for an API in a realm (by default, the node's
   * own), asked at `Program:exit`.
   */
  readonly covers: (capture: ESTree.Node, api: ClockApi, realm?: ClockRealm) => boolean;
};

/**
 * Where a node runs: inside a function the file hands to a page `evaluate` call (inline or through
 * a binding) it runs in the page; anywhere else, in the test process.
 *
 * @param context - The rule context.
 * @param node - Any AST node.
 * @returns The realm.
 */
export function realmOf(context: Context, node: ESTree.Node): ClockRealm {
  return runsInPage(context, node) ? "page" : "host";
}

/** Every element of every set, kept only where all sets have it. */
function intersect(sets: ReadonlyArray<ReadonlySet<ClockApi>>): ReadonlySet<ClockApi> {
  const [first, ...rest] = sets;
  if (first === undefined) return new Set();
  return new Set([...first].filter((api) => rest.every((set) => set.has(api))));
}

/**
 * The APIs one `toFake` list alternative surely fakes: each element of its known prefix whose
 * every alternative is the same fakeable name.
 */
function fakedByList(context: Context, list: Alt): ReadonlySet<ClockApi> {
  if (list.kind !== "array") return new Set();
  return new Set(
    list.elements.flatMap((element) => {
      if (element === null) return [];
      const names = evaluate(context, element).map((name) =>
        name.kind === "string" ? name.value : undefined
      );
      const api = FAKEABLE.get(sharedName(names) ?? "");
      return api === undefined ? [] : [api];
    })
  );
}

/**
 * The APIs a `vi.useFakeTimers(options)` call surely fakes, intersected over every alternative of
 * the options and of their effective `toFake` list: every API when an alternative sets none, and
 * nothing for an alternative the evaluator cannot open.
 */
function fakedBy(context: Context, call: ESTree.CallExpression): ReadonlySet<ClockApi> {
  const [options] = call.arguments;
  if (options === undefined) return ALL_APIS;
  return intersect(
    evaluate(context, options).map((alternative) => {
      if (alternative.kind === "undefined") return ALL_APIS;
      const entry = entryFor(alternative, "toFake");
      if (entry === undefined) return ALL_APIS;
      if (entry === "unknown" || entry._tag !== "property") return new Set<ClockApi>();
      return intersect(evaluate(context, entry.value).map((list) => fakedByList(context, list)));
    })
  );
}

/**
 * The clock change one callee alternative makes: `vi.useFakeTimers()` fakes its `toFake` list or
 * every API; the repo's `useFakeTimeouts()` fakes `setTimeout` only, as
 * `packages/fuse/test/animation-frames.ts` does; `vi.useRealTimers()` fakes nothing; Playwright's
 * `clock.install()` and `pauseAt()` fake the page's timers, `Date` and `performance`, and
 * `setFixedTime()` the page's `Date`.
 */
function changeOf(
  context: Context,
  call: ESTree.CallExpression,
  target: CalleeTarget | undefined
): Change | undefined {
  if (target === undefined) return undefined;
  const api = target.path.join(".");
  const pageClock = target.path.at(-2) === "clock" ? target.path.at(-1) : undefined;
  if (api === "vi.useFakeTimers") return { realm: "host", faked: fakedBy(context, call), api };
  if (api === "useFakeTimeouts") return { realm: "host", faked: new Set(["setTimeout"]), api };
  if (api === "vi.useRealTimers") return { realm: "host", faked: new Set(), api };
  if (pageClock === "install" || pageClock === "pauseAt")
    return { realm: "page", faked: PAGE_CLOCK_APIS, api: `clock.${pageClock}` };
  if (pageClock === "setFixedTime")
    return { realm: "page", faked: new Set(["Date"]), api: "clock.setFixedTime" };
  return undefined;
}

/**
 * The events a call makes, one per realm any of its callee's alternatives changes. The faked set
 * is what every changing alternative leaves faked; an alternative that changes nothing leaves the
 * coverage as it was, which the `possible` fold accounts for.
 */
function clockEventsOf(context: Context, call: ESTree.CallExpression): ClockEvent[] {
  const changes = calleeTargets(context, call.callee).map((target) => changeOf(context, call, target));
  const sameApi = sharedName(changes.map((change) => change?.api)) !== undefined;
  return (["host", "page"] as const).flatMap((realm) => {
    const made = changes.flatMap((change) => (change?.realm === realm ? [change.faked] : []));
    return made.length === 0 ? [] : [{ call, realm, faked: intersect(made), sameApi }];
  });
}

/** Fold events over a coverage: a guaranteed event replaces it, a possible one intersects it. */
function fold(
  coverage: ReadonlySet<ClockApi>,
  events: ReadonlyArray<{ readonly faked: ReadonlySet<ClockApi>; readonly certainty: Certainty }>
): ReadonlySet<ClockApi> {
  return events.reduce<ReadonlySet<ClockApi>>(
    (before, event) => (event.certainty === "guaranteed" ? event.faked : intersect([before, event.faked])),
    coverage
  );
}

/**
 * A tracker for one file's simulated clocks.
 *
 * @param context - The rule context.
 * @returns The tracker.
 */
export function clockTracker(context: Context): ClockTracker {
  const events: ClockEvent[] = [];

  /** A body's events in a realm, before a point, in source order, each with its certainty. */
  const eventsIn = (body: ESTree.Node, realm: ClockRealm, before: number, registered: Certainty) =>
    events
      .filter((event) => event.realm === realm && event.call.start < before)
      .flatMap((event) => {
        const position = positionIn(event.call, body);
        if (position === undefined) return [];
        const certainty: Certainty =
          event.sameApi && position === "guaranteed" && registered === "guaranteed"
            ? "guaranteed"
            : "possible";
        return [{ faked: event.faked, certainty, start: event.call.start }];
      })
      .toSorted((left, right) => left.start - right.start);

  /** The function a capture's time is judged in: a test or hook body, a page callback, or a named helper. */
  const judgeOf = (node: ESTree.Node): ESTree.Node | undefined => {
    const body = owningBody(context, node);
    for (let parent = node.parent; parent !== null && parent !== body; parent = parent.parent) {
      if (!isFunction(parent) || isPromiseCallback(parent)) continue;
      if (pageCallSitesOf(context, parent).length > 0 || callSitesOf(context, parent).length > 0)
        return parent;
    }
    return body;
  };

  const covers = (
    node: ESTree.Node,
    api: ClockApi,
    realm: ClockRealm,
    path: ReadonlySet<ESTree.Node>
  ): boolean => {
    const judge = judgeOf(node);
    if (judge === undefined || path.has(judge)) return false;
    const inner = new Set([...path, judge]);
    const executions = executionsOf(context, judge);
    if (executions.length > 0) {
      return executions.every((execution) => {
        const fromHooks = execution.before.flatMap((hook) =>
          eventsIn(hook.fn, realm, Number.POSITIVE_INFINITY, hook.certainty)
        );
        const fromBody = eventsIn(judge, realm, node.start, "guaranteed");
        return fold(new Set(), [...fromHooks, ...fromBody]).has(api);
      });
    }
    // A page callback runs where an `evaluate` call hands it over; a helper, where it is called.
    const handedOver = pageCallSitesOf(context, judge);
    const sites = handedOver.length > 0 ? handedOver : callSitesOf(context, judge);
    return sites.length > 0 && sites.every((site) => covers(site, api, realm, inner));
  };

  return {
    visit(call) {
      events.push(...clockEventsOf(context, call));
    },
    covers: (node, api, realm = realmOf(context, node)) => covers(node, api, realm, new Set()),
  };
}
