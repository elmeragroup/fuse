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
  if (theme.brand === "fkab") {
    return `${theme.variant}-fkab-company`;
  }
  if (theme.brand === "fkse") {
    return `${theme.variant}-fkse-private`;
  }
  return `${theme.variant}-${theme.brand}-${theme.segment}`;
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

// oxlint-disable-next-line anti-slop/no-unknown-parameters
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

export const LEGAL_THEMES = [
  { variant: "internal", brand: "fkas", segment: "private" },
  { variant: "internal", brand: "fkas", segment: "company" },
  { variant: "internal", brand: "tkas", segment: "private" },
  { variant: "internal", brand: "tkas", segment: "company" },
  { variant: "internal", brand: "guen", segment: "private" },
  { variant: "internal", brand: "guen", segment: "company" },
  { variant: "internal", brand: "elma", segment: "private" },
  { variant: "internal", brand: "elma", segment: "company" },
  { variant: "internal", brand: "fkab", segment: "company" },
  { variant: "internal", brand: "fkse", segment: "private" },
  { variant: "external", brand: "fkas", segment: "private" },
  { variant: "external", brand: "fkas", segment: "company" },
  { variant: "external", brand: "tkas", segment: "private" },
  { variant: "external", brand: "tkas", segment: "company" },
  { variant: "external", brand: "guen", segment: "private" },
  { variant: "external", brand: "guen", segment: "company" },
  { variant: "external", brand: "elma", segment: "private" },
  { variant: "external", brand: "elma", segment: "company" },
  { variant: "external", brand: "fkab", segment: "company" },
  { variant: "external", brand: "fkse", segment: "private" },
] as const satisfies readonly ThemeInput[];
