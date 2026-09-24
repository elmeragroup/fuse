/**
 * The range checks the smart constructors share, so each color states its ranges once as data,
 * keyed by component name.
 */

import { OutOfRange } from "./out-of-range.ts";

/**
 * The numbers one component allows. An `Interval` is a finite range whose upper end is
 * inclusive unless marked. `Finite` allows any finite number, for a linear-light channel that
 * may leave the gamut.
 */
export type ComponentRange =
  | {
      readonly _tag: "Interval";
      readonly min: number;
      readonly max: number;
      readonly upper: "inclusive" | "exclusive";
    }
  | { readonly _tag: "Finite" };

/** The `0..1` range of alpha, OKLCH lightness and encoded sRGB channels. */
export const UNIT_RANGE: ComponentRange = { _tag: "Interval", min: 0, max: 1, upper: "inclusive" };

/** Any finite number. */
export const FINITE: ComponentRange = { _tag: "Finite" };

/**
 * Find the first component outside its range, in the order `ranges` lists them. A `NaN` or
 * infinite value fails every range.
 *
 * @template Component - The component names.
 * @param color - The color's name, for the error, such as `Oklch`.
 * @param components - Each component's value.
 * @param ranges - Each component's range.
 * @returns The first violation, or `undefined` when every component is in range.
 */
export function outOfRange<Component extends string>(
  color: string,
  components: Readonly<Record<Component, number>>,
  ranges: Readonly<Record<Component, ComponentRange>>
): OutOfRange | undefined {
  // A `for-in` loop over a generic record types the key as `Component`, so both lookups stay
  // typed. The range tables are object literals, which have no inherited enumerable keys.
  for (const component in ranges) {
    const range = ranges[component];
    const value = components[component];
    if (!inRange(value, range)) {
      return new OutOfRange(`${color} ${component}`, value, allowed(range));
    }
  }
  return undefined;
}

function inRange(value: number, range: ComponentRange): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  switch (range._tag) {
    case "Finite":
      return true;
    case "Interval":
      return value >= range.min && (range.upper === "inclusive" ? value <= range.max : value < range.max);
  }
}

function allowed(range: ComponentRange): string {
  switch (range._tag) {
    case "Finite":
      return "a finite number";
    case "Interval":
      return `a finite number in ${range.min}..${range.max}${range.upper === "inclusive" ? "" : " exclusive"}`;
  }
}

/**
 * Clamp a number into `0..1`, the way CSS clamps an out-of-range alpha or lightness at parse
 * time. Math that should land inside the range can drift past an end by a rounding step, so
 * the conversions clamp too before constructing a color.
 *
 * @param value - A finite number.
 * @returns The number clamped to `0..1`.
 */
export function clampToUnitInterval(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
