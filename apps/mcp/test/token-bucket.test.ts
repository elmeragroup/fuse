import { describe, expect, it } from "vitest";

import * as TokenBucket from "../src/token-bucket.ts";

// Unit under test: the token bucket. Oracle: its definition. A bucket holds at most `burst`
// tokens, gains `refillPerSecond` each second, and each admitted call takes one. The HTTP suite
// covers a drained bucket answering 429; refilling needs a clock it cannot move.

const limits = { refillPerSecond: 2, burst: 3 };

/** Takes a token at each instant, in order, and returns whether each call was admitted. */
function admissions(instants: readonly number[]): boolean[] {
  let bucket = TokenBucket.full(limits, 0);
  return instants.map((now) => {
    const outcome = TokenBucket.take(bucket, limits, now);
    bucket = outcome.bucket;
    return outcome.admitted;
  });
}

describe("token bucket", () => {
  it("admits a burst at once, then refuses until a token refills", () => {
    expect(admissions([0, 0, 0, 0, 499, 500])).toEqual([true, true, true, false, false, true]);
  });

  it("holds no more than the burst after a long idle", () => {
    expect(admissions([0, 0, 0, 3_600_000, 3_600_000, 3_600_000, 3_600_000])).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it("tells a refused caller the whole seconds until the next token", () => {
    const slow = { refillPerSecond: 0.25, burst: 1 };
    const drained = TokenBucket.take(TokenBucket.full(slow, 0), slow, 0).bucket;
    const refused = TokenBucket.take(drained, slow, 1_000);
    expect(refused.admitted).toBe(false);
    expect(TokenBucket.secondsUntilToken(refused.bucket, slow)).toBe(3);
  });
});
