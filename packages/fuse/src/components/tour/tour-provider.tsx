"use client";

import { createContext, use, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode, RefCallback } from "react";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { createCalendarStore, useCalendarSelector } from "../calendar/calendar-store";
import { createTourController } from "./tour-controller";
import type {
  TourController,
  TourEvent,
  TourStartResult,
  TourStepHandle,
  TourStepWords,
} from "./tour-controller";
import { tourStepKey } from "./tour-definition";
import type { TourDefinition } from "./tour-definition";
import type { TourError } from "./tour-error";
import type { TourRecords } from "./tour-records";
import { initialTourSession, tourStateOf } from "./tour-session";
import type { TourState } from "./tour-session";
import type { TourStorage } from "./tour-storage";

const TourControllerContext = createContext<TourController | null>(null);

const inertStore = createCalendarStore(initialTourSession());

// The controller every hook outside a Provider reads. Its store never changes and every gesture does
// nothing, so a part rendered outside a Provider shows no tour instead of throwing.
const INERT_CONTROLLER: TourController = {
  store: inertStore,
  registerStep: () => ({ setWords: () => undefined, unregister: () => undefined }),
  wordsOf: () => null,
  targetOf: () => null,
  start: () => "not-ready",
  next: () => undefined,
  prev: () => undefined,
  end: () => undefined,
  dismiss: () => undefined,
  fail: () => undefined,
  addAutoStart: () => ({ due: () => undefined, remove: () => undefined }),
  register: () => undefined,
  connect: () => () => undefined,
  configure: () => undefined,
};

let warnedOutsideProvider = false;

/**
 * The nearest Provider's controller, or an inert one outside a Provider. Unlike other Fuse contexts,
 * it never throws: the first read outside a Provider warns once in development.
 *
 * @returns The controller.
 */
export function useTourController(): TourController {
  const controller = use(TourControllerContext);
  useEffect(() => {
    if (controller === null && !warnedOutsideProvider && isThemeDevelopment()) {
      warnedOutsideProvider = true;
      console.warn("Tour: a tour part or hook rendered outside Tour.Provider, so no tour runs.");
    }
  }, [controller]);
  return controller ?? INERT_CONTROLLER;
}

/**
 * Props for `Tour.Provider`.
 *
 * @beta
 */
export type TourProviderProps = {
  /**
   * Where the tour keeps its records. The Provider reads it once, when it mounts. Defaults to
   * `localTourStorage()`. A storage holds functions, so a Server Component cannot pass one; render
   * the Provider from a client module to set it.
   */
  storage?: TourStorage;
  /**
   * Records a server already read, so a finished tour answers its status from the first render and
   * the server HTML matches. Read them from the tour cookie in a Server Component:
   * `initialRecords={parseTourCookie((await cookies()).get(TOUR_COOKIE_NAME)?.value)}`. Keep the
   * cookie current from `storage`: a `write` that also passes `serializeTourCookie(records)` to a
   * Server Action, which sets the cookie under `TOUR_COOKIE_NAME`.
   */
  initialRecords?: TourRecords;
  /** Called when a run starts, shows a step, passes over a step, or ends, and when storage fails. */
  onEvent?: (event: TourEvent) => void;
  /**
   * Called with each error the tour caught: a storage call, a part, a callback or the tour's own.
   * The tour never throws into the page. Without it, a development build logs a warning.
   */
  onError?: (error: TourError) => void;
  /**
   * The time `useAutoStartTour` keeps between tours, in milliseconds: a tour waits this long after
   * the user last saw a step of another tour, in this visit or an earlier one.
   */
  autoStartCooldownMs?: number;
  /** The app. The Provider renders no element, and a run renders nothing in it. */
  children?: ReactNode;
};

/**
 * The tour session for the app inside it. It renders only its children, and a run re-renders only
 * the tour parts and hooks whose answer changes, never the rest of the app.
 *
 * @beta
 */
export function TourProvider({
  storage,
  initialRecords,
  onEvent,
  onError,
  autoStartCooldownMs = 0,
  children,
}: TourProviderProps): ReactElement {
  const [controller] = useState(() => createTourController({ storage, initialRecords }));
  const reducedMotion = useReducedMotion();
  useLayoutEffect(() => {
    controller.configure({ onEvent, onError, autoStartCooldownMs, reducedMotion: () => reducedMotion });
  });
  useEffect(() => controller.connect(), [controller]);
  return <TourControllerContext value={controller}>{children}</TourControllerContext>;
}

/**
 * What `useTour` returns.
 *
 * @template S - The tour's step ids.
 *
 * @beta
 */
export type TourHandle<S extends string> = {
  /** The tour's state. It is `"unknown"` until storage answers, except for a tour with a status. */
  readonly state: TourState;
  /** The shown step's id while the tour runs, else `null`. */
  readonly stepId: S | null;
  /** The shown step's position, from 0, while the tour runs, else `null`. */
  readonly index: number | null;
  /** How many steps the tour has. */
  readonly count: number;
  /**
   * Starts the tour, at its first step or at `at`. A user may replay a finished tour. Returns
   * `"started"`, or `"busy"` while another tour runs.
   */
  readonly start: (at?: S) => TourStartResult;
  /** Shows the next step, or completes the tour on the last. */
  readonly next: () => void;
  /** Shows the previous step. */
  readonly prev: () => void;
  /** Turns the tour down for good: a run ends as Skip ends it, and a tour with no run is dismissed. */
  readonly dismiss: () => void;
};

/**
 * A tour's state and controls. Every answer is a primitive, so the caller re-renders only when its
 * own answer changes.
 *
 * @template S - The tour's step ids.
 * @param tour - The tour.
 * @returns The tour's state and controls.
 *
 * @beta
 */
export function useTour<S extends string>(tour: TourDefinition<S>): TourHandle<S> {
  const controller = useTourController();
  useLayoutEffect(() => {
    controller.register(tour);
  }, [controller, tour]);
  const state = useCalendarSelector(controller.store, (session) => tourStateOf(session, tour.id));
  const shownStepId = useCalendarSelector(controller.store, (session) =>
    session.shown?.tourId === tour.id ? session.shown.stepId : null
  );
  const index = useCalendarSelector(controller.store, (session) =>
    session.shown?.tourId === tour.id ? session.shown.index : null
  );
  const start = useCallback((at?: S) => controller.start(tour, "user", at), [controller, tour]);
  const next = useCallback(() => {
    controller.next(tour);
  }, [controller, tour]);
  const prev = useCallback(() => {
    controller.prev(tour);
  }, [controller, tour]);
  const dismiss = useCallback(() => {
    controller.dismiss(tour);
  }, [controller, tour]);
  return {
    state,
    stepId: tour.steps.find((step) => step === shownStepId) ?? null,
    index,
    count: tour.steps.length,
    start,
    next,
    prev,
    dismiss,
  };
}

/**
 * Options for `useAutoStartTour`.
 *
 * @beta
 */
export type AutoStartTourOptions = {
  /**
   * How long to wait after mount before the tour is due, in milliseconds, so the page settles first.
   * Defaults to 500.
   */
  delayMs?: number;
  /** Whether the tour starts on its own. Defaults to `true`. */
  enabled?: boolean;
};

/**
 * Starts a tour on its own once it is due: after `delayMs`, once storage answered, while no other
 * tour runs and the Provider's cooldown has passed. It never starts a finished tour, or one an
 * outside press or an error ended on this page. Among tours due at once, the highest `priority`
 * starts. An auto-started run resumes at the step the user last saw. When it ends, focus returns
 * to the element focused before the popup opened, or stays where the user moved it.
 *
 * @param tour - The tour.
 * @param options - The delay and whether it is on.
 *
 * @beta
 */
export function useAutoStartTour(tour: TourDefinition, options: AutoStartTourOptions = {}): void {
  const { delayMs = 500, enabled = true } = options;
  const controller = useTourController();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const candidate = controller.addAutoStart(tour);
    const timer = setTimeout(candidate.due, delayMs);
    return () => {
      clearTimeout(timer);
      candidate.remove();
    };
  }, [controller, tour, delayMs, enabled]);
}

/**
 * What `useTourStep` returns.
 *
 * @beta
 */
export type TourStepBinding = {
  /** The ref to put on the step's element. */
  readonly ref: RefCallback<Element>;
  /** Whether the step is on screen. */
  readonly active: boolean;
};

/**
 * Registers the element a step points at, with the step's words. The registration starts when the
 * component mounts and ends when it unmounts. A step whose element never appears is skipped.
 *
 * @template S - The tour's step ids.
 * @param tour - The tour.
 * @param step - The step's id.
 * @param words - The step's title, description and placement. They override the definition's.
 * @returns The ref for the element, and whether the step is on screen.
 *
 * @beta
 */
export function useTourStep<S extends string>(
  tour: TourDefinition<S>,
  step: NoInfer<S>,
  words?: TourStepWords
): TourStepBinding {
  const controller = useTourController();
  const node = useRef<Element | null>(null);
  const handle = useRef<TourStepHandle | null>(null);
  useLayoutEffect(() => {
    const registration = controller.registerStep(tour, step, () => node.current);
    handle.current = registration;
    return () => {
      registration.unregister();
      handle.current = null;
    };
  }, [controller, tour, step]);
  // Runs after the registration effect in the same commit, and after every render, so the popup
  // reads the words this render passed.
  useLayoutEffect(() => {
    handle.current?.setWords(words);
  });
  const key = tourStepKey(tour.id, step);
  const active = useCalendarSelector(
    controller.store,
    (session) => session.shown !== null && tourStepKey(session.shown.tourId, session.shown.stepId) === key
  );
  const ref = useCallback((element: Element | null) => {
    node.current = element;
  }, []);
  return { ref, active };
}
