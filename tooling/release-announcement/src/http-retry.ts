/**
 * How the GitHub and Slack adapters repeat a read: the one retry policy both share, and the
 * failures it decides on. A read changes nothing, so a read that got no answer, a rate limit or a
 * server error is worth repeating. A post is never repeated, and does not use this module.
 *
 * Each attempt, from the request to the last byte of the body, runs under one timeout, so a server
 * that sends its headers and then stalls counts as unanswered. A wait the server asks for, through
 * `Retry-After` (whole seconds or an HTTP date) or GitHub's rate-limit reset, is honoured up to
 * `MAX_WAIT`; a longer one fails at once and names the wait. Without one, attempts back off
 * exponentially. The whole read, attempts and waits together, ends by `RETRY_BUDGET`: a wait that
 * would end past it is not begun, and an attempt still running at it is stopped.
 */

import { Clock, Config, Duration, Effect, Option, Result, Schedule, Schema } from "effect";
import { Headers } from "effect/http";
import type { HttpClientError, HttpClientResponse } from "effect/http";

/** Retries after the first attempt. */
const RETRIES = 3;

/** The longest wait a server may ask for before a retry. */
const MAX_WAIT = Duration.seconds(60);

/** How long the retries of one read may take in all. */
const RETRY_BUDGET = Duration.minutes(2);

/** An attempt at a read that failed. */
export type AttemptFailure =
  /** No whole answer arrived: the connection failed, or the answer did not finish in time. */
  | { readonly _tag: "Unanswered"; readonly reason: string }
  /** A rate limit or a server error, with the wait the server asked for, if any. */
  | { readonly _tag: "Throttled"; readonly status: number; readonly wait: Option.Option<Duration.Duration> }
  /** An answer that repeating the read would not change, such as 401. */
  | { readonly _tag: "Rejected"; readonly status: number };

/** A read that failed: its last attempt's failure, or a wait it would not begin. */
export type ReadFailure =
  | AttemptFailure
  /**
   * A rate limit or server error whose wait is longer than `MAX_WAIT` (`wait-cap`) or would end
   * past the read's `RETRY_BUDGET` (`budget`).
   */
  | {
      readonly _tag: "WaitRefused";
      readonly status: number;
      readonly wait: Duration.Duration;
      readonly bound: "wait-cap" | "budget";
    };

/** What to do about a failed attempt, decided once from its failure. */
type RetryDecision =
  | { readonly _tag: "RetryAfter"; readonly wait: Duration.Duration }
  | { readonly _tag: "Backoff" }
  | { readonly _tag: "DoNotRetry" };

function decide(failure: AttemptFailure): RetryDecision {
  if (failure._tag === "Rejected") return { _tag: "DoNotRetry" };
  if (failure._tag === "Unanswered") return { _tag: "Backoff" };
  return Option.match(failure.wait, {
    onNone: () => ({ _tag: "Backoff" }),
    onSome: (wait) =>
      Duration.isGreaterThan(wait, MAX_WAIT) ? { _tag: "DoNotRetry" } : { _tag: "RetryAfter", wait },
  });
}

/**
 * Why a read failed, for its error message.
 *
 * @param failure - The read's failure.
 * @returns A short explanation, such as `answered 502` or a wait too long to honour.
 */
export function describe(failure: ReadFailure): string {
  switch (failure._tag) {
    case "Unanswered":
      return `could not be read (${failure.reason})`;
    case "Rejected":
    case "Throttled":
      return `answered ${String(failure.status)}`;
    case "WaitRefused": {
      const asked = `answered ${String(failure.status)} and asked to wait ${Duration.format(failure.wait)}`;
      return failure.bound === "wait-cap"
        ? `${asked}, longer than the ${Duration.format(MAX_WAIT)} it is waited`
        : `${asked}, past the ${Duration.format(RETRY_BUDGET)} a read may take`;
    }
  }
}

/** GitHub's `x-ratelimit-reset`: epoch seconds, written as whole digits. */
const ResetSeconds = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d+$/u)),
  Schema.decodeTo(Schema.NumberFromString)
);

/**
 * The wait a response asks for, measured on the Effect clock: its `Retry-After`, as whole seconds
 * or an HTTP date, read by Effect's own parser, which rejects fractional and exponent forms; or,
 * when GitHub's rate limit is spent, the time left until `x-ratelimit-reset`. A date already past
 * asks for no wait. A malformed value asks for none, so the read backs off.
 *
 * @param headers - The response's headers.
 * @returns The wait, or none when the response names none.
 */
export const requestedWait = Effect.fnUntraced(function* (headers: Headers.Headers) {
  const now = yield* Clock.currentTimeMillis;
  const retryAfter = Option.flatMap(Option.fromNullishOr(headers["retry-after"]), (value) =>
    Result.getSuccess(Headers.parseRetryAfter(value))
  );
  if (Option.isSome(retryAfter)) return Option.some(Headers.retryAfterDelay(retryAfter.value, now));
  if (headers["x-ratelimit-remaining"] !== "0") return Option.none();
  return Option.map(Schema.decodeUnknownOption(ResetSeconds)(headers["x-ratelimit-reset"]), (reset) =>
    Duration.millis(Math.max(0, reset * 1000 - now))
  );
});

/**
 * How long one attempt may take, from the request to the end of its body: `HTTP_TIMEOUT`, 30
 * seconds unless set.
 */
export const attemptTimeout = Config.Duration("HTTP_TIMEOUT").pipe(Config.withDefault(Duration.seconds(30)));

/**
 * Bounds one attempt by `timeout`, failing with `onTimeout` when it runs out.
 *
 * @param timeout - How long the attempt may take.
 * @param onTimeout - The failure of an attempt that ran out of time, given the timeout's text.
 * @returns The bounded attempt.
 */
export function withinTimeout<F>(
  timeout: Duration.Duration,
  onTimeout: (within: string) => F
): <A, E, R>(attempt: Effect.Effect<A, E, R>) => Effect.Effect<A, E | F, R> {
  return (attempt) =>
    attempt.pipe(
      Effect.timeoutOrElse({
        duration: timeout,
        orElse: () => Effect.fail(onTimeout(`no answer within ${Duration.format(timeout)}`)),
      })
    );
}

/** A failure in transit, or while the body was read, as an unanswered attempt. */
function unanswered(error: HttpClientError.HttpClientError): AttemptFailure {
  return { _tag: "Unanswered", reason: error.reason._tag };
}

/** How `readJson` reads. */
type JsonRead = {
  /** What is read, for the retry warnings, such as `Slack conversations.history`. */
  readonly read: string;
  /** How long one attempt may take. */
  readonly timeout: Duration.Duration;
  /** Whether a response is a rate limit or server error, which a later attempt may not meet. */
  readonly throttled: (response: HttpClientResponse.HttpClientResponse) => boolean;
};

/**
 * Reads a JSON answer under the shared retry policy. Each attempt sends `request`, fails as
 * `Throttled` with its requested wait when `throttled` says so, as `Rejected` on any other status
 * but 200, and reads the body within the attempt's timeout, so a stall while it arrives counts as
 * unanswered.
 *
 * @param request - The request, sent once per attempt.
 * @param options - What is read, the attempt timeout and the throttle test.
 * @returns The answer's JSON, or the read's failure.
 */
export function readJson<R>(
  request: Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError, R>,
  options: JsonRead
): Effect.Effect<unknown, ReadFailure, R> {
  return Effect.gen(function* () {
    const response = yield* request.pipe(Effect.mapError(unanswered));
    if (options.throttled(response)) {
      const wait = yield* requestedWait(response.headers);
      return yield* Effect.fail<AttemptFailure>({ _tag: "Throttled", status: response.status, wait });
    }
    if (response.status !== 200)
      return yield* Effect.fail<AttemptFailure>({ _tag: "Rejected", status: response.status });
    return yield* response.json.pipe(Effect.mapError(unanswered));
  }).pipe(
    withinTimeout(options.timeout, (reason): AttemptFailure => ({ _tag: "Unanswered", reason })),
    retryReads(options.read)
  );
}

/**
 * Repeats a read while its failure is worth another try, as often as `RETRIES`, waiting as long
 * as the server asks or backing off from a second, and ends the whole read by `RETRY_BUDGET`. A
 * requested wait longer than `MAX_WAIT`, or one that would end past the budget, fails the read as
 * `WaitRefused` at once. Each retry logs a warning naming the read.
 *
 * @param read - What is read, for the warnings, such as `Slack conversations.history`.
 * @returns The retried read, failing with its last failure.
 */
export function retryReads(
  read: string
): <A, R>(attempt: Effect.Effect<A, AttemptFailure, R>) => Effect.Effect<A, ReadFailure, R> {
  const budget = Duration.toMillis(RETRY_BUDGET);
  return (attempt) =>
    Effect.gen(function* () {
      const start = yield* Clock.currentTimeMillis;
      /** The failure the read ends with, once no retry follows `failure` at `now`. */
      const final = (failure: AttemptFailure, now: number): ReadFailure => {
        if (failure._tag !== "Throttled" || Option.isNone(failure.wait)) return failure;
        const wait = failure.wait.value;
        const refused = (bound: "wait-cap" | "budget"): ReadFailure => ({
          _tag: "WaitRefused",
          status: failure.status,
          wait,
          bound,
        });
        if (Duration.isGreaterThan(wait, MAX_WAIT)) return refused("wait-cap");
        if (now - start + Duration.toMillis(wait) > budget) return refused("budget");
        return failure;
      };
      const schedule = Schedule.exponential("1 second").pipe(
        Schedule.setInputType<AttemptFailure>(),
        Schedule.upTo({ times: RETRIES }),
        Schedule.modifyDelay(({ input, duration }) => {
          const decision = decide(input);
          return Effect.succeed(decision._tag === "RetryAfter" ? decision.wait : duration);
        }),
        // A retry is begun only when its wait ends within the budget; each one is logged.
        Schedule.while(({ input, now, attempt, duration }) => {
          const retry =
            decide(input)._tag !== "DoNotRetry" && now - start + Duration.toMillis(duration) <= budget;
          return retry
            ? Effect.logWarning(
                `${read} ${describe(input)}; retry ${String(attempt)} of ${String(RETRIES)} in ${Duration.format(duration)}.`
              ).pipe(Effect.as(true))
            : Effect.succeed(false);
        })
      );
      return yield* attempt.pipe(
        Effect.retry(schedule),
        Effect.catch((failure) =>
          Effect.gen(function* () {
            return yield* Effect.fail(final(failure, yield* Clock.currentTimeMillis));
          })
        ),
        // An attempt still running when the budget ends is stopped.
        Effect.timeoutOrElse({
          duration: RETRY_BUDGET,
          orElse: () =>
            Effect.fail<ReadFailure>({
              _tag: "Unanswered",
              reason: `no whole answer within the ${Duration.format(RETRY_BUDGET)} a read may take`,
            }),
        })
      );
    });
}
