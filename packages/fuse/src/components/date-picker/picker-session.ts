// This module is the edit session for both date pickers. The session is the one place that stores a
// picker's committed value and what the picker holds between that value and the user. Its pure
// transitions over an immutable state run through `use-picker-session.ts` on Calendar's synchronous
// store, so a gesture reads what an earlier gesture in the same task left.
//
// - `value` is the committed value and `basis` its key. The picker's own value follows each commit;
//   a parent's follows its `value` prop once it renders, so a change the parent declines leaves the
//   session as it was.
// - `pending` is a parent's commit it has not rendered yet. A gesture later in the same task reads
//   it through `committedNow`, so a second edit builds on the first. A render never reads it. It
//   ends when the session next follows the parent's value, accepted or not, or when the task ends
//   in `settle`, so a change the parent declines without rendering never reaches a later gesture.
// - `held` is a selection the picker shows without having committed it: a day picked in an empty
//   time picker that stays open, a range picked in an empty time range picker that stays open, or a
//   half-typed range. It carries the `basis` it was made over. Once the committed value moves off
//   that basis, `follow` drops it for good, so a value restored later never brings it back. A
//   DateInput's draft over its committed value works the same way. `finalizeOnClose` marks a
//   selection that the close commits.
// - `open` is the popup's own open state, read while the parent does not own it.
// - `generation` counts form resets. The calendars' views start over by it, in
//   `use-view-follows-value.ts`, and a range's end recognizes a reset's commit by it. The inputs
//   reset themselves through the session; see `date-input-reset.ts`.

/** Where a held selection came from, reported again when the close commits it. */
export type PickerHeldOrigin<R extends string = string> = {
  /** The gesture that made the selection. */
  readonly reason: R;
  /** Its DOM event. */
  readonly event: Event;
  /** The element it happened on. */
  readonly trigger: Element | undefined;
};

/**
 * A selection the picker shows but has not committed.
 *
 * @template V - What the picker holds: a day, or a range's ends.
 * @template R - The gestures that make a selection.
 */
export type PickerHeld<V, R extends string = string> = {
  /** The committed value's key the selection was made over. */
  readonly basis: string;
  /** The selection. */
  readonly value: V;
  /** The gesture behind it, when closing the popup commits it; `null` when closing leaves it held. */
  readonly finalizeOnClose: PickerHeldOrigin<R> | null;
};

/**
 * Who applies a commit: the picker, when it keeps its own value, or a parent, whose `value` prop
 * the session follows once it renders.
 */
export type PickerValueOwner = "picker" | "parent";

/** A committed value and its key. */
export type PickerCommitted<C> = {
  /** The value. */
  readonly value: C;
  /** Its key, which a held selection belongs to. */
  readonly basis: string;
};

/**
 * A picker's edit session.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 * @template R - The gestures that make a selection.
 */
export type PickerSessionState<V, C, R extends string = string> = PickerCommitted<C> & {
  /** A parent's commit not rendered yet, which gestures in the same task read, or `null`. */
  readonly pending: PickerCommitted<C> | null;
  /** The popup's own open state. */
  readonly open: boolean;
  /** The held selection, or `null`. */
  readonly held: PickerHeld<V, R> | null;
  /** How many form resets the session has seen. */
  readonly generation: number;
};

/**
 * A session before any edit.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 * @param open - Whether the popup starts open.
 * @param committed - The first committed value: the parent's, or the picker's default.
 * @returns The session.
 */
export function initialPickerSession<V, C, R extends string = string>(
  open: boolean,
  committed: PickerCommitted<C>
): PickerSessionState<V, C, R> {
  return { open, value: committed.value, basis: committed.basis, pending: null, held: null, generation: 0 };
}

/**
 * The committed value a gesture builds on. It is a parent's commit not yet rendered, or else the
 * session's value.
 *
 * @template C - The committed value.
 * @param state - The session.
 * @returns The committed value and its key.
 */
export function committedNow<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>
): PickerCommitted<C> {
  return state.pending ?? { value: state.value, basis: state.basis };
}

/**
 * The held selection while it still belongs to the committed value, else `null`.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @param basis - The committed value's key: the session's own, or a parent's value rendered before
 *   the session follows it.
 * @returns The selection, or `null`.
 */
export function heldFor<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>,
  basis: string
): PickerHeld<V, R> | null {
  return state.held?.basis === basis ? state.held : null;
}

/**
 * Holds a selection over the committed value a gesture builds on, a parent's pending commit
 * included, so the selection survives the parent rendering that commit.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @param value - The selection.
 * @param finalizeOnClose - The gesture that made it, when closing the popup commits it, or `null`.
 * @returns The session holding it.
 */
export function hold<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>,
  value: V,
  finalizeOnClose: PickerHeldOrigin<R> | null
): PickerSessionState<V, C, R> {
  return { ...state, held: { basis: committedNow(state).basis, value, finalizeOnClose } };
}

/**
 * Follows the committed value a render gives. The session drops a selection made over another value
 * for good, and a parent's pending commit ends, whether the render took it or not.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 * @param state - The session.
 * @param committed - The committed value now.
 * @returns The session, the same object while the key stays the same and nothing is pending.
 */
export function follow<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>,
  committed: PickerCommitted<C>
): PickerSessionState<V, C, R> {
  if (committed.basis === state.basis) {
    return settle(state);
  }
  const held = state.held?.basis === committed.basis ? state.held : null;
  return { ...state, value: committed.value, basis: committed.basis, pending: null, held };
}

/**
 * Ends a parent's pending commit at the end of its task, for a parent that declines it without
 * rendering.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @returns The session with nothing pending, the same object when nothing was.
 */
export function settle<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>
): PickerSessionState<V, C, R> {
  return state.pending === null ? state : { ...state, pending: null };
}

/**
 * Applies a commit the Root's `onValueChange` accepted. The picker's own value follows it at once,
 * and a parent's is pending until the parent renders. What the session held stays, and lapses when
 * the value moves off its basis.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 * @param state - The session.
 * @param committed - The value committed.
 * @param owner - Who applies it.
 * @returns The session.
 */
export function commit<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>,
  committed: PickerCommitted<C>,
  owner: PickerValueOwner
): PickerSessionState<V, C, R> {
  return owner === "picker" ? follow(state, committed) : { ...state, pending: committed };
}

/**
 * Applies a commit, as {@link commit} does, and holds `held` over the committed value, or nothing. The
 * selection belongs to the value committed, so a parent that renders it keeps the selection, and
 * one that declines it never shows it.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 * @param state - The session.
 * @param committed - The value committed.
 * @param owner - Who applies it.
 * @param held - What the picker holds over it, or `null`.
 * @returns The session.
 */
export function commitHolding<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>,
  committed: PickerCommitted<C>,
  owner: PickerValueOwner,
  held: V | null
): PickerSessionState<V, C, R> {
  // The commit leaves `committed` as the value a gesture builds on, which `hold` keys on.
  const next = commit(state, committed, owner);
  if (held !== null) {
    return hold(next, held, null);
  }
  return next.held === null ? next : { ...next, held: null };
}

/**
 * Applies an open change, dropping the held selection on close: a close either committed it or, for a
 * half-typed range, leaves it to the inputs that show it.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @param open - The new open state.
 * @returns The session.
 */
export function opened<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>,
  open: boolean
): PickerSessionState<V, C, R> {
  if (open) {
    return { ...state, open };
  }
  const keeps = (state.held?.finalizeOnClose ?? null) === null;
  return { ...state, open, held: keeps ? state.held : null };
}

/**
 * Applies a native form reset. The session then has the given committed value, holds nothing and
 * has a new generation, which the calendars start over by.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 * @param state - The session.
 * @param committed - The value the reset leaves: the picker's default, or the parent's value.
 * @returns The session.
 */
export function resetPickerSession<V, C, R extends string = string>(
  state: PickerSessionState<V, C, R>,
  committed: PickerCommitted<C>
): PickerSessionState<V, C, R> {
  return {
    ...state,
    value: committed.value,
    basis: committed.basis,
    pending: null,
    held: null,
    generation: state.generation + 1,
  };
}
