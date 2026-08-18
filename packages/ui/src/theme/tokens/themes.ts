export const THEME_VARIANTS = ["internal", "external"] as const;
export const BRAND_CODES = ["fkas", "tkas", "guen", "fkab", "fkse"] as const;
export const THEME_SEGMENTS = ["private", "company"] as const;

export type ThemeVariant = (typeof THEME_VARIANTS)[number];
export type BrandCode = (typeof BRAND_CODES)[number];
export type ThemeSegment = (typeof THEME_SEGMENTS)[number];

export type ThemeInput =
  | { variant: ThemeVariant; brand: "fkas" | "tkas" | "guen"; segment: ThemeSegment }
  | { variant: ThemeVariant; brand: "fkab"; segment: "company" }
  | { variant: ThemeVariant; brand: "fkse"; segment: "private" };

export type ThemeSlug =
  | `${ThemeVariant}-${"fkas" | "tkas" | "guen"}-${ThemeSegment}`
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
  if (brand === "fkab") {
    if (segment !== "company") {
      return null;
    }
    return { variant, brand, segment };
  }
  if (brand === "fkse") {
    if (segment !== "private") {
      return null;
    }
    return { variant, brand, segment };
  }
  if (brand === "fkas" || brand === "tkas" || brand === "guen") {
    return { variant, brand, segment };
  }
  return null;
}

export const BRANDS = {
  fkas: { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
  tkas: { code: "tkas", displayName: "TrøndelagKraft", segments: ["private", "company"] },
  guen: { code: "guen", displayName: "Gudbrandsdal Energi", segments: ["private", "company"] },
  fkab: { code: "fkab", displayName: "Fjordkraft Företag", segments: ["company"] },
  fkse: { code: "fkse", displayName: "Telinet", segments: ["private"] },
} as const satisfies Record<
  BrandCode,
  {
    code: BrandCode;
    displayName: string;
    segments: readonly ThemeSegment[];
  }
>;

export const LEGAL_THEMES = [
  { variant: "internal", brand: "fkas", segment: "private" },
  { variant: "internal", brand: "fkas", segment: "company" },
  { variant: "internal", brand: "tkas", segment: "private" },
  { variant: "internal", brand: "tkas", segment: "company" },
  { variant: "internal", brand: "guen", segment: "private" },
  { variant: "internal", brand: "guen", segment: "company" },
  { variant: "internal", brand: "fkab", segment: "company" },
  { variant: "internal", brand: "fkse", segment: "private" },
  { variant: "external", brand: "fkas", segment: "private" },
  { variant: "external", brand: "fkas", segment: "company" },
  { variant: "external", brand: "tkas", segment: "private" },
  { variant: "external", brand: "tkas", segment: "company" },
  { variant: "external", brand: "guen", segment: "private" },
  { variant: "external", brand: "guen", segment: "company" },
  { variant: "external", brand: "fkab", segment: "company" },
  { variant: "external", brand: "fkse", segment: "private" },
] as const satisfies readonly ThemeInput[];
