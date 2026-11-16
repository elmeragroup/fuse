// Unit under test: the tour session's transitions. Oracles: the plan's Persistence rules (only
// Done on the shown last step, Skip, Close and Escape write a status; an outside press and an error
// snooze; running out of steps and a sync write nothing), its SSR rule (a finished initial record
// answers its status before storage does), and the reference rule (a transition keeps every object
// it did not change).
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { defineTour } from "./tour-definition";
import type { TourDefinition } from "./tour-definition";
import {
  bumpTourContent,
  dismissTour,
  endTour,
  failTourStorage,
  initialTourSession,
  nextTourStep,
  pickAutoStartTour,
  previousTourStep,
  receiveTourRecords,
  showPendingStep,
  skipPendingStep,
  startTour,
  tourAutoStartRefusal,
  tourStateOf,
} from "./tour-session";
import type { TourEndReason, TourOrigin, TourSessionState, TourTransition } from "./tour-session";

const welcome = defineTour({ id: "welcome", version: 2, steps: ["intro", "usage", "price"] });
const billing = defineTour({ id: "billing", steps: ["invoices"] });

function ready(state: TourSessionState = initialTourSession()): TourSessionState {
  return receiveTourRecords(state, {}).state;
}

function started(
  state: TourSessionState,
  definition: TourDefinition,
  origin: TourOrigin = "user",
  at?: string
): TourSessionState {
  const options = at === undefined ? { origin } : { origin, at };
  const outcome = startTour(state, definition, options);
  if (outcome._tag !== "started") {
    throw new Error(`expected a start, got ${outcome.reason}`);
  }
  return outcome.state;
}

function shownAt(definition: TourDefinition, at: string, now = 10): TourSessionState {
  return showPendingStep(started(ready(), definition, "user", at), definition, now).state;
}

describe("ending a run", () => {
  const cases: readonly {
    readonly reason: TourEndReason;
    readonly state: ReturnType<typeof tourStateOf>;
  }[] = [
    { reason: "completed", state: "completed" },
    { reason: "skip-press", state: "dismissed" },
    { reason: "close-press", state: "dismissed" },
    { reason: "escape-key", state: "dismissed" },
    { reason: "outside-press", state: "snoozed" },
    { reason: "error", state: "snoozed" },
    { reason: "no-targets", state: "idle" },
    { reason: "synced", state: "idle" },
  ];

  it.each(cases)("leaves the tour $state after $reason", ({ reason, state }) => {
    const ended = endTour(shownAt(welcome, "usage"), welcome, reason, 99);
    expect(ended.ended).toEqual({
      tourId: "welcome",
      stepId: "usage",
      reason,
      status: state === "completed" || state === "dismissed" ? state : null,
    });
    expect(tourStateOf(ended.state, "welcome")).toBe(state);
    expect(ended.state.shown).toBeNull();
    if (state === "completed" || state === "dismissed") {
      expect(ended.changed).toEqual({
        tourId: "welcome",
        record: { v: 2, step: "usage", status: state, at: 99 },
      });
    } else {
      expect(ended.changed).toBeNull();
      expect(ended.state.records.welcome).toEqual({ v: 2, step: "usage", at: 10 });
    }
  });

  it("completes only from Done on the shown last step", () => {
    const last = shownAt(welcome, "price");
    const done = nextTourStep(last, welcome, 50);
    expect(done.ended?.reason).toBe("completed");
    expect(tourStateOf(done.state, "welcome")).toBe("completed");

    const middle = nextTourStep(shownAt(welcome, "usage"), welcome, 50);
    expect(middle.ended).toBeNull();
    expect(middle.state.pending?.stepId).toBe("price");
  });

  it("ends as no-targets with no status when the remaining steps have no element", () => {
    let transition: TourTransition = nextTourStep(shownAt(welcome, "intro"), welcome, 20);
    expect(transition.state.pending?.stepId).toBe("usage");
    transition = skipPendingStep(transition.state, welcome, 30);
    expect(transition.state.pending?.stepId).toBe("price");
    expect(transition.state.shown?.stepId).toBe("intro");
    transition = skipPendingStep(transition.state, welcome, 40);
    expect(transition.ended?.reason).toBe("no-targets");
    expect(transition.changed).toBeNull();
    expect(tourStateOf(transition.state, "welcome")).toBe("idle");
  });

  it("keeps the shown step when moving back finds no earlier element", () => {
    const back = previousTourStep(shownAt(welcome, "usage"), welcome);
    expect(back.state.pending?.stepId).toBe("intro");
    const stayed = skipPendingStep(back.state, welcome, 30);
    expect(stayed.ended).toBeNull();
    expect(stayed.state.pending).toBeNull();
    expect(stayed.state.shown).toBe(back.state.shown);
  });

  it("ignores Prev on the first step and Next while a step is resolving", () => {
    const first = shownAt(welcome, "intro");
    expect(previousTourStep(first, welcome).state).toBe(first);
    const resolving = nextTourStep(first, welcome, 20).state;
    expect(nextTourStep(resolving, welcome, 21).state).toBe(resolving);
  });
});

describe("dismissing a tour", () => {
  it("writes the dismissed status with no run, ends a running one as skip-press, and keeps a finished status", () => {
    const idle = dismissTour(ready(), welcome, 7);
    expect(idle.changed).toEqual({ tourId: "welcome", record: { v: 2, status: "dismissed", at: 7 } });
    expect(dismissTour(shownAt(welcome, "usage"), welcome, 8).ended?.reason).toBe("skip-press");
    expect(dismissTour(idle.state, welcome, 9).state).toBe(idle.state);
  });
});

describe("starting a run", () => {
  it("answers a finished initial record's status before storage answers, and unknown otherwise", () => {
    const initial = initialTourSession({ welcome: { status: "dismissed", v: 1, at: 1 } });
    expect(tourStateOf(initial, "welcome")).toBe("dismissed");
    expect(tourStateOf(initial, "billing")).toBe("unknown");
    expect(tourAutoStartRefusal(initial, welcome, 5, 0)).toBe("finished");
    expect(tourAutoStartRefusal(initial, billing, 5, 0)).toBe("not-ready");
  });

  it("lets a user replay a finished tour and keeps it finished", () => {
    const finished = ready(initialTourSession({ welcome: { status: "completed", v: 2, at: 1 } }));
    const replay = showPendingStep(started(finished, welcome), welcome, 30);
    expect(replay.changed?.record).toEqual({ status: "completed", v: 2, step: "intro", at: 30 });
    const skipped = endTour(replay.state, welcome, "outside-press", 40);
    expect(tourStateOf(skipped.state, "welcome")).toBe("completed");
  });

  it("resumes an auto run at the saved step of the same version only", () => {
    const sameVersion = ready(initialTourSession({ welcome: { v: 2, step: "usage", at: 1 } }));
    expect(started(sameVersion, welcome, "auto").pending?.stepId).toBe("usage");
    expect(started(sameVersion, welcome, "user").pending?.stepId).toBe("intro");
    const olderVersion = ready(initialTourSession({ welcome: { v: 1, step: "usage", at: 1 } }));
    expect(started(olderVersion, welcome, "auto").pending?.stepId).toBe("intro");
  });

  it("refuses a second run while one is active", () => {
    const busy = started(ready(), welcome);
    expect(startTour(busy, billing, { origin: "user" })).toEqual({ _tag: "refused", reason: "busy" });
  });

  it("holds auto starts for the cooldown after another tour's last activity", () => {
    const state = ready(initialTourSession({ billing: { status: "dismissed", v: 1, at: 1000 } }));
    expect(tourAutoStartRefusal(state, welcome, 1500, 1000)).toBe("cooldown");
    expect(tourAutoStartRefusal(state, welcome, 2000, 1000)).toBeNull();
  });

  it("auto-starts the highest priority among the tours that may start, and the earliest on a tie", () => {
    const low = defineTour({ id: "low", steps: ["a"] });
    const high = defineTour({ id: "high", steps: ["a"], priority: 2 });
    const tie = defineTour({ id: "tie", steps: ["a"], priority: 2 });
    const finishedHigher = defineTour({ id: "finished", steps: ["a"], priority: 9 });
    const state = ready(initialTourSession({ finished: { status: "completed", v: 1, at: 0 } }));
    expect(pickAutoStartTour(state, [low, high, tie, finishedHigher], 10, 0)).toBe(high);
    expect(pickAutoStartTour(state, [finishedHigher], 10, 0)).toBeNull();
  });
});

describe("records from storage", () => {
  it("ends an auto run that another tab finished, and leaves a user's run going", () => {
    const finishedElsewhere = { welcome: { status: "completed" as const, v: 2, at: 50 } };
    const auto = showPendingStep(started(ready(), welcome, "auto"), welcome, 10).state;
    const synced = receiveTourRecords(auto, finishedElsewhere);
    expect(synced.ended?.reason).toBe("synced");
    expect(synced.changed).toBeNull();

    const user = shownAt(welcome, "intro");
    const kept = receiveTourRecords(user, finishedElsewhere);
    expect(kept.ended).toBeNull();
    expect(kept.state.shown).toBe(user.shown);
  });

  it("counts a failed storage call as storage having answered", () => {
    const failed = failTourStorage(initialTourSession());
    expect(failed.ready).toBe(true);
    expect(tourStateOf(failed, "welcome")).toBe("idle");
  });
});

type Operation =
  | { readonly kind: "start"; readonly tour: 0 | 1; readonly origin: TourOrigin }
  | { readonly kind: "show" | "skip" | "next" | "prev" | "content" }
  | { readonly kind: "end"; readonly reason: TourEndReason }
  | { readonly kind: "receive"; readonly tour: 0 | 1; readonly status: "completed" | "dismissed" | null };

const operation: fc.Arbitrary<Operation> = fc.oneof(
  fc.record({
    kind: fc.constant("start" as const),
    tour: fc.constantFrom(0 as const, 1 as const),
    origin: fc.constantFrom("user" as const, "auto" as const),
  }),
  fc.record({
    kind: fc.constantFrom(
      "show" as const,
      "skip" as const,
      "next" as const,
      "prev" as const,
      "content" as const
    ),
  }),
  fc.record({
    kind: fc.constant("end" as const),
    reason: fc.constantFrom<TourEndReason>(
      "completed",
      "skip-press",
      "close-press",
      "escape-key",
      "outside-press",
      "no-targets",
      "synced",
      "error"
    ),
  }),
  fc.record({
    kind: fc.constant("receive" as const),
    tour: fc.constantFrom(0 as const, 1 as const),
    status: fc.constantFrom("completed" as const, "dismissed" as const, null),
  })
);

const tours = [welcome, billing] as const;

function apply(state: TourSessionState, op: Operation, now: number): TourTransition {
  const run = state.shown ?? state.pending;
  const definition = tours.find((tour) => tour.id === run?.tourId) ?? welcome;
  switch (op.kind) {
    case "start": {
      const outcome = startTour(state, tours[op.tour], { origin: op.origin });
      return { state: outcome._tag === "started" ? outcome.state : state, ended: null, changed: null };
    }
    case "show":
      return showPendingStep(state, definition, now);
    case "skip":
      return skipPendingStep(state, definition, now);
    case "next":
      return nextTourStep(state, definition, now);
    case "prev":
      return previousTourStep(state, definition);
    case "content":
      return { state: bumpTourContent(state), ended: null, changed: null };
    case "end":
      return endTour(state, definition, op.reason, now);
    case "receive": {
      const record = op.status === null ? { v: 1, at: now } : { v: 1, at: now, status: op.status };
      return receiveTourRecords(state, Object.fromEntries([[tours[op.tour].id, record]]));
    }
  }
}

describe("references across transitions", () => {
  it("keeps every record, and the shown and resolving steps, that a transition did not change", () => {
    fc.assert(
      fc.property(fc.array(operation, { maxLength: 40 }), (operations) => {
        let state = ready();
        operations.forEach((op, now) => {
          const before = state;
          const { state: after, changed, ended } = apply(before, op, now + 1);
          const touched = new Set<string>();
          if (changed !== null) {
            touched.add(changed.tourId);
            expect(after.records[changed.tourId]).toBe(changed.record);
          }
          if (op.kind === "receive") {
            touched.add(tours[op.tour].id);
          }
          for (const [id, record] of Object.entries(before.records)) {
            if (!touched.has(id)) {
              expect(after.records[id]).toBe(record);
            }
          }
          if (touched.size === 0) {
            expect(after.records).toBe(before.records);
          }
          if (ended === null && (op.kind === "content" || op.kind === "receive")) {
            expect(after.pending).toBe(before.pending);
          }
          if (ended === null && (op.kind === "content" || op.kind === "next" || op.kind === "prev")) {
            expect(after.shown).toBe(before.shown);
          }
          state = after;
        });
      })
    );
  });
});
