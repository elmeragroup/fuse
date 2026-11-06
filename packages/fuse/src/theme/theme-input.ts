/**
 * The theme axes, identity × brand × segment, and the one registry every projection of a theme
 * reads: validation, the `data-theme-*` attributes, the slug and the legal theme list. Density
 * and color scheme are document axes, not theme axes, so they live in `density.ts` and the
 * color-scheme modules.
 */

/** The identity axis: the neutral system look, or the brand's full look and feel. */
export const THEME_IDENTITIES = ["neutral", "branded"] as const;
/** Every brand code, in the order the docs and design tools list them. */
export const BRAND_CODES = ["fkas", "tkas", "guen", "fkab", "fkse", "elma", "ngfi"] as const;
/** The segment axis: the customer class a surface serves. */
export const THEME_SEGMENTS = ["private", "company"] as const;

/** A theme identity, `neutral` or `branded`. */
export type ThemeIdentity = (typeof THEME_IDENTITIES)[number];
/** A brand code, such as `fkas`. */
export type BrandCode = (typeof BRAND_CODES)[number];
/** A segment, `private` or `company`. */
export type ThemeSegment = (typeof THEME_SEGMENTS)[number];

/**
 * The theme axes by name, each with the attribute that stamps it and its legal values. Every
 * projection of a theme reads them: validation, the `data-theme-*` attributes, the slug, the
 * legal theme list and the generated selectors. `fuse.css` cannot import TypeScript, so
 * `theme-api.test.ts` holds its `:where([data-theme-…])` reset to these attributes.
 */
export const THEME_AXIS = {
  identity: { name: "identity", attribute: "data-theme-identity", values: THEME_IDENTITIES },
  brand: { name: "brand", attribute: "data-theme-brand", values: BRAND_CODES },
  segment: { name: "segment", attribute: "data-theme-segment", values: THEME_SEGMENTS },
} as const;

/** The theme axes in write, slug and diagnostic order. */
export const THEME_AXES = [THEME_AXIS.identity, THEME_AXIS.brand, THEME_AXIS.segment] as const;

/** One entry of {@link THEME_AXES}. */
export type ThemeAxis = (typeof THEME_AXES)[number];

/** The name of a theme axis, such as `identity`. */
export type ThemeAxisName = ThemeAxis["name"];

/** The value type of the axis named `N`. */
export type ThemeAxisValue<N extends ThemeAxisName> = Extract<ThemeAxis, { name: N }>["values"][number];

/**
 * A theme: one identity, brand and segment. A pinned brand takes only its one segment.
 */
export type ThemeInput =
  | { identity: ThemeIdentity; brand: "fkas" | "tkas" | "guen" | "elma" | "ngfi"; segment: ThemeSegment }
  | { identity: ThemeIdentity; brand: "fkab"; segment: "company" }
  | { identity: ThemeIdentity; brand: "fkse"; segment: "private" };

/** The canonical string name of a theme, `<identity>-<brand>-<segment>`. */
export type ThemeSlug =
  | `${ThemeIdentity}-${"fkas" | "tkas" | "guen" | "elma" | "ngfi"}-${ThemeSegment}`
  | `${ThemeIdentity}-fkab-company`
  | `${ThemeIdentity}-fkse-private`;

/**
 * Whether `value` is one of the legal values of an axis.
 *
 * @param axis - The axis whose values to search.
 * @param value - An untyped axis value.
 * @returns True when `value` is one of the axis's values.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- predicate over untyped axis values
export function isThemeAxisValue<A extends ThemeAxis>(axis: A, value: unknown): value is A["values"][number] {
  return axis.values.some((candidate: string) => candidate === value);
}

/**
 * The canonical slug of a theme.
 *
 * @param theme - A legal theme.
 * @returns Its slug, the axis values joined with `-` in {@link THEME_AXES} order.
 */
export function themeSlug(theme: ThemeInput): ThemeSlug {
  // SAFETY: ThemeInput already correlates pinned brands with their segment; TS loses that
  // correlation across separate property reads, so the joined template is re-asserted.
  return THEME_AXES.map((axis) => theme[axis.name]).join("-") as ThemeSlug;
}

/** Each brand's code, display name and the segments it spans. */
export const BRANDS = {
  fkas: { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
  tkas: { code: "tkas", displayName: "TrøndelagKraft", segments: ["private", "company"] },
  guen: { code: "guen", displayName: "Gudbrandsdal Energi", segments: ["private", "company"] },
  fkab: { code: "fkab", displayName: "Fjordkraft Företag", segments: ["company"] },
  fkse: { code: "fkse", displayName: "Telinet", segments: ["private"] },
  elma: { code: "elma", displayName: "Elmera", segments: ["private", "company"] },
  ngfi: { code: "ngfi", displayName: "Nordic Green Energy", segments: ["private", "company"] },
} as const satisfies Record<
  BrandCode,
  {
    code: BrandCode;
    displayName: string;
    segments: readonly ThemeSegment[];
  }
>;

/**
 * Whether `value` is a brand code.
 *
 * @param value - An untyped value.
 * @returns True when `value` is one of {@link BRAND_CODES}.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- public predicate over untyped axis values
export function isBrandCode(value: unknown): value is BrandCode {
  return BRAND_CODES.some((code) => code === value);
}

/**
 * Whether a brand spans a segment.
 *
 * @param brand - The brand.
 * @param segment - The segment.
 * @returns False when `brand` is pinned to the other segment.
 */
export function brandAllowsSegment(brand: BrandCode, segment: ThemeSegment): boolean {
  return BRANDS[brand].segments.some((allowed) => allowed === segment);
}

/** What an untrusted source holds for one axis before parsing: any value at all. */
export type UntypedAxisValue = string | number | bigint | boolean | symbol | object | null | undefined;

/** One legal value per theme axis, before the pin table correlates brand and segment. */
export type ThemeAxes = { readonly [N in ThemeAxisName]: ThemeAxisValue<N> };

/**
 * Parse every theme axis in {@link THEME_AXES} order. Each axis checks its own value against
 * its registry entry; the brand/segment pin is the caller's, because strict parsing rejects a
 * pinned mismatch and coercion resolves it.
 *
 * @param read - Reads the untyped value of one axis.
 * @returns One legal value per axis, or null when any axis is unknown or missing.
 */
export function parseThemeAxes(read: (axis: ThemeAxis, index: number) => UntypedAxisValue): ThemeAxes | null {
  const parsed: Partial<Record<ThemeAxisName, string>> = {};
  for (const [index, axis] of THEME_AXES.entries()) {
    const value = read(axis, index);
    if (!isThemeAxisValue(axis, value)) {
      return null;
    }
    parsed[axis.name] = value;
  }
  // SAFETY: the loop wrote every axis in THEME_AXES, each after its own membership check, so the
  // record holds one legal value per axis name.
  return parsed as ThemeAxes;
}

/**
 * The `data-theme-*` attributes of a theme, one per axis in {@link THEME_AXES} order. It is the
 * pure projection, with no validation: callers pass a parsed theme.
 *
 * @param theme - One legal value per axis.
 * @returns Each axis's attribute name paired with its value.
 */
export function themeAxisAttributes(
  theme: ThemeAxes
): readonly (readonly [ThemeAxis["attribute"], string])[] {
  return THEME_AXES.map((axis) => [axis.attribute, theme[axis.name]] as const);
}

/**
 * The attribute selector of one axis value, such as `[data-theme-identity="branded"]`.
 *
 * @param name - The axis.
 * @param value - One of its legal values.
 * @returns The selector that matches an element stamped with that value.
 */
export function themeAxisSelector<N extends ThemeAxisName>(name: N, value: ThemeAxisValue<N>): string {
  return `[${THEME_AXIS[name].attribute}="${value}"]`;
}

/**
 * Parse a theme slug, such as `branded-fkas-private`. The slug spells the axes in
 * {@link THEME_AXES} order, as {@link themeSlug} writes it.
 *
 * @param slug - The untrusted slug.
 * @returns The theme, or null for an unknown axis value or a segment a pinned brand does not span.
 */
export function parseThemeSlug(slug: string): ThemeInput | null {
  const parts = slug.split("-");
  if (parts.length !== THEME_AXES.length) {
    return null;
  }
  const axes = parseThemeAxes((_, index) => parts[index]);
  if (axes === null || !brandAllowsSegment(axes.brand, axes.segment)) {
    return null;
  }
  // SAFETY: every axis passed its membership check, and a pinned brand is rejected when the
  // segment is not in BRANDS[brand].segments.
  return axes as ThemeInput;
}

/** Every legal theme, identity-major, then brand, then segment. */
export const LEGAL_THEMES: readonly ThemeInput[] = THEME_IDENTITIES.flatMap((identity) =>
  BRAND_CODES.flatMap((brand) =>
    // SAFETY: brand and segment come from the BRANDS pin table, so every combination is a
    // legal ThemeInput member; TS cannot correlate the mapped axes back to the union.
    BRANDS[brand].segments.map((segment): ThemeInput => ({ identity, brand, segment }) as ThemeInput)
  )
);
