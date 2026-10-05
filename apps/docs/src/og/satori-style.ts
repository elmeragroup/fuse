/**
 * Drops the members whose value is `undefined`. Satori reads every key it is given and fails
 * on an `undefined` value, so a conditional style member or attribute must be absent rather
 * than undefined.
 *
 * @template T - The style or attribute object.
 * @param value - An object with optional members.
 * @returns The same members without the undefined ones.
 */
export function compact<const T extends object>(value: T): T {
  // SAFETY: the entries are the object's own, minus those whose value is undefined. Under
  // `exactOptionalPropertyTypes` a member that may be undefined is optional in T, so omitting
  // it still satisfies T.
  return Object.fromEntries(Object.entries(value).filter(([, member]) => member !== undefined)) as T;
}
