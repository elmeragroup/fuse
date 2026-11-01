/**
 * Whether two lists hold the same items in the same order, by `Object.is`.
 *
 * @param a - One list, or undefined.
 * @param b - The other, or undefined.
 * @returns Whether they match, true when both are undefined.
 */
export function sameItems<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (!Object.is(a[index], b[index])) return false;
  return true;
}
