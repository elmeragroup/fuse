import type { ThemeVariant } from "./tokens/themes";

export type Density = "dense" | "comfortable";

export type DensityAttributes = {
  "data-density": Density;
};

export function defaultDensityForVariant(variant: ThemeVariant): Density {
  const value: unknown = variant;
  if (value === "internal") {
    return "dense";
  }
  if (value === "external") {
    return "comfortable";
  }
  throw new Error("Invalid theme variant: unknown or missing variant.");
}

export function densityAttributes(density: Density): DensityAttributes {
  const value: unknown = density;
  if (value === "dense" || value === "comfortable") {
    return { "data-density": value };
  }
  throw new Error("Invalid density: unknown or missing density.");
}
