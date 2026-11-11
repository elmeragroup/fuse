/**
 * A test's handle on a harness parent's state setter, for a change no control on the page makes,
 * such as data that arrives while a popup is open. A click on a button outside the popup would be
 * an outside press, which closes it. The harness binds its setter from an effect; the test sets.
 */
export type ParentHandle<T> = {
  /** Called by the harness, from an effect, with its state setter. */
  readonly bind: (setter: (value: T) => void) => void;
  /** Sets the parent's state, as the parent itself would. */
  readonly set: (value: T) => void;
};

/**
 * Creates a handle on a harness parent's state setter.
 *
 * @returns The handle: the harness calls `bind` from an effect, the test calls `set`.
 */
export function parentHandle<T>(): ParentHandle<T> {
  let setter: ((value: T) => void) | undefined;
  return {
    bind: (next) => {
      setter = next;
    },
    set: (value) => {
      if (setter === undefined) {
        throw new Error("expected the harness to have bound its setter");
      }
      setter(value);
    },
  };
}
