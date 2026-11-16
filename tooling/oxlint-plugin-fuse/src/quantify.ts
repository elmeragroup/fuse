/*
 * The one rule every consumer applies to a value's alternatives: a value violates when any one of
 * them does.
 */

/**
 * The violation a value makes, for a report that names it: the first alternative's, in order.
 *
 * @template T - One alternative.
 * @template R - What a violating alternative reports, such as a hook's name or a setting.
 * @param alternatives - Every value the expression may hold.
 * @param violation - What one alternative violates with, or `undefined` when it does not.
 * @returns The first violation, or `undefined` when no alternative violates.
 */
export function firstViolation<T, R>(
  alternatives: ReadonlyArray<T>,
  violation: (alternative: T) => R | undefined
): R | undefined {
  for (const alternative of alternatives) {
    const found = violation(alternative);
    if (found !== undefined) return found;
  }
  return undefined;
}
