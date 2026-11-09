// The Temporal core's own Result. It matches `@elmeragroup/color/result`'s shape, so tests can
// unwrap it with that package's `getOrThrow`. But Fuse's published declarations may not import
// `@elmeragroup/color`, a dev dependency, and the date components' types reach this module.

/** A success carrying its value. */
export type Ok<T> = { readonly _tag: "ok"; readonly value: T };

/** A failure carrying its error. */
export type Err<E extends Error> = { readonly _tag: "err"; readonly error: E };

/**
 * The outcome of an operation whose failure is expected: a value, or a tagged error the caller
 * handles or returns upward.
 *
 * @template T - The success value.
 * @template E - The expected error.
 */
export type Result<T, E extends Error> = Ok<T> | Err<E>;

/**
 * A successful result.
 *
 * @template T - The success value.
 * @param value - The value.
 * @returns The value as an `ok` result.
 */
export function ok<T>(value: T): Ok<T> {
  return { _tag: "ok", value };
}

/**
 * A failed result.
 *
 * @template E - The expected error.
 * @param error - The error.
 * @returns The error as an `err` result.
 */
export function err<E extends Error>(error: E): Err<E> {
  return { _tag: "err", error };
}
