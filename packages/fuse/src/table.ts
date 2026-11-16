// This file is the source entry for `@elmeragroup/fuse/table`. It contains only explicit named re-exports,
// with no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. It exports no recipe.
export { Table, VerticalTable } from "./components/table/table";
export type {
  TableBodyProps,
  TableCaptionProps,
  TableCellProps,
  TableFooterProps,
  TableHeaderProps,
  TableHeadProps,
  TableRootProps,
  TableRowProps,
  VerticalTableBodyProps,
  VerticalTableHeaderProps,
  VerticalTableItem,
  VerticalTableKeyProps,
  VerticalTableRootProps,
  VerticalTableRowProps,
  VerticalTableValueProps,
} from "./components/table/table";
