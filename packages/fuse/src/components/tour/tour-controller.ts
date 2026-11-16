// A Provider's tour controller: the imperative shell around `tour-session.ts`. It owns the session
// store, the step registry, the storage port and every effect: waiting for a step's element,
// scrolling to it, reading and writing storage, and starting tours that are due. It is the only
// place that awaits, and every promise ends in a catch: a failed storage call falls back to memory,
// and anything else ends the run as `error`.
//
// Nothing here runs while React renders. Hooks call `registerStep` and `setWords` from layout
// effects and the gestures from event handlers. A part may read `wordsOf` and `targetOf` while it
// renders: the registry is a plain map beside the store, and `contentRev` in the state tells a part
// when the shown step's words changed.

import type { ReactNode } from "react";

import { isThemeDevelopment } from "../../theme/validate-theme";
import { createCalendarStore } from "../calendar/calendar-store";
import type { ReadableCalendarStore } from "../calendar/calendar-store";
import { tourStepKey } from "./tour-definition";
import type { TourDefinition, TourStepPlacement } from "./tour-definition";
import { TourError } from "./tour-error";
import type { TourErrorSource } from "./tour-error";
import { parseTourRecords } from "./tour-records";
import type { TourRecords, TourStatus } from "./tour-records";
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
  tourCooldownEndsAt,
  tourRunStep,
} from "./tour-session";
import type {
  TourEndReason,
  TourOrigin,
  TourSessionState,
  TourShownStep,
  TourStartRefusal,
  TourTransition,
} from "./tour-session";
import { localTourStorage, memoryTourStorage } from "./tour-storage";
import type { TourStorage } from "./tour-storage";
import { isMostlyInView, queryTourStepElement, waitForTourTarget } from "./tour-target-dom";

/**
 * A step's words and placement, as a `Tour.Target` or `useTourStep` registers them.
 *
 * @beta
 */
export type TourStepWords = {
  /** The step's title, which names the popup. */
  readonly title?: ReactNode;
  /** The step's description. */
  readonly description?: ReactNode;
  /** Where the step shows its popup. */
  readonly placement?: TourStepPlacement;
};

/**
 * The storage call that failed, after which the session keeps its records in memory.
 *
 * @beta
 */
export type TourStorageOperation = "read" | "write";

/**
 * What the tour reports to `Tour.Provider`'s `onEvent`.
 *
 * - `start`: a run started.
 * - `show`: a step showed.
 * - `skip`: a step's element never appeared, so the run passed over it.
 * - `end`: a run ended, with the status the ending wrote or `null`.
 * - `storage-error`: a storage call failed, and the Provider keeps records in memory from then on.
 *
 * @beta
 */
export type TourEvent =
  | {
      readonly type: "start";
      readonly tourId: string;
      readonly stepId: string;
      readonly origin: TourOrigin;
    }
  | { readonly type: "show"; readonly tourId: string; readonly stepId: string; readonly index: number }
  | { readonly type: "skip"; readonly tourId: string; readonly stepId: string }
  | {
      readonly type: "end";
      readonly tourId: string;
      readonly stepId: string;
      readonly reason: TourEndReason;
      readonly status: TourStatus | null;
    }
  | { readonly type: "storage-error"; readonly operation: TourStorageOperation };

/** The callbacks and settings a Provider passes on each render. */
export type TourControllerSettings = {
  /** Receives every event. */
  readonly onEvent: ((event: TourEvent) => void) | undefined;
  /** Receives every error the tour caught. */
  readonly onError: ((error: TourError) => void) | undefined;
  /** The time to keep between auto-started tours, in milliseconds. */
  readonly autoStartCooldownMs: number;
  /** Whether scrolling to a step jumps instead of animating. */
  readonly reducedMotion: () => boolean;
};

/** A step registration, which its hook updates and removes. */
export type TourStepHandle = {
  /** Replaces the step's words. The shown step's popup re-reads them when they changed. */
  readonly setWords: (words: TourStepWords | undefined) => void;
  /** Ends the registration. */
  readonly unregister: () => void;
};

/** An auto-start candidate, which its hook marks due and removes. */
export type TourAutoStartHandle = {
  /** Marks the tour as due: its delay passed, so it starts once nothing blocks it. */
  readonly due: () => void;
  /** Ends the candidacy. */
  readonly remove: () => void;
};

/**
 * What a start returns: `started`, or why the tour did not start.
 *
 * @beta
 */
export type TourStartResult = "started" | TourStartRefusal;

/** A Provider's tour controller. */
export type TourController = {
  /** The session store. */
  readonly store: ReadableCalendarStore<TourSessionState>;
  /** Registers the element getter of a step, from a hook's layout effect. */
  readonly registerStep: (
    tour: TourDefinition,
    stepId: string,
    element: () => Element | null
  ) => TourStepHandle;
  /** The words a step shows: the newest registration's, else the definition's. */
  readonly wordsOf: (tourId: string, stepId: string) => TourStepWords | null;
  /** The element a shown step resolved to, or `null` for a centered step. */
  readonly targetOf: (step: TourShownStep) => Element | null;
  /** Starts a run of `tour`. */
  readonly start: (tour: TourDefinition, origin: TourOrigin, at?: string) => TourStartResult;
  /** Moves `tour`'s run to its next step, or completes it on the last. */
  readonly next: (tour: TourDefinition) => void;
  /** Moves `tour`'s run to its previous step. */
  readonly prev: (tour: TourDefinition) => void;
  /** Ends `tour`'s run. */
  readonly end: (tour: TourDefinition, reason: TourEndReason) => void;
  /** Turns `tour` down for good. */
  readonly dismiss: (tour: TourDefinition) => void;
  /** Ends the run of the tour with `tourId` as `error`, after a part threw. */
  readonly fail: (tourId: string, error: Error) => void;
  /** Adds `tour` as an auto-start candidate. */
  readonly addAutoStart: (tour: TourDefinition) => TourAutoStartHandle;
  /** Makes `tour` known to the session, from a hook's or part's layout effect. */
  readonly register: (tour: TourDefinition) => void;
  /** Reads storage and subscribes to it, and returns the cleanup. */
  readonly connect: () => () => void;
  /** Replaces the callbacks and settings. */
  readonly configure: (settings: TourControllerSettings) => void;
};

/** Options for `createTourController`. */
export type TourControllerOptions = {
  /** The storage, or `undefined` for localStorage. */
  readonly storage: TourStorage | undefined;
  /** Records a server read, such as from the tour cookie. */
  readonly initialRecords: TourRecords | undefined;
};

/** The longest delay `setTimeout` keeps, in milliseconds. */
const MAX_TIMER_MS = 2 ** 31 - 1;

type Registration = {
  readonly element: () => Element | null;
  words: TourStepWords | undefined;
};

function sameWords(a: TourStepWords | undefined, b: TourStepWords | undefined): boolean {
  return (
    Object.is(a?.title, b?.title) &&
    Object.is(a?.description, b?.description) &&
    Object.is(a?.placement, b?.placement)
  );
}

/**
 * A controller over a fresh session. It reads storage only once `connect` runs.
 *
 * @param options - The storage and the initial records.
 * @returns The controller.
 */
export function createTourController({ storage, initialRecords }: TourControllerOptions): TourController {
  const store = createCalendarStore(initialTourSession(initialRecords));
  const definitions = new Map<string, TourDefinition>();
  const registry = new Map<string, Registration[]>();
  // Keyed by the shown step itself, so a popup that holds the last step while it closes still has
  // its element, and a step that went away takes its element with it.
  const targets = new WeakMap<TourShownStep, Element>();
  const candidates = new Map<string, { due: boolean }>();
  let settings: TourControllerSettings = {
    onEvent: undefined,
    onError: undefined,
    autoStartCooldownMs: 0,
    reducedMotion: () => false,
  };
  // The storage in use and its subscription. Swapping to memory after a failure unsubscribes the
  // failed storage and replaces this record, and every read answer and notification checks that its
  // record is still the active one, so the failed storage's pending answers and later notifications
  // are dropped together.
  let active: {
    readonly storage: TourStorage;
    unsubscribe: (() => void) | undefined;
  } | null = null;
  // Storage writes run one after another in transition order, so a slow save never lands after a
  // later one.
  let writeTurn: Promise<void> = Promise.resolve();
  let resolving: { readonly key: string; readonly abort: AbortController } | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  let evaluationTimer: ReturnType<typeof setTimeout> | undefined;

  const report = (error: TourError): void => {
    try {
      if (settings.onError === undefined) {
        if (isThemeDevelopment()) {
          console.warn(error.message, error.cause);
        }
      } else {
        settings.onError(error);
      }
    } catch {
      // A throwing onError has nowhere left to report to.
    }
  };

  const emit = (event: TourEvent): void => {
    try {
      settings.onEvent?.(event);
    } catch (error) {
      report(new TourError("callback", { cause: error }));
    }
  };

  const portOf = (): NonNullable<typeof active> => {
    active ??= { storage: storage ?? localTourStorage(), unsubscribe: undefined };
    return active;
  };

  const stopListening = (): void => {
    const unsubscribe = active?.unsubscribe;
    if (active !== null) {
      active.unsubscribe = undefined;
    }
    try {
      unsubscribe?.();
    } catch (cause) {
      report(new TourError("storage", { cause }));
    }
  };

  const degrade = (operation: TourStorageOperation, error: TourError): void => {
    report(error);
    stopListening();
    active = { storage: memoryTourStorage(store.get().records), unsubscribe: undefined };
    // Memory has answered, so the session is ready even when a write failed before the first read.
    store.set(failTourStorage(store.get()));
    emit({ type: "storage-error", operation });
    evaluateAutoStart();
  };

  const write = (transition: TourTransition): void => {
    const { changed } = transition;
    if (changed === null) {
      return;
    }
    const records = transition.state.records;
    writeTurn = writeTurn.then(() => {
      // The port is read when the write runs, so a write queued behind a failed one goes to memory.
      const port = portOf();
      return Promise.resolve()
        .then(() => port.storage.write(records, changed))
        .catch((cause: unknown) => {
          if (active === port) {
            degrade("write", new TourError("storage", { cause }));
          }
        });
    });
  };

  const remember = (tour: TourDefinition): void => {
    definitions.set(tour.id, tour);
  };

  // Makes a tour known. Every hook and part that names a tour calls this.
  const know = (tour: TourDefinition): void => {
    remember(tour);
  };

  const wordsOf = (tourId: string, stepId: string): TourStepWords | null =>
    registry.get(tourStepKey(tourId, stepId))?.findLast((entry) => entry.words !== undefined)?.words ??
    definitions.get(tourId)?.content[stepId] ??
    null;

  const findElement = (tourId: string, stepId: string): Element | null => {
    const key = tourStepKey(tourId, stepId);
    const stack = registry.get(key) ?? [];
    for (let at = stack.length - 1; at >= 0; at -= 1) {
      const element = stack[at]?.element() ?? null;
      if (element !== null) {
        return element;
      }
    }
    return queryTourStepElement(key);
  };

  const cancelResolving = (): void => {
    resolving?.abort.abort();
    resolving = null;
  };

  // `apply` and `resolvePending` call each other: showing or skipping a step applies a transition,
  // and a transition that leaves a step resolving starts the wait for its element.
  // A transition commits its state first, then notifies, then runs its effects against the live
  // state, so a callback's own change, such as `dismiss()` from `onEvent`, stays in effect.
  function apply(transition: TourTransition, announce: TourEvent | null = null): void {
    const before = store.get();
    store.set(transition.state);
    write(transition);
    if (announce !== null) {
      emit(announce);
    }
    const shown = transition.state.shown;
    if (shown !== null && shown !== before.shown) {
      emit({ type: "show", tourId: shown.tourId, stepId: shown.stepId, index: shown.index });
    }
    if (transition.ended !== null) {
      const { tourId, stepId, reason, status } = transition.ended;
      emit({ type: "end", tourId, stepId, reason, status });
    }
    resolvePending();
    if (transition.ended !== null) {
      evaluateAutoStart();
    }
  }

  function resolvePending(): void {
    const { pending } = store.get();
    if (pending === null) {
      cancelResolving();
      return;
    }
    const key = `${tourStepKey(pending.tourId, pending.stepId)}#${pending.index}`;
    if (resolving?.key === key) {
      return;
    }
    cancelResolving();
    const definition = definitions.get(pending.tourId);
    if (definition === undefined) {
      return;
    }
    const abort = new AbortController();
    resolving = { key, abort };
    const show = (element: Element | null): void => {
      if (abort.signal.aborted) {
        return;
      }
      resolving = null;
      const transition = showPendingStep(store.get(), definition, Date.now());
      if (element !== null) {
        if (transition.state.shown !== null) {
          targets.set(transition.state.shown, element);
        }
        if (!isMostlyInView(element)) {
          element.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: settings.reducedMotion() ? "instant" : "smooth",
          });
        }
      }
      apply(transition);
    };
    if (wordsOf(pending.tourId, pending.stepId)?.placement === "center") {
      show(null);
      return;
    }
    waitForTourTarget(() => findElement(pending.tourId, pending.stepId), {
      timeoutMs: definition.targetTimeoutMs,
      signal: abort.signal,
    })
      .then((element) => {
        if (abort.signal.aborted) {
          return;
        }
        if (element === null) {
          resolving = null;
          apply(skipPendingStep(store.get(), definition, Date.now()), {
            type: "skip",
            tourId: pending.tourId,
            stepId: pending.stepId,
          });
          return;
        }
        show(element);
      })
      .catch((cause) => {
        failRun("tour", cause, pending.tourId);
      });
  }

  function evaluateAutoStart(): void {
    clearTimeout(cooldownTimer);
    const state = store.get();
    if (tourRunStep(state) !== null || !state.ready) {
      return;
    }
    const due: TourDefinition[] = [];
    for (const [tourId, candidate] of candidates) {
      const definition = definitions.get(tourId);
      if (candidate.due && definition !== undefined) {
        due.push(definition);
      }
    }
    const now = Date.now();
    const cooldownMs = settings.autoStartCooldownMs;
    const picked = pickAutoStartTour(state, due, now, cooldownMs);
    if (picked !== null) {
      // One attempt per hook mount: a run that ends without a status, such as `no-targets`, leaves
      // the tour idle, and starting it again would loop for as long as the hook stays mounted.
      const candidate = candidates.get(picked.id);
      if (candidate !== undefined) {
        candidate.due = false;
      }
      start(picked, "auto");
      return;
    }
    let wake: number | null = null;
    for (const definition of due) {
      const endsAt = tourCooldownEndsAt(state, definition.id, cooldownMs);
      if (tourAutoStartRefusal(state, definition, now, cooldownMs) === "cooldown" && endsAt !== null) {
        wake = wake === null ? endsAt : Math.min(wake, endsAt);
      }
    }
    if (wake !== null) {
      // A timer longer than 2^31 - 1 milliseconds, about 24.8 days, fires at once, so a longer wait
      // takes the longest timer and looks again when it fires.
      cooldownTimer = setTimeout(guarded(undefined, evaluateAutoStart), Math.min(wake - now, MAX_TIMER_MS));
    }
  }

  function start(tour: TourDefinition, origin: TourOrigin, at?: string): TourStartResult {
    remember(tour);
    const outcome = startTour(store.get(), tour, at === undefined ? { origin } : { origin, at });
    if (outcome._tag === "refused") {
      return outcome.reason;
    }
    const pending = outcome.state.pending;
    apply(
      { state: outcome.state, ended: null, changed: null },
      pending === null ? null : { type: "start", tourId: tour.id, stepId: pending.stepId, origin }
    );
    return "started";
  }

  /** Reports what failed and ends the run of `tourId`, or the active run, as `error`. */
  function failRun(source: TourErrorSource, cause: unknown, tourId?: string): void {
    report(new TourError(source, { cause }));
    const id = tourId ?? tourRunStep(store.get())?.tourId;
    const definition = id === undefined ? undefined : definitions.get(id);
    if (definition === undefined) {
      return;
    }
    try {
      apply(endTour(store.get(), definition, "error", Date.now()));
    } catch (failure) {
      report(new TourError("tour", { cause: failure }));
    }
  }

  /** Runs a gesture so that nothing it throws reaches the host; a throw ends the run as `error`. */
  const guarded =
    <A extends readonly unknown[], R>(fallback: R, action: (...args: A) => R) =>
    (...args: A): R => {
      try {
        return action(...args);
      } catch (error) {
        failRun("tour", error);
        return fallback;
      }
    };

  return {
    store,
    registerStep: guarded<[TourDefinition, string, () => Element | null], TourStepHandle>(
      { setWords: () => undefined, unregister: () => undefined },
      (tour, stepId, element) => {
        know(tour);
        if (!tour.steps.includes(stepId) && isThemeDevelopment()) {
          console.warn(`Tour "${tour.id}" has no step "${stepId}". The tour ignores this registration.`);
        }
        const key = tourStepKey(tour.id, stepId);
        const registration: Registration = { element, words: undefined };
        const stack = registry.get(key) ?? [];
        if (stack.length > 0 && isThemeDevelopment()) {
          console.warn(`Tour step "${key}" is registered twice. The tour uses the newest registration.`);
        }
        registry.set(key, [...stack, registration]);
        return {
          setWords(words) {
            if (sameWords(registration.words, words)) {
              return;
            }
            registration.words = words;
            const { shown } = store.get();
            if (shown !== null && tourStepKey(shown.tourId, shown.stepId) === key) {
              store.set(bumpTourContent(store.get()));
            }
          },
          unregister() {
            const { shown } = store.get();
            const showing = shown !== null && tourStepKey(shown.tourId, shown.stepId) === key;
            const before = showing ? wordsOf(shown.tourId, shown.stepId) : null;
            const remaining = (registry.get(key) ?? []).filter((entry) => entry !== registration);
            if (remaining.length === 0) {
              registry.delete(key);
            } else {
              registry.set(key, remaining);
            }
            // A removal can fall back to an earlier registration's words or the definition's.
            if (
              showing &&
              !sameWords(before ?? undefined, wordsOf(shown.tourId, shown.stepId) ?? undefined)
            ) {
              store.set(bumpTourContent(store.get()));
            }
          },
        };
      }
    ),
    wordsOf,
    targetOf: (step) => targets.get(step) ?? null,
    start: guarded("busy", start),
    next: guarded(undefined, (tour: TourDefinition) => {
      apply(nextTourStep(store.get(), tour, Date.now()));
    }),
    prev: guarded(undefined, (tour: TourDefinition) => {
      apply(previousTourStep(store.get(), tour));
    }),
    end: guarded(undefined, (tour: TourDefinition, reason: TourEndReason) => {
      apply(endTour(store.get(), tour, reason, Date.now()));
    }),
    dismiss: guarded(undefined, (tour: TourDefinition) => {
      remember(tour);
      apply(dismissTour(store.get(), tour, Date.now()));
    }),
    fail(tourId, error) {
      failRun("part", error, tourId);
    },
    addAutoStart: guarded<[TourDefinition], TourAutoStartHandle>(
      { due: () => undefined, remove: () => undefined },
      (tour) => {
        know(tour);
        const candidate = { due: false };
        candidates.set(tour.id, candidate);
        return {
          due: guarded(undefined, () => {
            candidate.due = true;
            // Wait out the task, so tours whose delays end together compete by priority.
            clearTimeout(evaluationTimer);
            evaluationTimer = setTimeout(guarded(undefined, evaluateAutoStart), 0);
          }),
          remove() {
            if (candidates.get(tour.id) === candidate) {
              candidates.delete(tour.id);
            }
          },
        };
      }
    ),
    register: guarded(undefined, know),
    connect() {
      let connected = true;
      const port = portOf();
      const listening = (): boolean => connected && active === port;
      const receive = (records: TourRecords): void => {
        if (listening()) {
          guarded(undefined, () => {
            // A consumer's storage may answer with whatever its backend returned, such as `null` for a
            // user with no saved tours, so the answer is parsed as the built-in adapters parse theirs.
            apply(receiveTourRecords(store.get(), parseTourRecords(records)));
            evaluateAutoStart();
          })();
        }
      };
      const fail = (operation: TourStorageOperation, error: TourError): void => {
        if (listening()) {
          degrade(operation, error);
        }
      };
      try {
        const answer = port.storage.read();
        if (answer instanceof Promise) {
          answer.then(receive, (cause) => {
            fail("read", new TourError("storage", { cause }));
          });
        } else {
          receive(answer);
        }
      } catch (cause) {
        fail("read", new TourError("storage", { cause }));
      }
      try {
        const unsubscribe = port.storage.subscribe?.(receive);
        if (active === port) {
          port.unsubscribe = unsubscribe;
        } else {
          // The read failed and swapped the storage before the subscription started.
          unsubscribe?.();
        }
      } catch (error) {
        report(new TourError("storage", { cause: error }));
      }
      // A reconnect, such as Strict Mode's second effect run, picks up a step left resolving.
      resolvePending();
      return () => {
        connected = false;
        cancelResolving();
        clearTimeout(cooldownTimer);
        clearTimeout(evaluationTimer);
        if (active === port) {
          stopListening();
        }
      };
    },
    configure(next) {
      settings = next;
    },
  };
}
