/**
 * Deep freezing for the fixtures a worker builds once and hands every suite it runs, since the
 * suites share one module registry (`vitest.config.ts`). A suite that writes into a shared fixture
 * then throws where it writes, instead of changing what the suites after it read.
 */

/**
 * Freeze a value and every object and array it reaches. A map's or a set's entries are frozen, but
 * the map or set itself still takes writes, and typed arrays, which cannot be frozen, stay open.
 *
 * @param value - The value.
 * @param seen - The objects already frozen on this walk.
 * @returns The value, frozen.
 */
export function deepFrozen<Value>(value: Value, seen = new Set<unknown>()): Value {
  if (!(value instanceof Object) || seen.has(value) || ArrayBuffer.isView(value)) {
    return value;
  }
  seen.add(value);
  const entries: readonly unknown[] =
    value instanceof Map ? [...value].flat() : value instanceof Set ? [...value] : [];
  const fields: readonly unknown[] = Object.values(value);
  for (const entry of [...entries, ...fields]) {
    deepFrozen(entry, seen);
  }
  Object.freeze(value);
  return value;
}
