/**
 * The markdown of each library-data element a prose page renders (`src/components/page-data.tsx`),
 * keyed by the element's name. The page and this module read the same rows from
 * `src/lib/page-data.ts`, so a page's markdown endpoint lists what the page lists.
 */

import { INSTALL_COMMAND } from "../../src/lib/docs-model.ts";
import type { BrandRow } from "../../src/lib/page-data.ts";
import { BRAND_COLUMNS, brandRows, legalThemeSlugs } from "../../src/lib/page-data.ts";
import { markdownTable } from "./markdown.ts";

/**
 * The brands table as markdown, one row per brand, in `BRAND_COLUMNS`. A code cell prints as code.
 *
 * @param rows - The brand rows, in the order the table lists them.
 * @returns The table, without a closing newline.
 */
export function brandTableMarkdown(rows: readonly BrandRow[]): string {
  return markdownTable(
    BRAND_COLUMNS.map((column) => column.header),
    rows.map((row) =>
      BRAND_COLUMNS.map((column) => (column.kind === "code" ? `\`${column.cell(row)}\`` : column.cell(row)))
    )
  );
}

/**
 * The markdown that stands in for each library-data element, by element name. An element that
 * renders inline, such as the theme count, prints inline text, and a block element prints a block.
 */
export const PAGE_DATA_MARKDOWN: ReadonlyMap<string, () => string> = new Map([
  ["BrandTable", () => brandTableMarkdown(brandRows())],
  ["LegalThemeCount", () => String(legalThemeSlugs().length)],
  [
    "ThemeSlugList",
    () =>
      legalThemeSlugs()
        .map((slug) => `- \`${slug}\``)
        .join("\n"),
  ],
  ["InstallCommand", () => ["```sh", INSTALL_COMMAND, "```"].join("\n")],
]);
