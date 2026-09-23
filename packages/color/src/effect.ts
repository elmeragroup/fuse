/**
 * The package's Effect adapter. The workspace asked for a color package that Effect code uses
 * natively, and this module is that boundary. It converts the core's own `Result` to Effect's
 * `Result` or to an `Effect`, whose failures `catchTag` recovers by tag. The Figma sync reads
 * token colors through `toResult`. Only this module imports `effect`, so a browser page that
 * parses colors does not load it.
 */

import { Effect, Result } from "effect";

import type * as ColorResult from "./result.ts";

/**
 * Convert a color result to Effect's `Result`, for code that composes with Effect's `Result`
 * combinators.
 *
 * @template T - The success value.
 * @template E - The failure, a tagged error.
 * @param result - A result from a parser or a smart constructor.
 * @returns The same outcome as Effect's `Result`.
 */
export function toResult<T, E extends Error>(result: ColorResult.Result<T, E>): Result.Result<T, E> {
  return result._tag === "ok" ? Result.succeed(result.value) : Result.fail(result.error);
}

/**
 * Lift a color result into an Effect that succeeds with the value or fails with the error.
 *
 * @template T - The success value.
 * @template E - The failure, a tagged error.
 * @param result - A result from a parser or a smart constructor.
 * @returns An Effect with the same outcome, so `yield*` works in `Effect.gen`.
 */
export function toEffect<T, E extends Error>(result: ColorResult.Result<T, E>): Effect.Effect<T, E> {
  return result._tag === "ok" ? Effect.succeed(result.value) : Effect.fail(result.error);
}
