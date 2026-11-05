"use client";

/**
 * Props that keep their identity while they say the same thing. A consumer writes a config, a range
 * or a list inline in JSX, which makes a new object on every render, and only a change of what it
 * says may read as an update that restarts every tween.
 */
import { useState } from "react";

import type { ChartColor, ChartConfig, ChartSeriesConfig } from "./chart-types";
import { isThresholdColor } from "./layout/color-key";
import { sameItems } from "./layout/same-items";

/**
 * Whether two prop values say the same thing, one level deep, as an inline literal rebuilds them:
 * the same value, two lists of the same items, or two plain objects with the same fields in any
 * order.
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
  const right = new Map(Object.entries(b));
  return (
    left.length === right.size &&
    left.every(([key, value]) => right.has(key) && Object.is(value, right.get(key)))
  );
}

/** One field value of a series config. */
type ConfigField = ChartSeriesConfig[keyof ChartSeriesConfig];

/** A series config's fields in order. */
function fieldsOf(entry: ChartSeriesConfig): (readonly [string, ConfigField])[] {
  // SAFETY: Object.entries of a ChartSeriesConfig yields its own fields, each a ConfigField.
  return Object.entries(entry) as (readonly [string, ConfigField])[];
}

/**
 * Whether two colours say the same thing. A threshold nests its two sides, which a config written
 * inline in JSX writes anew on every render, so they compare field by field.
 */
function sameColor(a: ChartColor, b: ChartColor): boolean {
  if (isThresholdColor(a) && isThresholdColor(b)) {
    return (
      Object.is(a.threshold, b.threshold) && sameShallow(a.below, b.below) && sameShallow(a.above, b.above)
    );
  }
  return sameShallow(a, b);
}

/**
 * Whether two configs say the same thing: the same keys in the same order, each with the same
 * fields, compared by `sameShallow`, and a threshold colour by its value and both sides. A config
 * written inline in JSX is a new object on every render, and only a change of what it says counts
 * as an update.
 *
 * @param a - One config.
 * @param b - The other.
 * @returns Whether they match.
 */
export function sameConfig(a: ChartConfig, b: ChartConfig): boolean {
  const left = Object.entries(a);
  const right = Object.entries(b);
  return (
    left.length === right.length &&
    left.every(([key, entry], index) => {
      const other = right[index];
      if (other?.[0] !== key) return false;
      const fields = fieldsOf(entry);
      const otherFields = new Map(fieldsOf(other[1]));
      return (
        fields.length === otherFields.size &&
        fields.every(
          ([name, value]) =>
            otherFields.has(name) &&
            (name === "color"
              ? sameColor(entry.color, other[1].color)
              : sameShallow(value, otherFields.get(name)))
        )
      );
    })
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
