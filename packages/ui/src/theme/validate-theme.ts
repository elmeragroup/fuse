import { brandAllowsSegment, BRANDS, isBrandCode } from "./tokens/themes";
import type { BrandCode, ThemeInput, ThemeSegment, ThemeVariant } from "./tokens/themes";

type ThemeAxisValue = string | number | boolean | symbol | bigint | null | undefined;

type LooseThemeAxes = {
  variant?: ThemeAxisValue;
  brand?: ThemeAxisValue;
  segment?: ThemeAxisValue;
};

export function isThemeDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function pinnedSegmentError(brand: BrandCode, segment: ThemeSegment): Error {
  return new Error(`Invalid theme: ${brand} is pinned to ${segment}.`);
}

function pinnedSegmentWarning(brand: BrandCode, segment: ThemeSegment): string {
  return `Invalid theme: ${brand} is pinned to ${segment}. Coercing segment to "${segment}".`;
}

function asThemeVariant(value: ThemeAxisValue): ThemeVariant | undefined {
  if (value === "internal" || value === "external") {
    return value;
  }
  return undefined;
}

function asBrandCode(value: ThemeAxisValue): BrandCode | undefined {
  return isBrandCode(value) ? value : undefined;
}

function asThemeSegment(value: ThemeAxisValue): ThemeSegment | undefined {
  if (value === "private" || value === "company") {
    return value;
  }
  return undefined;
}

type ParsedThemeAxes =
  | { ok: true; variant: ThemeVariant; brand: BrandCode; segment: ThemeSegment }
  | { ok: false; reason: "not-object" | "unknown-axes" };

// theming.md §7.6: untyped CMS/env input is parsed here before pin/diagnostics.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
function parseThemeAxes(input: unknown): ParsedThemeAxes {
  if (input === null || Array.isArray(input) || Object(input) !== input) {
    return { ok: false, reason: "not-object" };
  }

  // SAFETY: input is a non-null object; missing or non-literal axes are rejected below.
  const axes = input as LooseThemeAxes;
  const variant = asThemeVariant(axes.variant);
  const brand = asBrandCode(axes.brand);
  const segment = asThemeSegment(axes.segment);
  if (variant === undefined || brand === undefined || segment === undefined) {
    return { ok: false, reason: "unknown-axes" };
  }
  return { ok: true, variant, brand, segment };
}

function resolvePinnedSegment(brand: BrandCode, segment: ThemeSegment): ThemeSegment {
  // BRANDS.segments entries are unique, so result !== segment exactly when pinned.
  return brandAllowsSegment(brand, segment) ? segment : BRANDS[brand].segments[0];
}

// theming.md §7.6: coerceTheme is the env-free pin-table parse. validateTheme layers diagnostics.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function coerceTheme(input: unknown): ThemeInput | null {
  const parsed = parseThemeAxes(input);
  if (!parsed.ok) {
    return null;
  }
  // SAFETY: resolvePinnedSegment returns a member of BRANDS[brand].segments, the pin
  // table ThemeInput encodes.
  return {
    variant: parsed.variant,
    brand: parsed.brand,
    segment: resolvePinnedSegment(parsed.brand, parsed.segment),
  } as ThemeInput;
}

// theming.md §7.6: validateTheme is the untyped I/O boundary.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function validateTheme(input: unknown): ThemeInput {
  const parsed = parseThemeAxes(input);
  if (!parsed.ok) {
    if (parsed.reason === "not-object") {
      throw new Error("Invalid theme: expected an object with variant, brand, and segment.");
    }
    throw new Error("Invalid theme: unknown or missing variant, brand, or segment.");
  }

  const segment = resolvePinnedSegment(parsed.brand, parsed.segment);
  if (segment !== parsed.segment) {
    if (isThemeDevelopment()) {
      throw pinnedSegmentError(parsed.brand, segment);
    }
    console.warn(pinnedSegmentWarning(parsed.brand, segment));
  }

  // SAFETY: segment came from resolvePinnedSegment over the BRANDS pin table.
  return { variant: parsed.variant, brand: parsed.brand, segment } as ThemeInput;
}
