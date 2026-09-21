export const THEME_VARIANTS = ["internal", "external"] as const;
export const BRAND_CODES = ["fkas", "tkas", "guen", "fkab", "fkse", "elma"] as const;
export const THEME_SEGMENTS = ["private", "company"] as const;

export type ThemeVariant = (typeof THEME_VARIANTS)[number];
export type BrandCode = (typeof BRAND_CODES)[number];
export type ThemeSegment = (typeof THEME_SEGMENTS)[number];

export type ThemeInput =
  | { variant: ThemeVariant; brand: "fkas" | "tkas" | "guen" | "elma"; segment: ThemeSegment }
  | { variant: ThemeVariant; brand: "fkab"; segment: "company" }
  | { variant: ThemeVariant; brand: "fkse"; segment: "private" };

export type ThemeSlug =
  | `${ThemeVariant}-${"fkas" | "tkas" | "guen" | "elma"}-${ThemeSegment}`
  | `${ThemeVariant}-fkab-company`
  | `${ThemeVariant}-fkse-private`;

export function themeSlug(theme: ThemeInput): ThemeSlug {
  // SAFETY: ThemeInput already correlates pinned brands with their segment; TS loses that
  // correlation across separate property reads, so the joined template is re-asserted.
  return `${theme.variant}-${theme.brand}-${theme.segment}` as ThemeSlug;
}

export const BRANDS = {
  fkas: { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
  tkas: { code: "tkas", displayName: "TrøndelagKraft", segments: ["private", "company"] },
  guen: { code: "guen", displayName: "Gudbrandsdal Energi", segments: ["private", "company"] },
  fkab: { code: "fkab", displayName: "Fjordkraft Företag", segments: ["company"] },
  fkse: { code: "fkse", displayName: "Telinet", segments: ["private"] },
  elma: { code: "elma", displayName: "Elmera", segments: ["private", "company"] },
} as const satisfies Record<
  BrandCode,
  {
    code: BrandCode;
    displayName: string;
    segments: readonly ThemeSegment[];
  }
>;

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- public predicate over untyped axis values
export function isBrandCode(value: unknown): value is BrandCode {
  return BRAND_CODES.some((code) => code === value);
}

export function brandAllowsSegment(brand: BrandCode, segment: ThemeSegment): boolean {
  return BRANDS[brand].segments.some((allowed) => allowed === segment);
}

export function parseThemeSlug(slug: string): ThemeInput | null {
  const parts = slug.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const variant = parts[0];
  const brand = parts[1];
  const segment = parts[2];
  if (variant !== "internal" && variant !== "external") {
    return null;
  }
  if (segment !== "private" && segment !== "company") {
    return null;
  }
  if (!isBrandCode(brand)) {
    return null;
  }
  if (!brandAllowsSegment(brand, segment)) {
    return null;
  }
  // SAFETY: variant/brand/segment passed BRANDS membership; pinned brands are rejected when the
  // segment is not in BRANDS[brand].segments.
  return { variant, brand, segment } as ThemeInput;
}

export const LEGAL_THEMES: readonly ThemeInput[] = THEME_VARIANTS.flatMap((variant) =>
  BRAND_CODES.flatMap((brand) =>
    // SAFETY: brand and segment come from the BRANDS pin table, so every combination is a
    // legal ThemeInput member; TS cannot correlate the mapped axes back to the union.
    BRANDS[brand].segments.map((segment): ThemeInput => ({ variant, brand, segment }) as ThemeInput)
  )
);
