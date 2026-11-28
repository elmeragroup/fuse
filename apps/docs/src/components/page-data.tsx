import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { INSTALL_COMMAND } from "../lib/docs-model";
import type { BrandColumn, BrandRow } from "../lib/page-data";
import { BRAND_COLUMNS, brandRows, legalThemeSlugs } from "../lib/page-data";
import { DocsPlainCodeBlock } from "./docs-code-block";
import { DocsTable } from "./docs-table";

/**
 * The elements an authored prose page renders from library data. The generation pass prints each
 * one in the page's markdown endpoint from the same data (`scripts/lib/page-data-markdown.ts`),
 * keyed by the element's name, and fails on an element it has no entry for.
 */

const pageData = tv({
  slots: {
    mono: "text-xs font-mono",
  },
});

const { mono } = pageData();

type BrandTableProps = {
  /** The id of the heading the table sits under, which names its scroller. */
  readonly labelledBy: string;
};

/** One cell of the brands table: a code cell as code, and a list cell in the monospace face. */
function BrandCell({ column, row }: { readonly column: BrandColumn; readonly row: BrandRow }): ReactElement {
  const text = column.cell(row);
  switch (column.kind) {
    case "code":
      return (
        <DocsTable.BodyCell>
          <code>{text}</code>
        </DocsTable.BodyCell>
      );
    case "list":
      return <DocsTable.BodyCell className={mono()}>{text}</DocsTable.BodyCell>;
    case "text":
      return <DocsTable.BodyCell>{text}</DocsTable.BodyCell>;
  }
}

/** Each brand's code, display name and segments, in `BRAND_COLUMNS`. */
export function BrandTable({ labelledBy }: BrandTableProps): ReactElement {
  return (
    <DocsTable.Wrap aria-labelledby={labelledBy}>
      <DocsTable.Root>
        <thead>
          <tr>
            {BRAND_COLUMNS.map((column) => (
              <DocsTable.HeaderCell key={column.header} scope="col">
                {column.header}
              </DocsTable.HeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {brandRows().map((row) => (
            <tr key={row.code}>
              {BRAND_COLUMNS.map((column) => (
                <BrandCell key={column.header} column={column} row={row} />
              ))}
            </tr>
          ))}
        </tbody>
      </DocsTable.Root>
    </DocsTable.Wrap>
  );
}

/** How many legal themes there are, as text. */
export function LegalThemeCount(): string {
  return String(legalThemeSlugs().length);
}

/** The slug of every legal theme, one per list item. */
export function ThemeSlugList(): ReactElement {
  return (
    <ul className={mono()}>
      {legalThemeSlugs().map((slug) => (
        <li key={slug}>{slug}</li>
      ))}
    </ul>
  );
}

/** The command that installs the package. */
export function InstallCommand(): ReactElement {
  return <DocsPlainCodeBlock text={INSTALL_COMMAND} />;
}
