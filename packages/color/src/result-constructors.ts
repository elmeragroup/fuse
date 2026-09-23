/**
 * The constructors for this package's `Result`. The package exports no subpath for this
 * module, so only its own parsers and smart constructors build results.
 */

import type { Err, Ok } from "./result.ts";

/**
 * Wrap a value as a success.
 *
 * @template T - The success value.
 * @param value - The value.
 * @returns The success.
 */
export function ok<T>(value: T): Ok<T> {
  return { _tag: "ok", value };
}

/**
 * Wrap an error as a failure.
 *
 * @template E - The failure.
 * @param error - The error.
 * @returns The failure.
 */
export function err<E extends Error>(error: E): Err<E> {
  return { _tag: "err", error };
}
