/**
 * One of n slices of `figma:capture`'s targets, so CI can split the capture check over parallel
 * jobs. Slice k keeps every n-th target in the given order, starting at the k-th, so neighboring
 * sets, such as a composite's parts, land in different slices.
 */

import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

/** The k-th of n slices, 1-based. Only `parseCaptureShard` makes one. */
export type CaptureShard = {
  /** Which slice, from 1 to `count`. */
  readonly index: number;
  /** How many slices the targets split into. */
  readonly count: number;
};

/** A shard argument that is not `<k>/<n>` with k from 1 to n. */
export class InvalidCaptureShard extends Schema.TaggedError<InvalidCaptureShard>()("InvalidCaptureShard", {
  message: Schema.String,
  text: Schema.String,
}) {}

const SHARD = /^([1-9]\d*)\/([1-9]\d*)$/;

/**
 * Parse a shard argument such as `2/4`.
 *
 * @param text - The argument as given.
 * @returns The shard, or `InvalidCaptureShard` when the text is not `<k>/<n>` with k from 1 to n.
 */
export function parseCaptureShard(text: string): Result.Result<CaptureShard, InvalidCaptureShard> {
  const [, indexText, countText] = SHARD.exec(text) ?? [];
  const index = Number(indexText);
  const count = Number(countText);
  if (Number.isSafeInteger(index) && Number.isSafeInteger(count) && index <= count) {
    return Result.succeed({ index, count });
  }
  return Result.fail(
    new InvalidCaptureShard({ message: `The shard "${text}" is not <k>/<n> with k from 1 to n.`, text })
  );
}

/**
 * The items a shard keeps: every n-th item, starting at its k-th.
 *
 * @template T - The item type.
 * @param items - Every item, in a fixed order.
 * @param shard - The slice to keep.
 * @returns The shard's items, in their given order.
 */
export function shardItems<T>(items: readonly T[], shard: CaptureShard): readonly T[] {
  return items.filter((_, position) => position % shard.count === shard.index - 1);
}
