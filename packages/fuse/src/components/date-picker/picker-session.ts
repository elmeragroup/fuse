// A picker's edit session: the one owner of what a picker holds between its committed value and the
// user, for both date pickers. Pure transitions over an immutable state, which
// `use-picker-session.ts` applies to Calendar's synchronous store.
//
// - `held` is a selection the picker shows without having committed it: a day picked in an empty
//   time picker that stays open, a range picked in an empty time range picker that stays open, or a
//   half-typed range. It carries the committed value's `basis` it was made over; once the committed
//   value changes it is dropped for good (`rebase`), so a value restored later never resurrects it,
//   as a draft DateInput keeps over its committed value. `finalizeOnClose` marks a selection the
//   close commits.
// - `open` is the popup's own open state, read while the parent does not own it.
// - `generation` counts form resets. The calendars key their view by it, so the view starts over,
//   and a range's end recognizes a reset's commit by it. The inputs reset themselves through the
//   session; see `date-input-reset.ts`.

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
 * A picker's edit session.
 *
 * @template V - What the picker holds.
 */
export type PickerSessionState<V, R extends string = string> = {
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
 * @param open - Whether the popup starts open.
 * @returns The session.
 */
export function initialPickerSession<V, R extends string = string>(open: boolean): PickerSessionState<V, R> {
  return { open, held: null, generation: 0 };
}

/**
 * The held selection while it still belongs to the committed value, else `null`.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @param basis - The committed value's key now.
 * @returns The selection, or `null`.
 */
export function heldFor<V, R extends string = string>(
  state: PickerSessionState<V, R>,
  basis: string
): PickerHeld<V, R> | null {
  return state.held?.basis === basis ? state.held : null;
}

/**
 * Holds a selection over the committed value.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @param held - The selection.
 * @returns The session holding it.
 */
export function hold<V, R extends string = string>(
  state: PickerSessionState<V, R>,
  held: PickerHeld<V, R>
): PickerSessionState<V, R> {
  return { ...state, held };
}

/**
 * Drops the held selection.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @returns The session holding nothing.
 */
export function release<V, R extends string = string>(
  state: PickerSessionState<V, R>
): PickerSessionState<V, R> {
  return state.held === null ? state : { ...state, held: null };
}

/**
 * Follows a new committed value: a selection made over another value is dropped for good.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @param basis - The committed value's key now.
 * @returns The session, the same object when nothing changes.
 */
export function rebase<V, R extends string = string>(
  state: PickerSessionState<V, R>,
  basis: string
): PickerSessionState<V, R> {
  return state.held !== null && state.held.basis !== basis ? { ...state, held: null } : state;
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
export function opened<V, R extends string = string>(
  state: PickerSessionState<V, R>,
  open: boolean
): PickerSessionState<V, R> {
  if (open) {
    return { ...state, open };
  }
  const keeps = (state.held?.finalizeOnClose ?? null) === null;
  return { ...state, open, held: keeps ? state.held : null };
}

/**
 * Applies a native form reset. The session then holds nothing and has a new generation, which the
 * calendars start over by.
 *
 * @template V - What the picker holds.
 * @param state - The session.
 * @returns The session.
 */
export function resetPickerSession<V, R extends string = string>(
  state: PickerSessionState<V, R>
): PickerSessionState<V, R> {
  return { ...state, held: null, generation: state.generation + 1 };
}
