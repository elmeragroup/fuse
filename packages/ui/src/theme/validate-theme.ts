import type { BrandCode, ThemeInput, ThemeSegment, ThemeVariant } from "./tokens/themes";

type ThemeAxisValue = string | number | boolean | symbol | bigint | null | undefined;

type LooseThemeAxes = {
  variant?: ThemeAxisValue;
  brand?: ThemeAxisValue;
  segment?: ThemeAxisValue;
};

function pinnedSegmentError(brand: "fkab" | "fkse", segment: "company" | "private"): Error {
  return new Error(`Invalid theme: ${brand} is pinned to ${segment}.`);
}

function pinnedSegmentWarning(brand: "fkab" | "fkse", segment: "company" | "private"): string {
  return `Invalid theme: ${brand} is pinned to ${segment}. Coercing segment to "${segment}".`;
}

function asThemeVariant(value: ThemeAxisValue): ThemeVariant | undefined {
  if (value === "internal" || value === "external") {
    return value;
  }
  return undefined;
}

function asBrandCode(value: ThemeAxisValue): BrandCode | undefined {
  if (value === "fkas" || value === "tkas" || value === "guen" || value === "fkab" || value === "fkse") {
    return value;
  }
  return undefined;
}

function asThemeSegment(value: ThemeAxisValue): ThemeSegment | undefined {
  if (value === "private" || value === "company") {
    return value;
  }
  return undefined;
}

function resolvePinnedTheme(variant: ThemeVariant, brand: BrandCode, segment: ThemeSegment): ThemeInput {
  if (brand === "fkab") {
    if (segment === "company") {
      return { variant, brand, segment };
    }
    if (process.env.NODE_ENV !== "production") {
      throw pinnedSegmentError("fkab", "company");
    }
    console.warn(pinnedSegmentWarning("fkab", "company"));
    return { variant, brand: "fkab", segment: "company" };
  }

  if (brand === "fkse") {
    if (segment === "private") {
      return { variant, brand, segment };
    }
    if (process.env.NODE_ENV !== "production") {
      throw pinnedSegmentError("fkse", "private");
    }
    console.warn(pinnedSegmentWarning("fkse", "private"));
    return { variant, brand: "fkse", segment: "private" };
  }

  return { variant, brand, segment };
}

// theming.md §7.6: validateTheme is the untyped I/O boundary.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function validateTheme(input: unknown): ThemeInput {
  if (input === null || Array.isArray(input) || Object(input) !== input) {
    throw new Error("Invalid theme: expected an object with variant, brand, and segment.");
  }

  // SAFETY: input is a non-null object; missing or non-literal axes are rejected below.
  const axes = input as LooseThemeAxes;
  const variant = asThemeVariant(axes.variant);
  const brand = asBrandCode(axes.brand);
  const segment = asThemeSegment(axes.segment);
  if (variant === undefined || brand === undefined || segment === undefined) {
    throw new Error("Invalid theme: unknown or missing variant, brand, or segment.");
  }

  return resolvePinnedTheme(variant, brand, segment);
}
