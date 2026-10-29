import { DataTableFilterRoot } from "./data-table-filter";
/**
 * Server-visible namespace for `DataTableFilter`.
 * The implementation stays in client modules. This file has no directive, so a server component
 * can read each part instead of dotting into a client reference.
 */
import {
  DataTableFilterBar,
  DataTableFilterChip,
  DataTableFilterChips,
  DataTableFilterClear,
  DataTableFilterOperator,
  DataTableFilterRemove,
  DataTableFilterSubject,
  DataTableFilterTrigger,
  DataTableFilterValue,
} from "./data-table-filter-bar";
import { DataTableFilterContent, DataTableFilterFieldList } from "./data-table-filter-content";
import {
  DataTableFilterDateEditor,
  DataTableFilterNumberEditor,
  DataTableFilterOptionEditor,
  DataTableFilterTextEditor,
} from "./data-table-filter-editors";
import { DataTableFilterEditor, DataTableFilterValueContent } from "./data-table-filter-value-content";
import {
  DataTableFilterClearValues,
  DataTableFilterDone,
  DataTableFilterSelectAllValues,
  DataTableFilterValuesFooter,
} from "./data-table-filter-values-footer";

export const DataTableFilter = {
  Root: DataTableFilterRoot,
  Bar: DataTableFilterBar,
  Trigger: DataTableFilterTrigger,
  Chips: DataTableFilterChips,
  Chip: DataTableFilterChip,
  Subject: DataTableFilterSubject,
  Operator: DataTableFilterOperator,
  Value: DataTableFilterValue,
  Remove: DataTableFilterRemove,
  Clear: DataTableFilterClear,
  Content: DataTableFilterContent,
  FieldList: DataTableFilterFieldList,
  ValueContent: DataTableFilterValueContent,
  Editor: DataTableFilterEditor,
  OptionEditor: DataTableFilterOptionEditor,
  TextEditor: DataTableFilterTextEditor,
  NumberEditor: DataTableFilterNumberEditor,
  DateEditor: DataTableFilterDateEditor,
  ValuesFooter: DataTableFilterValuesFooter,
  SelectAllValues: DataTableFilterSelectAllValues,
  ClearValues: DataTableFilterClearValues,
  Done: DataTableFilterDone,
};
