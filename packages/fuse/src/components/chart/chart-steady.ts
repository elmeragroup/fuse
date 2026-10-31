"use client";

/**
 * Props that keep their identity while they say the same thing. A consumer writes a config, a range
 * or a list inline in JSX, which makes a new object on every render, and only a change of what it
 * says may read as an update that restarts every tween.
 */
import { useState } from "react";

import { sameItems } from "./layout/same-items";

/**
 * Whether two prop values say the same thing, one level deep, as an inline literal rebuilds them:
 * the same value, two lists of the same items, or two plain objects with the same fields in the
 * same order.
 *
 * @param a - One value.
 * @param b - The other.
 * @returns Whether they match.
 */
export function sameShallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return sameItems(a, b);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned props: an inline style, Intl options or a config field arrive as any value
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype)
    return false;
  const left = Object.entries(a);
  const right = Object.entries(b);
  return (
    left.length === right.length &&
    left.every(([key, value], index) => right[index]?.[0] === key && Object.is(value, right[index][1]))
  );
}

/**
 * A prop that keeps its first identity until it says something else, as `same` compares it.
 *
 * @param value - The prop as this render received it.
 * @param same - Whether two values say the same thing.
 * @returns The steady value: the one kept while `same` holds, else this render's.
 */
export function useSteady<T>(value: T, same: (a: T, b: T) => boolean): T {
  const [steady, setSteady] = useState(value);
  if (Object.is(steady, value) || same(steady, value)) return steady;
  setSteady(() => value);
  return value;
}
