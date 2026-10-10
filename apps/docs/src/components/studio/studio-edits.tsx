"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { themeSlug } from "@elmeragroup/fuse/theme";
import type { ThemeInput, ThemeSlug } from "@elmeragroup/fuse/theme";

import { loadStudioSeed } from "../../generated/studio-seeds";
import { artboardStyle } from "../../lib/studio/artboard-style";
import type { CustomProperties } from "../../lib/studio/artboard-style";
import type { ArtboardScheme } from "../../lib/studio/documents";
import { NO_OVERRIDES, guardedHistory, overridesFor, reduceGuarded } from "../../lib/studio/edits";
import type {
  EditAction,
  GuardedHistory,
  Refusal,
  StudioDocument,
  StudioOverrides,
} from "../../lib/studio/edits";
import type { StudioSeed } from "../../lib/studio/seed";
import { createSeedStore } from "../../lib/studio/seed-store";
import { declarationsOf, documentCycles } from "../../lib/studio/token-values";
import { isTextEditingTarget } from "../../lib/typing-target";
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
 * The base theme's seed, loaded on demand; `undefined` while a theme's seed is in flight or after
 * its load failed. A failure toasts with a retry, and the session keeps its document meanwhile.
 */
function useSeed(slug: ThemeSlug): StudioSeed | undefined {
  const [store] = useState(() => createSeedStore(loadStudioSeed));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  useEffect(() => {
    store.request(slug);
  }, [store, slug]);
  useEffect(() => {
    if (state?.status !== "failed") {
      return undefined;
    }
    const id = studioToasts.add({
      type: "error",
      title: "The theme's values could not load",
      description: "The knobs wait for them. Your edits are kept.",
      timeout: 0,
      actionProps: {
        children: "Retry",
        onClick: () => {
          store.retry();
        },
      },
    });
    return () => {
      studioToasts.close(id);
    };
  }, [store, state]);
  return state?.status === "ready" && state.slug === slug ? state.seed : undefined;
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

/** The session's reducer: every transition under the no-cycle invariant. */
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

export type EditSession = {
  theme: ThemeInput;
  setTheme: (theme: ThemeInput) => void;
  value: StudioEditsValue;
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
  const seed = useSeed(themeSlug(theme));

  const [choice, setChoice] = useState<SchemeChoice | undefined>(undefined);
  const editScheme =
    choice !== undefined && choice.selectedId === selectedId ? choice.scheme : (selectedScheme ?? "light");
  const setEditScheme = useCallback(
    (scheme: ArtboardScheme) => {
      setChoice({ selectedId, scheme });
    },
    [selectedId]
  );

  const styles = useMemo(() => {
    const base = seed === undefined ? undefined : declarationsOf(seed);
    return {
      light: artboardStyle(overridesFor(overrides, "light"), base?.light),
      dark: artboardStyle(overridesFor(overrides, "dark"), base?.dark),
    };
  }, [overrides, seed]);

  const styleFor = useCallback((scheme: ArtboardScheme) => styles[scheme], [styles]);

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
      styleFor,
      editScheme,
      setEditScheme,
      newGesture,
    ]
  );

  return { theme, setTheme, value };
}
