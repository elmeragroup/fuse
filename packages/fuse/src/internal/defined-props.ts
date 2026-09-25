/**
 * Drops the keys whose value is `undefined`, so spreading the result cannot override a
 * default the receiving component wires itself.
 *
 * Base UI's `mergeProps` assigns every present non-handler key, so a wrapper that forwards
 * an optional prop as `aria-labelledby={props["aria-labelledby"]}` would otherwise replace
 * the automatic label, description or role with `undefined`. Spread the result of this
 * helper wherever consumer props land on a part that owns such wiring.
 *
 * @template T - The props object to filter.
 * @param props - Props that may carry present-but-undefined keys.
 * @returns A copy of `props` without the `undefined` keys.
 */
export function definedProps<T extends object>(props: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const defined = Object.fromEntries(Object.entries(props).filter((entry) => entry[1] !== undefined));
  // SAFETY: Object.entries loses key/value correlation; the filter is the omission contract.
  return defined as { [K in keyof T]?: Exclude<T[K], undefined> };
}
