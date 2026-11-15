// This is the source entry facade for `@elmeragroup/fuse/table`. It holds explicit named re-exports
// and no `export *`, local declaration or directive. The exports and barrel generators discover
// this file, so never hand-edit `package.json#exports` or `src/index.ts`. It exports no recipe.
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
