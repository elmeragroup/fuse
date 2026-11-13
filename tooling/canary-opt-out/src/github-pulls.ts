/**
 * Each commit's associated PRs through GitHub's REST API,
 * `GET /repos/{owner}/{repo}/commits/{sha}/pulls`. Only the fields the decision reads are
 * decoded.
 *
 * A read changes nothing, so an attempt that got no whole answer (a failure in transit, a body cut
 * off, or no answer within `ATTEMPT_TIMEOUT`), a rate limit or a server error is tried again, up
 * to `RETRIES` times. A rate limit is 429, or GitHub's 403 with `Retry-After` or a spent
 * `x-ratelimit-remaining`
 * (https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#rate-limit-errors).
 * The wait it names, through `Retry-After` or `x-ratelimit-reset`, is honoured up to `MAX_WAIT`;
 * a longer one fails at once. A rate limit that names no wait is a secondary rate limit, which
 * GitHub asks to wait at least a minute before retrying, and exponentially longer while it
 * continues
 * (https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#handle-rate-limit-errors-appropriately),
 * so it waits `SECONDARY_RATE_LIMIT_WAIT`, then twice and four times that. A failure in transit, a
 * timeout or a server error that names no wait backs off exponentially from a second. Any other
 * answer, a plain 403 among them, fails at once, and so does a whole body that is not a PR list: a
 * repeat would read the same.
 *
 * One lookup therefore takes at most 4 attempts of `ATTEMPT_TIMEOUT` and waits of 1, 2 and 4
 * minutes: 9 minutes. The merge workflow gives the job 15, room for the install and one throttled
 * lookup; later lookups in the same push meet the lifted limit. A push that stays rate limited past
 * the job's timeout fails the job, which skips publication visibly, as a failed lookup does.
 *
 * Requests go only to the repository's path under `GITHUB_API_URL`, which must be https (or http
 * to a loopback stand-in), so the token goes nowhere else.
 */

import { Clock, Config, Duration, Effect, Layer, Option, Result, Schedule, Schema } from "effect";
import { Headers, HttpClient, HttpClientRequest, Url } from "effect/http";
import type { HttpClientResponse } from "effect/http";

import { AssociatedPulls, PullsUnavailable } from "./canary-decision.ts";
import type { CommitSha } from "./canary-decision.ts";

/**
 * The product name every request carries, since GitHub refuses a request without a User-Agent
 * (https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#user-agent-required).
 */
const USER_AGENT = "elmeragroup-fuse-canary-opt-out";

/** The hosts a test server listens on, which alone may be reached over plain http. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

/** An `owner/name` repository, as `GITHUB_REPOSITORY` names it; neither part is `.` or `..`. */
const Repository = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^(?!\.{1,2}\/)[\w.-]+\/(?!\.{1,2}$)[\w.-]+$/u, { message: "an owner/name repository" })
  )
);

/** Retries after the first attempt. */
const RETRIES = 3;

/** The longest wait GitHub may ask for before a retry. */
const MAX_WAIT = Duration.seconds(60);

/**
 * The first wait before retrying a rate limit that names none: GitHub's minimum of a minute. Each
 * further retry doubles it.
 */
const SECONDARY_RATE_LIMIT_WAIT = Duration.minutes(1);

/** How long one attempt may take, from the request to the end of its body. */
const ATTEMPT_TIMEOUT = Duration.seconds(30);

/** The fields of GitHub's associated-PR list that the decision reads. */
const GitHubPulls = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      number: Schema.Number,
      merge_commit_sha: Schema.NullOr(Schema.String),
      head: Schema.Struct({ ref: Schema.String }),
      labels: Schema.Array(Schema.Struct({ name: Schema.String })),
    })
  )
);

/** An attempt at a read that failed. */
type AttemptFailure =
  /** No whole answer arrived. */
  | { readonly _tag: "Unanswered"; readonly reason: string }
  /** A rate limit or a server error, with the wait GitHub asked for, if any. */
  | {
      readonly _tag: "Throttled";
      readonly kind: "RateLimit" | "ServerError";
      readonly status: number;
      readonly wait: Option.Option<Duration.Duration>;
    }
  /** An answer that repeating the read would not change. */
  | { readonly _tag: "Rejected"; readonly status: number };

/** Whether an answer is a rate limit or a server error, which a later attempt may not meet. */
function isThrottled(response: HttpClientResponse.HttpClientResponse): boolean {
  if (response.status === 429 || response.status >= 500) return true;
  return (
    response.status === 403 &&
    (response.headers["retry-after"] !== undefined || response.headers["x-ratelimit-remaining"] === "0")
  );
}

/** GitHub's `x-ratelimit-reset`: epoch seconds, written as whole digits. */
const ResetSeconds = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d+$/u)),
  Schema.decodeTo(Schema.NumberFromString)
);

/**
 * The wait an answer asks for: its `Retry-After`, or the time left until `x-ratelimit-reset` when
 * the rate limit is spent. A malformed value asks for none, so the read backs off.
 */
const requestedWait = Effect.fnUntraced(function* (headers: Headers.Headers) {
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
 * How long to wait before retry `attempt` (from 1) after `failure`, or none when it is not worth
 * another. A wait GitHub asked for is honoured up to `MAX_WAIT`. A rate limit that names none waits
 * `SECONDARY_RATE_LIMIT_WAIT`, doubled for each further retry, as GitHub asks for continued
 * secondary rate limits; anything else that names none takes the schedule's `backoff`.
 */
function retryDelay(
  failure: AttemptFailure,
  attempt: number,
  backoff: Duration.Duration
): Option.Option<Duration.Duration> {
  if (failure._tag === "Rejected") return Option.none();
  if (failure._tag === "Unanswered") return Option.some(backoff);
  if (Option.isSome(failure.wait)) {
    return Duration.isGreaterThan(failure.wait.value, MAX_WAIT) ? Option.none() : failure.wait;
  }
  return Option.some(
    failure.kind === "RateLimit" ? Duration.times(SECONDARY_RATE_LIMIT_WAIT, 2 ** (attempt - 1)) : backoff
  );
}

/** Why a read failed, for its error message. */
function describe(failure: AttemptFailure): string {
  switch (failure._tag) {
    case "Unanswered":
      return `GitHub could not be read (${failure.reason})`;
    case "Rejected":
      return `GitHub answered ${String(failure.status)}`;
    case "Throttled":
      return Option.match(failure.wait, {
        onNone: () => `GitHub answered ${String(failure.status)}`,
        onSome: (wait) =>
          `GitHub answered ${String(failure.status)} and asked to wait ${Duration.format(wait)}`,
      });
  }
}

/**
 * Repeats an attempt while its failure is worth another, waiting as long as GitHub asks or
 * backing off from a second, and logs each retry.
 */
const retryReads = <A, R>(read: string, attempt: Effect.Effect<A, AttemptFailure, R>) =>
  attempt.pipe(
    Effect.retry(
      Schedule.exponential("1 second").pipe(
        Schedule.setInputType<AttemptFailure>(),
        Schedule.upTo({ times: RETRIES }),
        Schedule.modifyDelay(({ input, attempt: retry, duration }) =>
          Effect.succeed(Option.getOrElse(retryDelay(input, retry, duration), () => duration))
        ),
        Schedule.while(({ input, attempt: retry, duration }) =>
          Option.isSome(retryDelay(input, retry, duration))
            ? Effect.logWarning(
                `${read}: ${describe(input)}; retry ${String(retry)} of ${String(RETRIES)} in ${Duration.format(duration)}.`
              ).pipe(Effect.as(true))
            : Effect.succeed(false)
        )
      )
    )
  );

/** `GITHUB_API_URL` is not an https URL, or an http one to a loopback host, without a query. */
class InvalidApiUrl extends Schema.TaggedError<InvalidApiUrl>()("InvalidApiUrl", {
  message: Schema.String,
}) {}

/** GitHub's API base URL, `https://api.github.com` unless `GITHUB_API_URL` is set. */
const apiUrl = Effect.gen(function* () {
  const value = yield* Config.String("GITHUB_API_URL").pipe(Config.withDefault("https://api.github.com"));
  const parsed = Url.fromString(value);
  const invalid = new InvalidApiUrl({
    message:
      "GITHUB_API_URL must be an https URL (or http to a loopback host) without credentials, query or fragment",
  });
  if (parsed._tag === "Failure") return yield* invalid;
  const url = parsed.success;
  const loopback = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  if ((url.protocol !== "https:" && !loopback) || url.username !== "" || url.password !== "")
    return yield* invalid;
  if (url.href !== `${url.origin}${url.pathname}`) return yield* invalid;
  return url;
});

/**
 * Reads associated PRs with `GH_TOKEN` from the repository `GITHUB_REPOSITORY` names, at
 * `GITHUB_API_URL`.
 */
export const layer = Layer.effect(
  AssociatedPulls,
  Effect.gen(function* () {
    const api = yield* apiUrl;
    const repository = yield* Config.schema(Repository, "GITHUB_REPOSITORY");
    const token = yield* Config.Redacted("GH_TOKEN");
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.setHeader("accept", "application/vnd.github+json"),
          HttpClientRequest.setHeader("x-github-api-version", "2022-11-28"),
          HttpClientRequest.setHeader("user-agent", USER_AGENT)
        )
      )
    );

    const of = Effect.fn("GitHubPulls.of")(function* (sha: CommitSha) {
      yield* Effect.annotateCurrentSpan({ sha });
      const unavailable = (reason: string) =>
        new PullsUnavailable({ message: `Could not read the PRs of ${sha}: ${reason}` });
      // The repository and SHA are path-safe by their patterns, so the URL stays under the base.
      const url = new URL(
        `${api.pathname.replace(/\/+$/u, "")}/repos/${repository}/commits/${sha}/pulls`,
        api.origin
      );
      // One attempt: the request and its whole body, within the attempt's timeout.
      const attempt = Effect.gen(function* () {
        const response = yield* client
          .get(url)
          .pipe(
            Effect.mapError((error): AttemptFailure => ({ _tag: "Unanswered", reason: error.reason._tag }))
          );
        if (isThrottled(response)) {
          return yield* Effect.fail<AttemptFailure>({
            _tag: "Throttled",
            kind: response.status >= 500 ? "ServerError" : "RateLimit",
            status: response.status,
            wait: yield* requestedWait(response.headers),
          });
        }
        if (response.status !== 200)
          return yield* Effect.fail<AttemptFailure>({ _tag: "Rejected", status: response.status });
        return yield* response.text.pipe(
          Effect.mapError((): AttemptFailure => ({ _tag: "Unanswered", reason: "the body was cut off" }))
        );
      }).pipe(
        Effect.timeoutOrElse({
          duration: ATTEMPT_TIMEOUT,
          orElse: () =>
            Effect.fail<AttemptFailure>({
              _tag: "Unanswered",
              reason: `no whole answer within ${Duration.format(ATTEMPT_TIMEOUT)}`,
            }),
        })
      );
      const body = yield* retryReads(`GitHub's PRs of ${sha}`, attempt).pipe(
        Effect.mapError((failure) => unavailable(describe(failure)))
      );
      // A whole body that is not a PR list would read the same again, so it fails at once.
      const pulls = yield* Schema.decodeUnknownEffect(GitHubPulls)(body).pipe(
        Effect.mapError(() => unavailable("the response is not a PR list"))
      );
      return pulls.map((pull) => ({
        number: pull.number,
        mergeCommitSha: pull.merge_commit_sha,
        headRef: pull.head.ref,
        labels: pull.labels.map((label) => label.name),
      }));
    });

    return AssociatedPulls.of({ of });
  })
);
