/** Counted nouns for messages. */

/**
 * "1 place" or "N places", for how many changes separate a file from the tokens.
 *
 * @param count - The number of changes.
 */
export function places(count: number): string {
  return count === 1 ? "1 place" : `${count} places`;
}
