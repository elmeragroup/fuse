// The event-handler chaining the filter's parts share. Private to the filter: no barrel exports it.

/**
 * Runs the part's own handler after the consumer's, unless the consumer prevented it.
 *
 * @param own - The part's handler.
 * @param theirs - The consumer's handler, if any.
 * @returns The chained handler.
 */
export function chain<E extends { readonly defaultPrevented: boolean }>(
  own: (event: E) => void,
  theirs: ((event: E) => void) | undefined
): (event: E) => void {
  return (event) => {
    theirs?.(event);
    if (!event.defaultPrevented) {
      own(event);
    }
  };
}
