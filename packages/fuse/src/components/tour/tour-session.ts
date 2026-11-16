// A tour Provider's session: which step is on screen, which step is resolving, every tour's record,
// and the rules for starting, moving and ending a run. The module is pure. It takes `now` as an
// argument and touches no DOM, storage or timer; `tour-controller.ts` runs those effects and
// applies these transitions to the Provider's store.
//
// - `shown` is the step on screen and `pending` the step resolving. A run is active while either is
//   set. During a step change both are set, so the popup stays open on `shown` while `pending`
//   waits for its element.
// - Every transition returns the same `shown`, `pending`, `records` and per-tour record objects
//   when it did not change them, so a part that selects one by reference renders only when it
//   changes, and the session writes storage only for a record whose reference changed.
// - Only a deliberate act writes a status: Done on the shown last step, Skip, Close, Escape,
//   `dismissTour`, and marking the last checklist task done, also when merged records cover the
//   checklist. An outside press or an error snoozes the tour for the page. Running out of steps
//   whose element exists, and a run another tab finished, write nothing.

import type { TourDefinition } from "./tour-definition";
import { mergeTourRecords, NO_TOUR_RECORDS } from "./tour-records";
import type { TourRecord, TourRecords, TourStatus } from "./tour-records";

/**
 * Who started a run: the user, through a control, or `useAutoStartTour`.
 *
 * @beta
 */
export type TourOrigin = "user" | "auto";

/**
 * What a run shows: the tour's steps in order, or one step on its own, as a checklist task's tip.
 *
 * @beta
 */
export type TourRunMode = "sequence" | "step";

/** The step on screen. */
export type TourShownStep = {
  /** The tour's id. */
  readonly tourId: string;
  /** The step's id. */
  readonly stepId: string;
  /** The step's position in the tour, from 0. */
  readonly index: number;
  /** How many steps the tour has. */
  readonly count: number;
  /** Who started the run. */
  readonly origin: TourOrigin;
  /** Whether the run shows the tour's steps in order or this one step. */
  readonly mode: TourRunMode;
};

/** The step resolving: the run waits for its element before it shows the step. */
export type TourPendingStep = TourShownStep & {
  /** The way the run moves when the step has no element: `1` forward, `-1` back. */
  readonly direction: 1 | -1;
};

/** A Provider's session state. */
export type TourSessionState = {
  /** Whether storage has answered, or failed to. */
  readonly ready: boolean;
  /** Every tour's record. */
  readonly records: TourRecords;
  /** The step on screen, or `null`. */
  readonly shown: TourShownStep | null;
  /** The step resolving, or `null`. */
  readonly pending: TourPendingStep | null;
  /** A counter the session raises when the shown step's registered words change. */
  readonly contentRev: number;
  /** The tours an outside press or an error ended on this page, which auto-start skips. */
  readonly snoozed: ReadonlySet<string>;
};

/**
 * Why a run ended.
 *
 * - `completed`: the user pressed Done on the shown last step.
 * - `skip-press`, `close-press`, `escape-key`: the user turned the tour down.
 * - `outside-press`: the user pressed outside the popup.
 * - `no-targets`: no remaining step in the run's direction had an element.
 * - `synced`: another tab or device finished the tour while it auto-ran here.
 * - `step-done`: the user finished a run of one step, or the step's task.
 * - `error`: a part or a consumer callback threw.
 *
 * @beta
 */
export type TourEndReason =
  | "completed"
  | "skip-press"
  | "close-press"
  | "escape-key"
  | "outside-press"
  | "no-targets"
  | "synced"
  | "step-done"
  | "error";

/** A run's ending, which `onEvent` reports. */
export type TourEnding = {
  /** The tour's id. */
  readonly tourId: string;
  /** The step the run ended on: the shown step, or the resolving one when none was shown. */
  readonly stepId: string;
  /** Why the run ended. */
  readonly reason: TourEndReason;
  /** The status the ending wrote, or `null` when it wrote none. */
  readonly status: TourStatus | null;
};

/**
 * A record a transition changed, which the session writes to storage.
 *
 * @beta
 */
export type TourRecordChange = {
  /** The tour's id. */
  readonly tourId: string;
  /** Its new record. */
  readonly record: TourRecord;
};

/** A transition's result. */
export type TourTransition = {
  /** The next state; the same object when nothing changed. */
  readonly state: TourSessionState;
  /** The run's ending, when the transition ended one. */
  readonly ended: TourEnding | null;
  /** The records the transition changed, which the session writes to storage in this order. */
  readonly changes: readonly TourRecordChange[];
};

/**
 * What a tour's state answers.
 *
 * - `unknown`: storage has not answered and no initial record finished the tour.
 * - `idle`: the tour can start.
 * - `active`: the tour is running.
 * - `completed`, `dismissed`: the tour's record has that status.
 * - `snoozed`: an outside press or an error ended the tour on this page.
 *
 * @beta
 */
export type TourState = "unknown" | "idle" | "active" | TourStatus | "snoozed";

/**
 * Why a start was refused.
 *
 * @beta
 */
export type TourStartRefusal = "busy" | "not-ready" | "finished" | "snoozed" | "cooldown" | "no-steps";

/** A start's result. */
export type TourStartOutcome =
  | { readonly _tag: "started"; readonly state: TourSessionState }
  | { readonly _tag: "refused"; readonly reason: TourStartRefusal };

const NO_SNOOZED: ReadonlySet<string> = new Set();

/**
 * A session before storage answers. `records` are the `initialRecords` a server read from the tour
 * cookie, so a finished tour answers its status from the first render.
 *
 * @param records - The initial records.
 * @returns The session.
 */
export function initialTourSession(records: TourRecords = NO_TOUR_RECORDS): TourSessionState {
  return {
    ready: false,
    records,
    shown: null,
    pending: null,
    contentRev: 0,
    snoozed: NO_SNOOZED,
  };
}

/**
 * The status an ending writes.
 *
 * @param reason - Why the run ended.
 * @returns The status, or `null` for an ending that writes none.
 */
export function tourEndStatus(reason: TourEndReason): TourStatus | null {
  switch (reason) {
    case "completed":
      return "completed";
    case "skip-press":
    case "close-press":
    case "escape-key":
      return "dismissed";
    case "outside-press":
    case "no-targets":
    case "synced":
    case "step-done":
    case "error":
      return null;
  }
}

/**
 * Whether an ending snoozes the tour for the page.
 *
 * @param reason - Why the run ended.
 * @returns `true` for an outside press and an error.
 */
export function tourEndSnoozes(reason: TourEndReason): boolean {
  return reason === "outside-press" || reason === "error";
}

/**
 * The run's step: the shown one, or the resolving one before any is shown.
 *
 * @param state - The session.
 * @returns The step, or `null` when no run is active.
 */
export function tourRunStep(state: TourSessionState): TourShownStep | null {
  return state.shown ?? state.pending;
}

/**
 * A tour's state. A tour with a status answers it even before storage answers, so a server
 * rendering from `initialRecords` and the first client render agree.
 *
 * @param state - The session.
 * @param tourId - The tour's id.
 * @returns The tour's state.
 */
export function tourStateOf(state: TourSessionState, tourId: string): TourState {
  if (tourRunStep(state)?.tourId === tourId) {
    return "active";
  }
  const status = state.records[tourId]?.status;
  if (status !== undefined) {
    return status;
  }
  if (!state.ready) {
    return "unknown";
  }
  return state.snoozed.has(tourId) ? "snoozed" : "idle";
}

function newestOtherActivity(state: TourSessionState, tourId: string): number | null {
  let newest: number | null = null;
  for (const [id, record] of Object.entries(state.records)) {
    if (id !== tourId && (newest === null || record.at > newest)) {
      newest = record.at;
    }
  }
  return newest;
}

/**
 * When the auto-start cooldown lets a tour start: the newest record change of any other tour plus
 * `cooldownMs`. Every shown step and every ending stamps its tour's record, so the cooldown counts
 * from a user's last sight of any other tour, across page loads.
 *
 * @param state - The session.
 * @param tourId - The tour that would start.
 * @param cooldownMs - The cooldown, in milliseconds.
 * @returns The time, in milliseconds since the epoch, or `null` when no other tour has a record.
 */
export function tourCooldownEndsAt(
  state: TourSessionState,
  tourId: string,
  cooldownMs: number
): number | null {
  const newest = newestOtherActivity(state, tourId);
  return newest === null ? null : newest + cooldownMs;
}

/**
 * Why `useAutoStartTour` may not start a tour now.
 *
 * @param state - The session.
 * @param definition - The tour.
 * @param now - The current time, in milliseconds since the epoch.
 * @param cooldownMs - The time to keep between tours, in milliseconds.
 * @returns The refusal, or `null` when the tour may start.
 */
export function tourAutoStartRefusal(
  state: TourSessionState,
  definition: TourDefinition,
  now: number,
  cooldownMs: number
): TourStartRefusal | null {
  if (definition.steps.length === 0) {
    return "no-steps";
  }
  if (tourRunStep(state) !== null) {
    return "busy";
  }
  if (state.records[definition.id]?.status !== undefined) {
    return "finished";
  }
  if (!state.ready) {
    return "not-ready";
  }
  if (state.snoozed.has(definition.id)) {
    return "snoozed";
  }
  const endsAt = tourCooldownEndsAt(state, definition.id, cooldownMs);
  return endsAt !== null && now < endsAt ? "cooldown" : null;
}

/**
 * The tour `useAutoStartTour` starts among several that are due: the highest `priority` among those
 * that may start, and the earliest in `candidates` on a tie.
 *
 * @param state - The session.
 * @param candidates - The due tours, in the order their hooks mounted.
 * @param now - The current time, in milliseconds since the epoch.
 * @param cooldownMs - The time to keep between tours, in milliseconds.
 * @returns The tour to start, or `null` when none may.
 */
export function pickAutoStartTour(
  state: TourSessionState,
  candidates: readonly TourDefinition[],
  now: number,
  cooldownMs: number
): TourDefinition | null {
  let picked: TourDefinition | null = null;
  for (const candidate of candidates) {
    if (
      tourAutoStartRefusal(state, candidate, now, cooldownMs) === null &&
      (picked === null || candidate.priority > picked.priority)
    ) {
      picked = candidate;
    }
  }
  return picked;
}

function resumeIndex(state: TourSessionState, definition: TourDefinition): number {
  const record = state.records[definition.id];
  if (record?.v !== definition.version || record.step === undefined) {
    return 0;
  }
  return Math.max(0, definition.steps.indexOf(record.step));
}

/** Who started a run and what it shows, which every step of the run carries. */
type RunBase = Pick<TourShownStep, "origin" | "mode">;

function pendingAt(
  definition: TourDefinition,
  index: number,
  direction: 1 | -1,
  { origin, mode }: RunBase
): TourPendingStep | null {
  const stepId = definition.steps[index];
  return stepId === undefined
    ? null
    : { tourId: definition.id, stepId, index, count: definition.steps.length, origin, mode, direction };
}

/** Options for `startTour`. */
export type TourStartOptions = {
  /** Who starts the run. */
  readonly origin: TourOrigin;
  /** The step to start at. A user's run starts at the first step and an auto run resumes by default. */
  readonly at?: string;
  /** What the run shows. A `"step"` run shows the step `at` alone and needs `at`. */
  readonly mode?: TourRunMode;
};

/**
 * Starts a run. A user may start any tour, a finished one included, while no other run is active.
 * An auto start resumes at the saved step of the same version. Refusals other than `busy` and
 * `no-steps` apply to auto starts only; see `tourAutoStartRefusal`.
 *
 * @param state - The session.
 * @param definition - The tour.
 * @param options - Who starts it and where.
 * @returns The started session, or the refusal.
 */
export function startTour(
  state: TourSessionState,
  definition: TourDefinition,
  options: TourStartOptions
): TourStartOutcome {
  if (definition.steps.length === 0) {
    return { _tag: "refused", reason: "no-steps" };
  }
  if (tourRunStep(state) !== null) {
    return { _tag: "refused", reason: "busy" };
  }
  const mode = options.mode ?? "sequence";
  const requested = options.at === undefined ? -1 : definition.steps.indexOf(options.at);
  if (mode === "step" && requested === -1) {
    return { _tag: "refused", reason: "no-steps" };
  }
  const index = requested !== -1 ? requested : options.origin === "auto" ? resumeIndex(state, definition) : 0;
  const pending = pendingAt(definition, index, 1, { origin: options.origin, mode });
  return pending === null
    ? { _tag: "refused", reason: "no-steps" }
    : { _tag: "started", state: { ...state, pending } };
}

/** No changed records. */
const NO_CHANGES: readonly TourRecordChange[] = Object.freeze([]);

function unchanged(state: TourSessionState): TourTransition {
  return { state, ended: null, changes: NO_CHANGES };
}

/** A record under construction. */
type DraftRecord = { -readonly [K in keyof TourRecord]: TourRecord[K] };

function progressRecord(
  held: TourRecord | undefined,
  definition: TourDefinition,
  stepId: string,
  now: number
): TourRecord {
  const record: DraftRecord = {
    v: definition.version,
    step: stepId,
    at: now,
  };
  if (held?.status !== undefined) {
    record.status = held.status;
  }
  if (held?.v === definition.version && held.done !== undefined) {
    record.done = held.done;
  }
  return record;
}

function withRecord(state: TourSessionState, tourId: string, record: TourRecord): TourSessionState {
  return { ...state, records: Object.fromEntries([...Object.entries(state.records), [tourId, record]]) };
}

/**
 * Shows the resolving step: it becomes the shown step, and in a sequence its tour's record saves it
 * as the place to resume.
 *
 * @param state - The session.
 * @param definition - The run's tour.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition; unchanged when no step of `definition` is resolving.
 */
export function showPendingStep(
  state: TourSessionState,
  definition: TourDefinition,
  now: number
): TourTransition {
  const { pending } = state;
  if (pending?.tourId !== definition.id) {
    return unchanged(state);
  }
  const { direction: _direction, ...shown } = pending;
  if (pending.mode === "step") {
    return { state: { ...state, shown, pending: null }, ended: null, changes: NO_CHANGES };
  }
  const record = progressRecord(state.records[definition.id], definition, pending.stepId, now);
  return {
    state: { ...withRecord(state, definition.id, record), shown, pending: null },
    ended: null,
    changes: [{ tourId: definition.id, record }],
  };
}

/**
 * Passes over the resolving step, whose element never appeared. The run moves on in the step's
 * direction. Moving back past the first step keeps the shown step on screen, and moving past either
 * end with no step shown, or past the last step, ends the run as `no-targets`. A run of one step
 * ends as `no-targets` at once.
 *
 * @param state - The session.
 * @param definition - The run's tour.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition.
 */
export function skipPendingStep(
  state: TourSessionState,
  definition: TourDefinition,
  now: number
): TourTransition {
  const { pending } = state;
  if (pending?.tourId !== definition.id) {
    return unchanged(state);
  }
  if (pending.mode === "step") {
    return endTour(state, definition, "no-targets", now);
  }
  const next = pendingAt(definition, pending.index + pending.direction, pending.direction, pending);
  if (next !== null) {
    return { state: { ...state, pending: next }, ended: null, changes: NO_CHANGES };
  }
  if (pending.direction === -1 && state.shown !== null) {
    return { state: { ...state, pending: null }, ended: null, changes: NO_CHANGES };
  }
  return endTour(state, definition, "no-targets", now);
}

/**
 * Moves the run to the next step, or completes it when the shown step is the last. A run of one
 * step ends as `step-done`. It does nothing while a step is resolving, so a second press never
 * skips a step.
 *
 * @param state - The session.
 * @param definition - The run's tour.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition.
 */
export function nextTourStep(
  state: TourSessionState,
  definition: TourDefinition,
  now: number
): TourTransition {
  const { shown } = state;
  if (shown?.tourId !== definition.id || state.pending !== null) {
    return unchanged(state);
  }
  if (shown.mode === "step") {
    return endTour(state, definition, "step-done", now);
  }
  if (shown.index + 1 >= definition.steps.length) {
    return endTour(state, definition, "completed", now);
  }
  const pending = pendingAt(definition, shown.index + 1, 1, shown);
  return pending === null
    ? unchanged(state)
    : { state: { ...state, pending }, ended: null, changes: NO_CHANGES };
}

/**
 * Moves the run to the previous step. It does nothing on the first step, in a run of one step, or
 * while a step is resolving.
 *
 * @param state - The session.
 * @param definition - The run's tour.
 * @returns The transition.
 */
export function previousTourStep(state: TourSessionState, definition: TourDefinition): TourTransition {
  const { shown } = state;
  if (
    shown?.tourId !== definition.id ||
    state.pending !== null ||
    shown.index === 0 ||
    shown.mode === "step"
  ) {
    return unchanged(state);
  }
  const pending = pendingAt(definition, shown.index - 1, -1, shown);
  return pending === null
    ? unchanged(state)
    : { state: { ...state, pending }, ended: null, changes: NO_CHANGES };
}

/** A run stopped: the state with no step, and the ending to report. */
type StoppedRun = {
  readonly stopped: TourSessionState;
  readonly ended: TourEnding;
};

function stopRun(state: TourSessionState, step: TourShownStep, reason: TourEndReason): StoppedRun {
  const snoozed = tourEndSnoozes(reason) ? new Set([...state.snoozed, step.tourId]) : state.snoozed;
  return {
    stopped: { ...state, shown: null, pending: null, snoozed },
    // A run of one step is a task's tip: closing it turns down the tip, not the tour.
    ended: {
      tourId: step.tourId,
      stepId: step.stepId,
      reason,
      status: step.mode === "step" ? null : tourEndStatus(reason),
    },
  };
}

/**
 * Ends the active run. A deliberate ending of a sequence writes its status, keeping the record's
 * progress; an ending of a one-step run writes none. An outside press and an error snooze the tour
 * for the page.
 *
 * @param state - The session.
 * @param definition - The run's tour.
 * @param reason - Why the run ends.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition; unchanged when no run of `definition` is active.
 */
export function endTour(
  state: TourSessionState,
  definition: TourDefinition,
  reason: TourEndReason,
  now: number
): TourTransition {
  const step = tourRunStep(state);
  if (step?.tourId !== definition.id) {
    return unchanged(state);
  }
  const { stopped, ended } = stopRun(state, step, reason);
  if (ended.status === null) {
    return { state: stopped, ended, changes: NO_CHANGES };
  }
  const held = state.records[definition.id];
  const record: TourRecord = { ...held, v: held?.v ?? definition.version, status: ended.status, at: now };
  return {
    state: withRecord(stopped, definition.id, record),
    ended,
    changes: [{ tourId: definition.id, record }],
  };
}

/**
 * Whether the user finished a step as a checklist task, in the definition's version.
 *
 * @param state - The session.
 * @param definition - The tour.
 * @param stepId - The step.
 * @returns Whether the step is done.
 */
export function isTourStepDone(state: TourSessionState, definition: TourDefinition, stepId: string): boolean {
  const record = state.records[definition.id];
  return record?.v === definition.version && record.done?.includes(stepId) === true;
}

/**
 * How many of the tour's steps the user finished as checklist tasks, in the definition's version.
 *
 * @param state - The session.
 * @param definition - The tour.
 * @returns The count.
 */
export function tourDoneCount(state: TourSessionState, definition: TourDefinition): number {
  return definition.steps.filter((stepId) => isTourStepDone(state, definition, stepId)).length;
}

/**
 * Marks a step done as a checklist task. The tour completes once every step is done, unless it
 * already has a status. A run of that one step ends as `step-done`.
 *
 * @param state - The session.
 * @param definition - The tour.
 * @param stepId - The step the user finished.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition; unchanged for a step the tour does not list or one already done.
 */
export function completeTourStep(
  state: TourSessionState,
  definition: TourDefinition,
  stepId: string,
  now: number
): TourTransition {
  if (!definition.steps.includes(stepId) || isTourStepDone(state, definition, stepId)) {
    return unchanged(state);
  }
  const held = state.records[definition.id];
  const done = [...(held?.v === definition.version ? (held.done ?? []) : []), stepId];
  const record: DraftRecord = { v: definition.version, done, at: now };
  if (held?.v === definition.version && held.step !== undefined) {
    record.step = held.step;
  }
  if (held?.status !== undefined) {
    record.status = held.status;
  } else if (definition.steps.every((step) => done.includes(step))) {
    record.status = "completed";
  }
  const marked = withRecord(state, definition.id, record);
  const run = tourRunStep(marked);
  if (run?.tourId === definition.id && run.mode === "step" && run.stepId === stepId) {
    const { stopped, ended } = stopRun(marked, run, "step-done");
    return { state: stopped, ended, changes: [{ tourId: definition.id, record }] };
  }
  return { state: marked, ended: null, changes: [{ tourId: definition.id, record }] };
}

/** The state with the covered checklists completed, and the records that changed. */
type CompletedTours = {
  readonly state: TourSessionState;
  readonly changes: readonly TourRecordChange[];
};

/**
 * Completes every tour whose checklist steps are all done in its current version but which has no
 * status yet. Records merged from two devices can cover every step between them, as when one device
 * finished one task and another the rest, and `completeTourStep` cannot repair that because every
 * step is already done. A tour with a status keeps it.
 */
function completeCoveredTours(
  state: TourSessionState,
  definitions: Iterable<TourDefinition>,
  now: number
): CompletedTours {
  let next = state;
  const changes: TourRecordChange[] = [];
  for (const definition of definitions) {
    const held = next.records[definition.id];
    if (
      held === undefined ||
      held.status !== undefined ||
      definition.steps.length === 0 ||
      tourDoneCount(next, definition) < definition.steps.length
    ) {
      continue;
    }
    const record: TourRecord = { ...held, status: "completed", at: now };
    next = withRecord(next, definition.id, record);
    changes.push({ tourId: definition.id, record });
  }
  return { state: next, changes };
}

/**
 * Settles records that changed outside a gesture: it completes the checklists they cover, then ends
 * an auto-started run whose tour gained a status since `before`, as `synced`, writing nothing for
 * the ending. A run the user started keeps going.
 */
function settleTourRecords(
  before: TourSessionState,
  merged: TourSessionState,
  definitions: Iterable<TourDefinition>,
  now: number
): TourTransition {
  const completed = completeCoveredTours(merged, definitions, now);
  const step = tourRunStep(completed.state);
  if (
    step?.origin !== "auto" ||
    completed.state.records[step.tourId]?.status === undefined ||
    before.records[step.tourId]?.status !== undefined
  ) {
    return { state: completed.state, ended: null, changes: completed.changes };
  }
  const { stopped, ended } = stopRun(completed.state, step, "synced");
  return { state: stopped, ended, changes: completed.changes };
}

/**
 * Completes the known checklists whose steps are all done, as `receiveTourRecords` does, for a tour
 * that became known after its records arrived.
 *
 * @param state - The session.
 * @param definitions - The tours to check.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition, with every record it completed and an auto run it ended as `synced`.
 */
export function reconcileTours(
  state: TourSessionState,
  definitions: Iterable<TourDefinition>,
  now: number
): TourTransition {
  return settleTourRecords(state, state, definitions, now);
}

/**
 * Turns a tour down for good, as Skip does. A run of the tour ends as `skip-press`, and the tour's
 * record takes the `dismissed` status, also after a run of one step, whose own endings write none.
 * A tour that already has a status keeps it.
 *
 * @param state - The session.
 * @param definition - The tour.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition.
 */
export function dismissTour(
  state: TourSessionState,
  definition: TourDefinition,
  now: number
): TourTransition {
  const stopped = endTour(state, definition, "skip-press", now);
  const held = stopped.state.records[definition.id];
  if (held?.status !== undefined) {
    return stopped;
  }
  const record: TourRecord = { ...held, v: held?.v ?? definition.version, status: "dismissed", at: now };
  return {
    state: withRecord(stopped.state, definition.id, record),
    ended: stopped.ended,
    changes: [{ tourId: definition.id, record }],
  };
}

/**
 * Merges records that storage read or another tab wrote, and marks storage as answered. It then
 * completes every known checklist whose steps the merged records cover. When the records finish a
 * tour that is auto-running here, by its status or by its checklist, the run ends as `synced`; a
 * run the user started keeps going.
 *
 * @param state - The session.
 * @param incoming - The records storage answered with.
 * @param definitions - The tours the session knows.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The transition, with every record a completed checklist changed.
 */
export function receiveTourRecords(
  state: TourSessionState,
  incoming: TourRecords,
  definitions: Iterable<TourDefinition>,
  now: number
): TourTransition {
  const records = mergeTourRecords(state.records, incoming);
  const merged = records === state.records && state.ready ? state : { ...state, records, ready: true };
  return settleTourRecords(state, merged, definitions, now);
}

/**
 * Notes a failed storage call. The session keeps its records in memory from then on, and memory has
 * answered, so any failure counts as storage having answered, a write that fails before the first
 * read included.
 *
 * @param state - The session.
 * @returns The next state.
 */
export function failTourStorage(state: TourSessionState): TourSessionState {
  return state.ready ? state : { ...state, ready: true };
}

/**
 * Raises `contentRev`, so `Tour.Title` and `Tour.Description` read the shown step's words again.
 *
 * @param state - The session.
 * @returns The next state.
 */
export function bumpTourContent(state: TourSessionState): TourSessionState {
  return { ...state, contentRev: state.contentRev + 1 };
}
