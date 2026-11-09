import type { ReactElement, ReactNode } from "react";

import { DocsInlineCode } from "../../../../../components/docs-inline-code";
import { DocsTable } from "../../../../../components/docs-table";

/** One table row: a cell per column, holding code and prose. */
export type Row = readonly ReactNode[];

/** Inline code, as the docs' `InlineCode` renders a backtick span, so cells and notes match. */
export function c(text: string): ReactElement {
  return <DocsInlineCode>{text}</DocsInlineCode>;
}

/** A mapping table: one header row of column names, then the rows as given. */
export function MappingTable({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: readonly Row[];
}): ReactElement {
  return (
    <DocsTable.Wrap>
      <DocsTable.Root>
        <thead>
          <tr>
            {columns.map((column) => (
              <DocsTable.HeaderCell key={column} scope="col">
                {column}
              </DocsTable.HeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // The rows are a fixed literal list; their order is their identity.
            <tr key={index}>
              {row.map((cell, column) => (
                // Long code spans break anywhere, so the columns fit the prose measure; prose
                // words still break only between words. Each line of a broken chip keeps its
                // own border and padding.
                <DocsTable.BodyCell
                  key={column}
                  className="[&_code]:box-decoration-clone [&_code]:wrap-anywhere">
                  {cell}
                </DocsTable.BodyCell>
              ))}
            </tr>
          ))}
        </tbody>
      </DocsTable.Root>
    </DocsTable.Wrap>
  );
}
