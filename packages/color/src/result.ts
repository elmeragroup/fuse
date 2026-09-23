/**
 * The result every fallible function in this package returns. The package has no
 * dependencies, so it owns this small tagged union rather than importing one; the `effect`
 * subpath converts it to Effect's `Result` for Effect programs. Only the package constructs
 * results, so this public module exports the types and `getOrThrow` and keeps the
 * constructors in an internal module.
 */

/** A success carrying its value. */
export type Ok<T> = { readonly _tag: "ok"; readonly value: T };

/** A failure carrying its error. */
export type Err<E extends Error> = { readonly _tag: "err"; readonly error: E };

/**
 * A value or the error that prevented it.
 *
 * @template T - The success value.
 * @template E - The failure, a tagged error.
 */
export type Result<T, E extends Error> = Ok<T> | Err<E>;

/**
 * Unwrap a result where a failure means a defect, such as a color literal in source code
 * that does not parse.
 *
 * @template T - The success value.
 * @template E - The failure.
 * @param result - The result to unwrap.
 * @returns The success value.
 * @throws The failure's error, which is a defect at this call site.
 */
export function getOrThrow<T, E extends Error>(result: Result<T, E>): T {
  if (result._tag === "err") {
    throw result.error;
  }
  return result.value;
}
