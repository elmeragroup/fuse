/**
 * A slide's id. It names the slide's file, `slides/<id>.mdx`, and its place in `deck.json`'s
 * order, so it must be safe as a path segment before anything touches the disk.
 */

import * as Schema from "effect/Schema";

/** Lowercase letters, digits and dashes, starting with a letter or digit. */
const SLIDE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** A parsed slide id, such as `cover` or `how-it-was-built`. */
export const SlideId = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(SLIDE_ID_PATTERN, {
      message:
        "A slide id has only lowercase letters, digits and dashes, and starts with a letter or digit, such as how-it-works",
    })
  ),
  Schema.brand("SlideId")
);

/** A parsed slide id. */
export type SlideId = typeof SlideId.Type;

/**
 * The slide's path relative to the deck directory.
 *
 * @param id - The slide's id.
 * @returns `slides/<id>.mdx`.
 */
export function slidePath(id: SlideId): string {
  return `slides/${id}.mdx`;
}
