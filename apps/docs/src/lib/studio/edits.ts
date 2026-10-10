import type { Density, ThemeInput } from "@elmeragroup/fuse/theme";
import type { DensityMetricName } from "@elmeragroup/fuse/theme-catalog";

import type { DensityOverrides, MetricOverrides } from "./density-metrics";
import type { ArtboardScheme } from "./documents";
import { isLightOnly } from "./tokens";
import type { TokenName } from "./tokens";

/** Token values the visitor set, each the CSS a declaration takes, keyed by token name. */
export type TokenOverrides = Readonly<Partial<Record<TokenName, string>>>;

/**
 * The visitor's edits. A scheme-dependent token's edit belongs to the scheme it was made in;
 * a light-only token's edit is `shared`, because a dark palette keeps those from light.
 */
export type StudioOverrides = {
  readonly light: TokenOverrides;
  readonly dark: TokenOverrides;
  readonly shared: TokenOverrides;
  /**
   * Density metric edits, per density. They are not theme tokens: an artboard applies the edits
   * for its own density, whatever its scheme.
   */
  readonly density?: DensityOverrides;
};

/** Everything an edit session holds: the base theme and the edits over it. */
export type StudioDocument = {
  readonly theme: ThemeInput;
  readonly overrides: StudioOverrides;
};

export const NO_OVERRIDES: StudioOverrides = { light: {}, dark: {}, shared: {} };

type OverrideGroup = Exclude<keyof StudioOverrides, "density">;

function groupOf(scheme: ArtboardScheme, name: TokenName): OverrideGroup {
  return isLightOnly(name) ? "shared" : scheme;
}

/** The edit that applies to `name` in `scheme`, if there is one. */
export function overrideOf(
  overrides: StudioOverrides,
  scheme: ArtboardScheme,
  name: TokenName
): string | undefined {
  return overrides[groupOf(scheme, name)][name];
}

/** Every edit that applies to an artboard in `scheme`: its scheme's and the light-only ones. */
export function overridesFor(overrides: StudioOverrides, scheme: ArtboardScheme) {
  return { ...overrides[scheme], ...overrides.shared };
}

/** How many of `names` carry an edit that applies in `scheme`. */
export function editedCount(
  overrides: StudioOverrides,
  scheme: ArtboardScheme,
  names: readonly TokenName[]
): number {
  return names.filter((name) => overrideOf(overrides, scheme, name) !== undefined).length;
}

const NO_METRICS: MetricOverrides = {};

/** The metric edits that apply to an artboard in `density`. */
export function metricOverridesFor(overrides: StudioOverrides, density: Density): MetricOverrides {
  return overrides.density?.[density] ?? NO_METRICS;
}

function withMetric(
  overrides: StudioOverrides,
  density: Density,
  name: DensityMetricName,
  px: number | undefined
): StudioOverrides {
  const current = metricOverridesFor(overrides, density);
  if (current[name] === px) {
    return overrides;
  }
  const rest: MetricOverrides = Object.fromEntries(Object.entries(current).filter(([key]) => key !== name));
  const next: MetricOverrides = px === undefined ? rest : { ...rest, [name]: px };
  return { ...overrides, density: { ...overrides.density, [density]: next } };
}

function withoutKeys(group: TokenOverrides, names: readonly TokenName[]): TokenOverrides {
  return Object.fromEntries(Object.entries(group).filter(([name]) => !names.some((drop) => drop === name)));
}

function resetNames(
  overrides: StudioOverrides,
  scheme: ArtboardScheme,
  names: readonly TokenName[]
): StudioOverrides {
  const present = names.filter((name) => overrideOf(overrides, scheme, name) !== undefined);
  if (present.length === 0) {
    return overrides;
  }
  return {
    ...overrides,
    [scheme]: withoutKeys(overrides[scheme], present),
    shared: withoutKeys(overrides.shared, present),
  };
}

/** One change to the edit session, from the inspector, the toolbar or a shortcut. */
export type EditAction =
  | {
      readonly type: "set";
      readonly scheme: ArtboardScheme;
      readonly name: TokenName;
      readonly value: string;
      /**
       * A gesture's key, such as one slider drag's. Consecutive sets with the same key make one
       * undo step.
       */
      readonly coalesce?: string;
    }
  | {
      readonly type: "set-metric";
      readonly density: Density;
      readonly name: DensityMetricName;
      readonly px: number;
      /** As a token set's: consecutive sets with the same key make one undo step. */
      readonly coalesce?: string;
    }
  | { readonly type: "reset-metric"; readonly density: Density; readonly name: DensityMetricName }
  | { readonly type: "reset"; readonly scheme: ArtboardScheme; readonly name: TokenName }
  | { readonly type: "reset-section"; readonly scheme: ArtboardScheme; readonly names: readonly TokenName[] }
  | { readonly type: "reset-all" }
  | { readonly type: "theme"; readonly theme: ThemeInput }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  /** Loads a document, such as a share link's, with a fresh history. */
  | { readonly type: "replace"; readonly document: StudioDocument };

/** The edit session with its undo and redo stacks. */
export type EditHistory = {
  readonly past: readonly StudioDocument[];
  readonly present: StudioDocument;
  readonly future: readonly StudioDocument[];
  /** The gesture key of the step on top of `past`, while that gesture may still extend it. */
  readonly coalesce: string | undefined;
};

/** The undo steps kept; older ones drop off. */
const HISTORY_LIMIT = 100;

/** A fresh session on `document`, with nothing to undo or redo. */
export function editHistory(document: StudioDocument): EditHistory {
  return { past: [], present: document, future: [], coalesce: undefined };
}

function applyEdit(document: StudioDocument, action: EditAction): StudioDocument {
  const { overrides } = document;
  switch (action.type) {
    case "set": {
      const group = groupOf(action.scheme, action.name);
      if (overrides[group][action.name] === action.value) {
        return document;
      }
      return {
        ...document,
        overrides: { ...overrides, [group]: { ...overrides[group], [action.name]: action.value } },
      };
    }
    case "reset":
    case "reset-section": {
      const names = action.type === "reset" ? [action.name] : action.names;
      const next = resetNames(overrides, action.scheme, names);
      return next === overrides ? document : { ...document, overrides: next };
    }
    case "set-metric":
    case "reset-metric": {
      const px = action.type === "set-metric" ? action.px : undefined;
      const next = withMetric(overrides, action.density, action.name, px);
      return next === overrides ? document : { ...document, overrides: next };
    }
    case "reset-all":
      return overrides === NO_OVERRIDES ? document : { ...document, overrides: NO_OVERRIDES };
    case "theme":
      return { ...document, theme: action.theme };
    default:
      return document;
  }
}

/**
 * The session after `action`. An edit that changes nothing returns `history` itself, so it adds
 * no undo step. A set whose gesture key matches the top step's replaces that step's result
 * instead of pushing a new one, so a whole slider drag undoes at once.
 */
export function reduceEdits(history: EditHistory, action: EditAction): EditHistory {
  switch (action.type) {
    case "undo": {
      const previous = history.past.at(-1);
      return previous === undefined
        ? history
        : {
            past: history.past.slice(0, -1),
            present: previous,
            future: [history.present, ...history.future],
            coalesce: undefined,
          };
    }
    case "redo": {
      const [next, ...rest] = history.future;
      return next === undefined
        ? history
        : { past: [...history.past, history.present], present: next, future: rest, coalesce: undefined };
    }
    case "replace":
      return editHistory(action.document);
    default: {
      const present = applyEdit(history.present, action);
      if (present === history.present) {
        return history;
      }
      const coalesce = action.type === "set" || action.type === "set-metric" ? action.coalesce : undefined;
      if (coalesce !== undefined && coalesce === history.coalesce) {
        return { ...history, present, future: [] };
      }
      return {
        past: [...history.past, history.present].slice(-HISTORY_LIMIT),
        present,
        future: [],
        coalesce,
      };
    }
  }
}

/** A transition the session refused, and the tokens it would have put on a cycle. */
export type Refusal = { readonly action: EditAction; readonly names: readonly TokenName[] };

/** The edit session under its invariant, with the last transition it refused. */
export type GuardedHistory = {
  readonly history: EditHistory;
  /** The latest refusal, until a transition is admitted. */
  readonly refusal: Refusal | undefined;
};

/** A fresh guarded session on `document`. */
export function guardedHistory(document: StudioDocument): GuardedHistory {
  return { history: editHistory(document), refusal: undefined };
}

/**
 * The session after `action`, unless the document it leads to holds an alias cycle: then the
 * session stays as it was and records the refusal. Every transition passes the guard: an edit,
 * each reset, a theme change, undo and redo, and a restore. A reset that would bring a base
 * alias back onto a cycle is refused like any other transition, rather than resetting the edits
 * it would loop with, so a reset never removes more than it names.
 *
 * @param state - The session.
 * @param action - The transition.
 * @param cyclesOf - The tokens on a cycle in a document, against its own theme.
 */
export function reduceGuarded(
  state: GuardedHistory,
  action: EditAction,
  cyclesOf: (document: StudioDocument) => readonly TokenName[]
): GuardedHistory {
  const history = reduceEdits(state.history, action);
  if (history.present === state.history.present) {
    return history === state.history ? state : { history, refusal: undefined };
  }
  const names = cyclesOf(history.present);
  return names.length === 0 ? { history, refusal: undefined } : { ...state, refusal: { action, names } };
}
