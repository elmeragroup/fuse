/**
 * A token bucket holds up to `burst` tokens and gains `refillPerSecond` tokens each second, and
 * each admitted call takes one. The server keeps one bucket per replica for every tool call, so it
 * bounds the CPU a replica spends on tools whoever sends the calls.
 *
 * The defaults, 50 calls a second with a burst of 200, come from what a call costs. On the full
 * catalog over localhost HTTP on Node 26, a `search_docs` call takes about 1.5 ms and a `read_doc`
 * of a 57,000-character section under 1 ms, so 50 calls a second hold tool work under a tenth of
 * one core, and the replica stays free for discovery, listing and health checks. One agent makes
 * a call every few seconds, and a burst of 200 absorbs dozens of agents that start at once or fan
 * out to subagents. The bucket is per replica, not per client address, because connector traffic
 * and office traffic arrive from shared addresses. A per-client limit belongs to the layer in front
 * of the server.
 */

/** How a bucket fills and how much it holds. */
export type Limits = {
  /** The tokens the bucket gains each second. */
  readonly refillPerSecond: number;
  /** The most tokens the bucket holds, and so the most calls it admits at once. */
  readonly burst: number;
};

/** The state of a bucket at one instant. */
export type Bucket = {
  /** The tokens left, at most the burst. Fractions accrue between calls. */
  readonly tokens: number;
  /** The instant `tokens` was measured, in milliseconds. */
  readonly at: number;
};

/**
 * A full bucket at an instant.
 *
 * @param limits - How the bucket fills and how much it holds.
 * @param now - The instant, in milliseconds.
 * @returns A bucket holding `burst` tokens.
 */
export function full(limits: Limits, now: number): Bucket {
  return { tokens: limits.burst, at: now };
}

/**
 * Takes one token, if the bucket holds one after refilling up to `now`.
 *
 * @param bucket - The bucket as last measured.
 * @param limits - How the bucket fills and how much it holds.
 * @param now - The instant of the call, in milliseconds. An instant before `bucket.at` adds nothing.
 * @returns Whether the call is admitted, and the bucket after it.
 */
export function take(
  bucket: Bucket,
  limits: Limits,
  now: number
): { readonly admitted: boolean; readonly bucket: Bucket } {
  const elapsed = Math.max(0, now - bucket.at) / 1000;
  const tokens = Math.min(limits.burst, bucket.tokens + elapsed * limits.refillPerSecond);
  const at = Math.max(now, bucket.at);
  return tokens >= 1
    ? { admitted: true, bucket: { tokens: tokens - 1, at } }
    : { admitted: false, bucket: { tokens, at } };
}

/**
 * The whole seconds until a bucket holds a token again, for a `Retry-After` header.
 *
 * @param bucket - The bucket after a refused call.
 * @param limits - How the bucket fills.
 * @returns At least 1.
 */
export function secondsUntilToken(bucket: Bucket, limits: Limits): number {
  return Math.max(1, Math.ceil((1 - bucket.tokens) / limits.refillPerSecond));
}
