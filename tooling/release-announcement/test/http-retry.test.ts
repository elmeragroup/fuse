import { assert, describe, it } from "@effect/vitest";
import { Clock, DateTime, Duration, Effect, Fiber, Option } from "effect";
import { Headers } from "effect/http";
import { TestClock } from "effect/testing";

import { requestedWait, retryReads } from "../src/http-retry.ts";
import type { ReadFailure } from "../src/http-retry.ts";

// Unit under test: the read retry policy the GitHub and Slack adapters share, on the test clock.
// Oracles: RFC 9110's Retry-After (a delay in whole seconds, or an HTTP date), GitHub's rate-limit
// reset in epoch seconds, and the policy's stated bounds: a requested wait of at most a minute, and
// two minutes for the whole read, its attempts and waits together.

/** 2026-11-05T12:00:00Z, a whole second, so an HTTP date names it exactly. */
const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);

const waitFor = (headers: Readonly<Record<string, string>>) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(NOW);
    return Option.map(yield* requestedWait(Headers.fromInput(headers)), Duration.toMillis);
  });

const httpDate = (offsetMillis: number) => Headers.formatHttpDate(DateTime.makeUnsafe(NOW + offsetMillis));

describe("the wait a response asks for", () => {
  it.effect.each([
    { case: "a delay in whole seconds", headers: { "retry-after": "3" }, wait: Option.some(3000) },
    {
      case: "an HTTP date two seconds ahead",
      headers: { "retry-after": httpDate(2000) },
      wait: Option.some(2000),
    },
    {
      case: "an HTTP date two minutes ahead",
      headers: { "retry-after": httpDate(120_000) },
      wait: Option.some(120_000),
    },
    {
      case: "an HTTP date already past",
      headers: { "retry-after": httpDate(-60_000) },
      wait: Option.some(0),
    },
    { case: "a fractional delay", headers: { "retry-after": "1.5" }, wait: Option.none() },
    { case: "an exponent delay", headers: { "retry-after": "1e3" }, wait: Option.none() },
    { case: "a malformed value", headers: { "retry-after": "soon" }, wait: Option.none() },
    {
      case: "GitHub's reset of a spent rate limit",
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(NOW / 1000 + 5) },
      wait: Option.some(5000),
    },
    // GitHub writes the reset as whole epoch seconds; any other number form names no wait.
    {
      case: "a reset in exponent form",
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1e4" },
      wait: Option.none(),
    },
    {
      case: "a fractional reset",
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "3600.5" },
      wait: Option.none(),
    },
    {
      case: "GitHub's reset while requests remain",
      headers: { "x-ratelimit-remaining": "12", "x-ratelimit-reset": String(NOW / 1000 + 5) },
      wait: Option.none(),
    },
    {
      case: "a Retry-After beside a reset",
      headers: {
        "retry-after": "7",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(NOW / 1000 + 5),
      },
      wait: Option.some(7000),
    },
    { case: "no header", headers: {}, wait: Option.none() },
  ])("is read from $case", ({ headers, wait }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* waitFor(headers), wait);
    })
  );
});

/**
 * Runs a read whose every attempt takes `latency` and then fails with `failure`, on the test
 * clock, and returns when each attempt began and how the read ended.
 */
const retried = (latency: Duration.Input, failure: ReadFailure) =>
  Effect.gen(function* () {
    const started: number[] = [];
    const attempt = Effect.gen(function* () {
      started.push(yield* Clock.currentTimeMillis);
      yield* Effect.sleep(latency);
      return yield* Effect.fail(failure);
    });
    const fiber = yield* attempt.pipe(retryReads("the read"), Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("10 minutes");
    const ended = yield* Fiber.join(fiber);
    return { started, ended };
  });

describe("the read's budget", () => {
  it.effect("does not begin a wait that would end past two minutes", () =>
    Effect.gen(function* () {
      // The reviewer's probe: each answer takes 29 seconds and asks for a minute's wait. The
      // second wait would end at 178 seconds, so the read ends when the second answer arrives.
      const failure: ReadFailure = {
        _tag: "Throttled",
        status: 503,
        wait: Option.some(Duration.seconds(60)),
      };
      const { started, ended } = yield* retried("29 seconds", failure);
      assert.deepStrictEqual(started, [0, 89_000]);
      assert.deepStrictEqual(ended, { _tag: "OverBudget", status: 503, wait: Duration.seconds(60) });
    })
  );

  it.effect("stops an attempt still running when the two minutes end", () =>
    Effect.gen(function* () {
      const failure: ReadFailure = { _tag: "Throttled", status: 503, wait: Option.some(Duration.seconds(1)) };
      const { started, ended } = yield* retried("70 seconds", failure);
      assert.deepStrictEqual(started, [0, 71_000]);
      assert.deepStrictEqual(ended, {
        _tag: "Unanswered",
        reason: "no whole answer within the 2m a read may take",
      });
    })
  );

  it.effect("backs off from a second when no wait is asked for, three retries in all", () =>
    Effect.gen(function* () {
      const failure: ReadFailure = { _tag: "Unanswered", reason: "TransportError" };
      const { started, ended } = yield* retried("0 millis", failure);
      assert.deepStrictEqual(started, [0, 1000, 3000, 7000]);
      assert.deepStrictEqual(ended, failure);
    })
  );
});
