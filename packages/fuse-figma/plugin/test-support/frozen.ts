/**
 * Deep freezing for the fixtures a worker builds once and hands every suite it runs, since the
 * suites share one module registry (`vitest.config.ts`).
 *
 * The checks hold for values from another realm too. Under the `vmForks` pool the kit the run's
 * setup wrote (`kit-cache.ts`) deserializes with Node's own constructors, so it fails
 * `instanceof Object`, `instanceof Map` and `instanceof Set` in the suite's context.
 */

/**
 * Whether a value is an object or a function, from any realm. `Object` returns one of those as it
 * is, and wraps a primitive.
 */
const isObject = <Value>(value: Value): value is Value & object => Object(value) === value;

/** Whether a value is a map, from any realm, by the tag `Object.prototype.toString` gives it. */
const isMap = <Value>(value: Value): value is Value & ReadonlyMap<unknown, unknown> =>
  Object.prototype.toString.call(value) === "[object Map]";

/** Whether a value is a set, from any realm, by the tag `Object.prototype.toString` gives it. */
const isSet = <Value>(value: Value): value is Value & ReadonlySet<unknown> =>
  Object.prototype.toString.call(value) === "[object Set]";

/**
 * Freeze a value and every object and array it reaches. A map's or a set's entries are frozen, but
 * the map or set itself still takes writes, and typed arrays, which cannot be frozen, stay open.
 *
 * @param value - The value.
 * @param seen - The objects already frozen on this walk.
 * @returns The value, frozen.
 */
export function deepFrozen<Value>(value: Value, seen = new Set<unknown>()): Value {
  if (!isObject(value) || seen.has(value) || ArrayBuffer.isView(value)) {
    return value;
  }
  seen.add(value);
  const entries: readonly unknown[] = isMap(value) ? [...value].flat() : isSet(value) ? [...value] : [];
  const fields: readonly unknown[] = Object.values(value);
  for (const entry of [...entries, ...fields]) {
    deepFrozen(entry, seen);
  }
  Object.freeze(value);
  return value;
}
