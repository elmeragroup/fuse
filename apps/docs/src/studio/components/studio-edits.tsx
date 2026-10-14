"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { themeSlug } from "@elmeragroup/fuse/theme";
import type { ThemeInput, ThemeSlug } from "@elmeragroup/fuse/theme";

import { loadStudioSeed } from "../../generated/studio-seeds";
import { isTextEditingTarget } from "../../lib/typing-target";
import { artboardStyle } from "../lib/artboard-style";
import type { CustomProperties } from "../lib/artboard-style";
import type { ArtboardScheme } from "../lib/documents";
import { NO_OVERRIDES, guardedHistory, reduceGuarded } from "../lib/edits";
import type { EditAction, GuardedHistory, Refusal, StudioDocument, StudioOverrides } from "../lib/edits";
import type { StudioSeed } from "../lib/seed";
import { createSeedCache, failedAmong } from "../lib/seed-store";
import type { SeedState } from "../lib/seed-store";
import { declarationsOf, documentCycles } from "../lib/token-values";
import { studioToasts, useStudioPersistence } from "./studio-persistence";

export type StudioEditsValue = {
  /** The visitor's token edits over the base theme. */
  overrides: StudioOverrides;
  /** Applies one edit, reset, undo or redo. */
  edit: (action: EditAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  /** The base theme's declared and resolved tokens, once its seed has loaded. */
  seed: StudioSeed | undefined;
  /** The seed of a theme on screen, the base theme's or an artboard's own, once it has loaded. */
  seedOf: (slug: ThemeSlug) => StudioSeed | undefined;
  /** The inline declarations an artboard or probe in `scheme` wears. */
  styleFor: (scheme: ArtboardScheme) => CustomProperties;
  /** The scheme whose values the inspector edits. */
  editScheme: ArtboardScheme;
  setEditScheme: (scheme: ArtboardScheme) => void;
  /**
   * A new gesture key, unique for the life of the session, so one interaction's values make one
   * undo step and no two interactions share a step.
   */
  newGesture: () => string;
};

const StudioEditsContext = createContext<StudioEditsValue | undefined>(undefined);

export const StudioEditsProvider = StudioEditsContext.Provider;

export function useStudioEdits(): StudioEditsValue {
  const value = use(StudioEditsContext);
  if (value === undefined) {
    throw new Error("useStudioEdits must be used within StudioProvider");
  }
  return value;
}

/**
 * The seeds of the themes on screen; `undefined` while in flight or after a failed load. They
 * load for the slugs the provider reports on screen, and a failed load waits for a retry
 * (`useSeedsOnScreen`).
 */
function useSeeds(theme: ThemeInput): Pick<StudioEditsValue, "seed" | "seedOf"> & { seeds: SeedLoads } {
  const [cache] = useState(() => createSeedCache(loadStudioSeed));
  const loads = useSyncExternalStore(cache.subscribe, cache.getState, cache.getState);
  const slug = themeSlug(theme);
  const seedOf = useCallback(
    (wanted: ThemeSlug) => {
      const load = loads.get(wanted);
      return load?.status === "ready" ? load.seed : undefined;
    },
    [loads]
  );
  const seeds = useMemo(
    (): SeedLoads => ({ loads, retry: cache.retry, request: cache.request }),
    [loads, cache]
  );
  return { seed: seedOf(slug), seedOf, seeds };
}

/**
 * Loads the seed of each theme on screen, and toasts while one has failed to load, with a retry
 * that loads every failed seed again; the session keeps its document meanwhile. The toast closes
 * once no theme on screen has a failed seed, after a retry or once a base theme or artboard
 * change takes the failed theme off screen.
 *
 * @param seeds - The session's seed loads.
 * @param onScreen - The slugs of the themes on screen: the base theme's first, then each
 *   artboard's.
 */
export function useSeedsOnScreen(seeds: SeedLoads, onScreen: Iterable<ThemeSlug>): void {
  const slugs = Array.from(onScreen);
  // Keyed on the joined slugs, so the request effect runs when the themes on screen change
  // rather than on every render's fresh list.
  const key = slugs.join("\n");
  const { request, retry } = seeds;
  const requestOnScreen = useEffectEvent(() => {
    for (const slug of slugs) {
      request(slug);
    }
  });
  useEffect(() => {
    requestOnScreen();
  }, [key]);
  const failed = failedAmong(seeds.loads, slugs);
  useEffect(() => {
    if (!failed) {
      return undefined;
    }
    const id = studioToasts.add({
      type: "error",
      title: "The theme's values could not load",
      description: "The knobs wait for them. Your edits are kept.",
      timeout: 0,
      actionProps: {
        children: "Retry",
        onClick: retry,
      },
    });
    return () => {
      studioToasts.close(id);
    };
  }, [failed, retry]);
}

/**
 * ⌘Z or Ctrl+Z undoes, with Shift it redoes, except in a text-editing control, whose own undo
 * owns the keys. A focused slider or button still undoes the session.
 */
function useUndoShortcuts(dispatch: (action: EditAction) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "z" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.defaultPrevented ||
        isTextEditingTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dispatch]);
}

/**
 * The session's reducer: every transition under the no-cycle invariant, checked against the base
 * theme. Every other theme on screen skips the edits that loop in it instead (`artboardEdits`).
 */
function reduceSession(state: GuardedHistory, action: EditAction): GuardedHistory {
  return reduceGuarded(state, action, documentCycles);
}

const NAME_LIST = new Intl.ListFormat("en", { type: "conjunction" });

/** Tells the visitor why a transition did nothing: it would have put tokens on an alias cycle. */
function useRefusalToast(refusal: Refusal | undefined): void {
  useEffect(() => {
    if (refusal === undefined) {
      return;
    }
    studioToasts.add({
      type: "warning",
      title: "That change would loop tokens through each other",
      description: `${NAME_LIST.format(refusal.names.map((name) => `--${name}`))} would form a loop, so nothing changed. Change one of them first.`,
    });
  }, [refusal]);
}

/** The scheme the inspector edits, chosen for one selection. */
type SchemeChoice = { readonly selectedId: string | undefined; readonly scheme: ArtboardScheme };

/** Each requested theme's seed load, a request for another, and a retry of every failed one. */
export type SeedLoads = {
  readonly loads: ReadonlyMap<ThemeSlug, SeedState>;
  readonly retry: () => void;
  readonly request: (slug: ThemeSlug) => void;
};

export type EditSession = {
  theme: ThemeInput;
  setTheme: (theme: ThemeInput) => void;
  value: StudioEditsValue;
  /** The seed loads, for `useSeedsOnScreen`. */
  seeds: SeedLoads;
};

/**
 * The edit session the studio provider owns: the base theme and the token edits, with undo,
 * persistence, the base theme's seed and the scheme the inspector edits. That scheme follows the
 * selected artboard's until the visitor picks one for this selection. No transition leaves an
 * alias cycle in either scheme: one that would is refused with a toast ({@link reduceGuarded}).
 *
 * @param opening - The theme the session opens on.
 * @param selectedId - The selected artboard, if any.
 * @param selectedScheme - Its scheme.
 */
export function useEditSession(
  opening: ThemeInput,
  selectedId: string | undefined,
  selectedScheme: ArtboardScheme | undefined
): EditSession {
  const openingDocument = useMemo(
    (): StudioDocument => ({ theme: opening, overrides: NO_OVERRIDES }),
    [opening]
  );
  const [{ history, refusal }, dispatch] = useReducer(reduceSession, openingDocument, guardedHistory);
  const { theme, overrides } = history.present;
  useRefusalToast(refusal);
  useStudioPersistence(history.present, openingDocument, dispatch);
  useUndoShortcuts(dispatch);
  const { seed, seedOf, seeds } = useSeeds(theme);

  const [choice, setChoice] = useState<SchemeChoice | undefined>(undefined);
  const editScheme =
    choice !== undefined && choice.selectedId === selectedId ? choice.scheme : (selectedScheme ?? "light");
  const setEditScheme = useCallback(
    (scheme: ArtboardScheme) => {
      setChoice({ selectedId, scheme });
    },
    [selectedId]
  );

  // Each scheme's style (its edits under the shared ones) keeps its identity until those edits
  // or the seed change, so a metric edit does not send the inspector's color probes back to
  // the browser.
  const { light: lightEdits, dark: darkEdits, shared } = overrides;
  const base = useMemo(() => (seed === undefined ? undefined : declarationsOf(seed)), [seed]);
  const light = useMemo(
    () => artboardStyle({ ...lightEdits, ...shared }, base?.light),
    [lightEdits, shared, base]
  );
  const dark = useMemo(
    () => artboardStyle({ ...darkEdits, ...shared }, base?.dark),
    [darkEdits, shared, base]
  );

  const styleFor = useCallback(
    (scheme: ArtboardScheme) => (scheme === "light" ? light : dark),
    [light, dark]
  );

  const setTheme = useCallback((next: ThemeInput) => {
    dispatch({ type: "theme", theme: next });
  }, []);

  // Never reset, not even by a restore, so a key never repeats for the life of the session.
  const gestures = useRef(0);
  const newGesture = useCallback(() => {
    gestures.current += 1;
    return `gesture-${String(gestures.current)}`;
  }, []);

  const value = useMemo(
    (): StudioEditsValue => ({
      overrides,
      edit: dispatch,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      seed,
      seedOf,
      styleFor,
      editScheme,
      setEditScheme,
      newGesture,
    }),
    [
      overrides,
      history.past.length,
      history.future.length,
      seed,
      seedOf,
      styleFor,
      editScheme,
      setEditScheme,
      newGesture,
    ]
  );

  return { theme, setTheme, value, seeds };
}
