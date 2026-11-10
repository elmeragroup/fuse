import { brandAllowsSegment, BRANDS, parseThemeAxes } from "./theme-input";
import type {
  BrandCode,
  ThemeAxes,
  ThemeAxisName,
  ThemeInput,
  ThemeSegment,
  UntypedAxisValue,
} from "./theme-input";

type LooseThemeAxes = { readonly [N in ThemeAxisName]?: UntypedAxisValue };

export function isThemeDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function pinnedSegmentError(brand: BrandCode, segment: ThemeSegment): Error {
  return new Error(`Invalid theme: ${brand} is pinned to ${segment}.`);
}

function pinnedSegmentWarning(brand: BrandCode, segment: ThemeSegment): string {
  return `Invalid theme: ${brand} is pinned to ${segment}. Coercing segment to "${segment}".`;
}

type ParsedThemeAxes = ({ ok: true } & ThemeAxes) | { ok: false; reason: "not-object" | "unknown-axes" };

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untyped CMS/env input is parsed here before pin/diagnostics
function parseThemeObject(input: unknown): ParsedThemeAxes {
  if (input === null || Array.isArray(input) || Object(input) !== input) {
    return { ok: false, reason: "not-object" };
  }

  // SAFETY: input is a non-null object; missing or non-literal axes are rejected below.
  const axes = input as LooseThemeAxes;
  const parsed = parseThemeAxes((axis) => axes[axis.name]);
  return parsed === null ? { ok: false, reason: "unknown-axes" } : { ok: true, ...parsed };
}

function resolvePinnedSegment(brand: BrandCode, segment: ThemeSegment): ThemeSegment {
  // BRANDS.segments entries are unique, so result !== segment exactly when pinned.
  return brandAllowsSegment(brand, segment) ? segment : BRANDS[brand].segments[0];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- env-free pin-table parse over unknown
export function coerceTheme(input: unknown): ThemeInput | null {
  const parsed = parseThemeObject(input);
  if (!parsed.ok) {
    return null;
  }
  // SAFETY: resolvePinnedSegment returns a member of BRANDS[brand].segments, the pin
  // table ThemeInput encodes.
  return {
    identity: parsed.identity,
    brand: parsed.brand,
    segment: resolvePinnedSegment(parsed.brand, parsed.segment),
  } as ThemeInput;
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the theme prop is typed but validated at its runtime boundary anyway
export function validateTheme(input: unknown): ThemeInput {
  const parsed = parseThemeObject(input);
  if (!parsed.ok) {
    if (parsed.reason === "not-object") {
      throw new Error("Invalid theme: expected an object with identity, brand, and segment.");
    }
    throw new Error("Invalid theme: unknown or missing identity, brand, or segment.");
  }

  const segment = resolvePinnedSegment(parsed.brand, parsed.segment);
  if (segment !== parsed.segment) {
    if (isThemeDevelopment()) {
      throw pinnedSegmentError(parsed.brand, segment);
    }
    console.warn(pinnedSegmentWarning(parsed.brand, segment));
  }

  // SAFETY: segment came from resolvePinnedSegment over the BRANDS pin table.
  return { identity: parsed.identity, brand: parsed.brand, segment } as ThemeInput;
}
