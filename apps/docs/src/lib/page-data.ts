/**
 * The library data an authored prose page prints. The page renders each list as HTML through
 * `src/components/page-data.tsx`, and the generation pass prints the same list as markdown in the
 * page's markdown endpoint, so the page and its endpoint cannot list different brands or themes.
 *
 * It reads `@elmeragroup/fuse/theme-catalog` rather than `/theme`, because the generation pass runs
 * in Node and cannot load the client TSX that `/theme` re-exports.
 */

import { BRAND_CODES, BRANDS, LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme-catalog";
import type { BrandCode, ThemeSegment, ThemeSlug } from "@elmeragroup/fuse/theme-catalog";

/** One row of the brands table. */
export type BrandRow = {
  /** The four-character brand code. */
  readonly code: BrandCode;
  /** The name a customer sees. */
  readonly displayName: string;
  /** The segments the brand spans, in the library's order. */
  readonly segments: readonly ThemeSegment[];
};

/**
 * The brands table on the brands and segments page, one row per brand code.
 *
 * @returns The rows in `BRAND_CODES` order.
 */
export function brandRows(): readonly BrandRow[] {
  return BRAND_CODES.map((code) => ({
    code,
    displayName: BRANDS[code].displayName,
    segments: BRANDS[code].segments,
  }));
}

/** One column of the brands table: its header, how its cells read, and the text of each cell. */
export type BrandColumn = {
  /** The column's header. */
  readonly header: string;
  /** What a cell holds: an identifier, plain text, or a list of identifiers. */
  readonly kind: "code" | "text" | "list";
  /** The cell's text for one row. */
  readonly cell: (row: BrandRow) => string;
};

/** The columns of the brands table, in the order the page and its markdown endpoint print them. */
export const BRAND_COLUMNS: readonly BrandColumn[] = [
  { header: "Code", kind: "code", cell: (row) => row.code },
  { header: "Display name", kind: "text", cell: (row) => row.displayName },
  { header: "Segments", kind: "list", cell: (row) => row.segments.join(", ") },
];

/**
 * The slug of every legal theme, as the brands and segments page lists them.
 *
 * @returns The slugs in `LEGAL_THEMES` order.
 */
export function legalThemeSlugs(): readonly ThemeSlug[] {
  return LEGAL_THEMES.map(themeSlug);
}
