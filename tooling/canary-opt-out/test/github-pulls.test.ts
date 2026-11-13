import { assert, describe, it } from "@effect/vitest";
import { Clock, ConfigProvider, Context, Duration, Effect, Exit, Fiber, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { AssociatedPulls, CommitSha } from "../src/canary-decision.ts";
import * as GitHubPulls from "../src/github-pulls.ts";

// Unit under test: the GitHub lookup layer's retries, on the test clock, against a stand-in
// HttpClient that answers by the virtual time of each request. Oracle: GitHub's guidance for a rate
// limit that names no wait, a secondary rate limit
// (https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#handle-rate-limit-errors-appropriately):
// wait at least a minute before retrying, and exponentially longer while it continues. A server
// error is no rate limit, so it keeps a short backoff.

const SHA = Schema.decodeUnknownSync(CommitSha)("b".repeat(40));

/** GitHub's answer once it recovers: the commit's PR, opted out. */
const HEALTHY = JSON.stringify([
  { number: 661, merge_commit_sha: SHA, head: { ref: "feature" }, labels: [{ name: "no-canary" }] },
]);

/**
 * Runs one lookup against a GitHub that answers `status` with `headers` (by default none, so no
 * wait) to every request made before `healthyAt` of virtual time, and the healthy list after it. Returns the running lookup
 * and the virtual times of the requests it has made so far.
 */
const lookupAgainst = (
  status: number,
  healthyAt: Duration.Input,
  headers: Readonly<Record<string, string>> = {}
) =>
  Effect.gen(function* () {
    const requests: number[] = [];
    const client = HttpClient.make((request) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        requests.push(now);
        const healthy = now >= Duration.toMillis(Duration.fromInputUnsafe(healthyAt));
        return HttpClientResponse.fromWeb(
          request,
          healthy ? new Response(HEALTHY, { status: 200 }) : new Response(null, { status, headers })
        );
      })
    );
    const pulls = yield* Layer.build(
      GitHubPulls.layer.pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({ GITHUB_REPOSITORY: "elmeragroup/fuse", GH_TOKEN: "test-token" })
          )
        )
      )
    );
    const lookup = yield* Effect.forkChild(Context.get(pulls, AssociatedPulls).of(SHA));
    // Let the first attempt run at virtual time zero.
    yield* TestClock.adjust(0);
    return { lookup, requests };
  });

/** The virtual times, in seconds, of the requests made so far. */
const seconds = (requests: ReadonlyArray<number>) => requests.map((millis) => millis / 1000);

describe("GitHub's associated-PR lookup", () => {
  it.effect("waits at least a minute after a rate limit that names no wait", () =>
    Effect.gen(function* () {
      const { lookup, requests } = yield* lookupAgainst(429, "1 second");
      yield* TestClock.adjust("59 seconds");
      assert.deepStrictEqual(seconds(requests), [0]);
      yield* TestClock.adjust("1 second");
      assert.deepStrictEqual(seconds(requests), [0, 60]);
      const pulls = yield* Fiber.join(lookup);
      assert.deepStrictEqual(
        pulls.map((pull) => pull.number),
        [661]
      );
    })
  );

  it.effect("waits exponentially longer while a secondary rate limit continues, then recovers", () =>
    Effect.gen(function* () {
      // GitHub stays rate limited for four minutes, past three fixed one-minute waits.
      const { lookup, requests } = yield* lookupAgainst(429, "4 minutes");
      yield* TestClock.adjust("10 minutes");
      const sent = seconds(requests);
      const gaps = sent.slice(1).map((time, index) => time - (sent[index] ?? 0));
      assert.isAtLeast(gaps[0] ?? 0, 60);
      for (let index = 1; index < gaps.length; index += 1) {
        assert.isAtLeast(gaps[index] ?? 0, 2 * (gaps[index - 1] ?? 0), `gaps ${gaps.join(", ")}`);
      }
      const pulls = yield* Fiber.join(lookup);
      assert.deepStrictEqual(
        pulls.map((pull) => pull.number),
        [661]
      );
    })
  );

  // GitHub's guidance fixes the waits at one minute, doubled for each further retry, and the lookup
  // gives up after three retries, which the merge workflow's 15-minute job timeout is sized from.
  it.effect("gives up on a continued secondary rate limit after retrying at 1, 2 and 4 minutes", () =>
    Effect.gen(function* () {
      const { lookup, requests } = yield* lookupAgainst(429, "1 day");
      yield* TestClock.adjust("1 hour");
      assert.deepStrictEqual(seconds(requests), [0, 60, 180, 420]);
      assert.isTrue(Exit.isFailure(yield* Fiber.await(lookup)));
    })
  );

  it.effect("fails at once when GitHub asks for a wait longer than a minute", () =>
    Effect.gen(function* () {
      const { lookup, requests } = yield* lookupAgainst(429, "1 day", { "retry-after": "61" });
      yield* TestClock.adjust("1 hour");
      assert.deepStrictEqual(seconds(requests), [0]);
      assert.isTrue(Exit.isFailure(yield* Fiber.await(lookup)));
    })
  );

  it.effect("gives up on a continued server error after retrying at 1, 2 and 4 seconds", () =>
    Effect.gen(function* () {
      const { lookup, requests } = yield* lookupAgainst(502, "1 day");
      yield* TestClock.adjust("1 hour");
      assert.deepStrictEqual(seconds(requests), [0, 1, 3, 7]);
      assert.isTrue(Exit.isFailure(yield* Fiber.await(lookup)));
    })
  );

  it.effect("retries a server error that names no wait within seconds", () =>
    Effect.gen(function* () {
      const { lookup, requests } = yield* lookupAgainst(502, "1 second");
      yield* TestClock.adjust("5 seconds");
      assert.strictEqual(requests.length, 2);
      const pulls = yield* Fiber.join(lookup);
      assert.deepStrictEqual(
        pulls.map((pull) => pull.number),
        [661]
      );
    })
  );
});
