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
