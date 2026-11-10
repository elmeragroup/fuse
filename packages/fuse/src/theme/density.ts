/**
 * The density axis. Density is a document axis, independent of theme: the document root
 * carries it as `data-density`, and no theme identity implies one. This module imports no theme
 * module, so the axis stays independent of the theme registry.
 */

/** A document density. */
export type Density = "dense" | "comfortable";

/** The density axis in host-facing order: the `data-density` values a document can carry. */
export const DENSITIES = ["dense", "comfortable"] as const satisfies readonly Density[];

/** The attribute that stamps a density on the document root. */
export type DensityAttributes = {
  "data-density": Density;
};

/**
 * Validates a density and returns its `data-density` attribute. A document gets it together
 * with its theme through `documentAttributes`; this stamps density alone, such as on a docs
 * demo stage that previews the density metrics.
 *
 * @param density - The density to stamp.
 * @returns The `data-density` attribute.
 * @throws When `density` is not one of {@link DENSITIES}.
 */
export function densityAttributes(density: Density): DensityAttributes {
  // Strict membership: `Object.hasOwn` would coerce a non-string key such as `["dense"]`.
  const value = DENSITIES.find((candidate) => candidate === density);
  if (value === undefined) {
    throw new Error("Invalid density: unknown or missing density.");
  }
  return { "data-density": value };
}
