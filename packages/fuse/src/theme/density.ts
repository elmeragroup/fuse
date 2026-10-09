import { THEME_VARIANTS } from "./tokens/themes";
import type { ThemeVariant } from "./tokens/themes";

export type Density = "dense" | "comfortable";

/** The density axis in host-facing order: the `data-density` values a document can carry. */
export const DENSITIES = ["dense", "comfortable"] as const satisfies readonly Density[];

export type DensityAttributes = {
  "data-density": Density;
};

const VARIANT_DENSITY = {
  internal: "dense",
  external: "comfortable",
} as const satisfies Record<ThemeVariant, Density>;

export function defaultDensityForVariant(variant: ThemeVariant): Density {
  // Strict membership: `Object.hasOwn` would coerce a non-string key such as `["external"]`.
  const value = THEME_VARIANTS.find((candidate) => candidate === variant);
  if (value === undefined) {
    throw new Error("Invalid theme variant: unknown or missing variant.");
  }
  return VARIANT_DENSITY[value];
}

export function densityAttributes(density: Density): DensityAttributes {
  const value = DENSITIES.find((candidate) => candidate === density);
  if (value === undefined) {
    throw new Error("Invalid density: unknown or missing density.");
  }
  return { "data-density": value };
}
