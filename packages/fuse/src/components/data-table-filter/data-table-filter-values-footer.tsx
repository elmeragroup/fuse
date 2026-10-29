"use client";

// The values footer: Select all, Clear all and Done under a value list. Both value lists provide
// the same context, the add menu's value submenu and the chip's option editor, so one consumer
// footer serves both and a part never learns whether a Menu or a Combobox holds it. Picks apply
// live, so the footer holds no draft and offers no Cancel.

import type { ComponentProps, ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import type { LabelButtonProps } from "../button/button";
import { chain } from "./chain-handlers";
import { useFilterInternals, useValueList } from "./data-table-filter-context";
import { DataTableFilterCompositionError } from "./data-table-filter-error";
import { dataTableFilterSlots as slots } from "./data-table-filter-variants";
import { firstOperator } from "./filter-fields";
import { allowsManyValues, canAddOptionValues, findFilter } from "./filter-model";
import { currentOrder, pickedValues, unpickedMatches } from "./option-list";

/** The props of `DataTableFilter.ValuesFooter`. */
export type DataTableFilterValuesFooterProps = ComponentProps<"div"> & {
  /**
   * The field ids whose lists show the footer. Without it, every option, multi-option and boolean
   * field's list shows it. Each id must be a key of the Root's `fields`.
   */
  fields?: readonly string[] | undefined;
};

/**
 * A row of actions at the foot of a value list, below its scrolling rows and always in view.
 * Render it in `DataTableFilter.FieldList`'s children for the add menu's value submenus and in
 * `DataTableFilter.OptionEditor`'s children for a chip's value popover, as one shared component.
 * Its children are the actions: `SelectAllValues`, `ClearValues` and `Done`.
 *
 * @throws DataTableFilterCompositionError outside a value list, or when `fields` lists an id the
 *   Root's fields do not have.
 */
export function DataTableFilterValuesFooter({
  fields,
  className,
  ...props
}: DataTableFilterValuesFooterProps): ReactElement | null {
  const { meta } = useFilterInternals("DataTableFilter.ValuesFooter");
  const list = useValueList("DataTableFilter.ValuesFooter");
  if (fields?.some((fieldId) => !Object.hasOwn(meta.fields, fieldId)) === true) {
    throw new DataTableFilterCompositionError("DataTableFilter.ValuesFooter", "unknown-field");
  }
  if (fields !== undefined && !fields.includes(list.fieldId)) {
    return null;
  }
  return (
    <div
      data-slot="data-table-filter-values-footer"
      className={cn(slots.valuesFooter(), className)}
      {...props}
    />
  );
}

/** The props of `DataTableFilter.SelectAllValues`, `ClearValues` and `Done`: a Fuse Button's. */
export type DataTableFilterValuesActionProps = LabelButtonProps;

/**
 * Picks every option the list's field offers now, past the 50 rows the list shows, beside the
 * values already picked, including options the host added while the list is open. With a search
 * it picks every option the search matches. It is disabled, and stays focusable, once every option
 * in its scope is picked, and while the chip's operator cannot hold that many values, such as
 * `is not` on a field that allows `is any of` but not `is none of`. It renders nothing on a boolean
 * or a single-select field. Children replace its label, "Select all".
 */
export function DataTableFilterSelectAllValues({
  children,
  disabled = false,
  onClick,
  ...props
}: DataTableFilterValuesActionProps): ReactElement | null {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.SelectAllValues");
  const { field, fieldId, order, query, contains } = useValueList("DataTableFilter.SelectAllValues");
  // A field that never holds two values leaves it out. One whose current operator cannot, while
  // another of its operators could, shows it disabled, so the row never shifts as the chip's
  // operator changes.
  if (field.kind === "boolean" || !allowsManyValues(field)) {
    return null;
  }
  const picked = pickedValues(field, findFilter(state.filters, fieldId));
  const pickedSet = new Set(picked);
  // The field's current options in the list's order, so options a host adds while the list is
  // open are in scope and removed ones are not. The check and the press read the same scope.
  const scope = currentOrder(order, field.options);
  // The walk stops at the second unpicked match. While fewer than two match, as when every option
  // in scope is picked or a search narrows to one, it walks every option on each render. Two tell
  // the count's form apart: the model's operators differ only between none, one and more.
  const sample = unpickedMatches(scope, query, contains, pickedSet, 2);
  const writable =
    sample.length > 0 &&
    canAddOptionValues(state.filters, fieldId, field, sample.length, firstOperator(field));
  return (
    <Button
      data-slot="data-table-filter-select-all"
      variant="ghost"
      size="sm"
      focusableWhenDisabled
      disabled={disabled || !writable}
      onClick={chain(() => {
        const added = unpickedMatches(scope, query, contains, pickedSet, Number.POSITIVE_INFINITY);
        actions.setOptions(fieldId, [...picked, ...added.map((option) => option.value)]);
      }, onClick)}
      {...definedProps(props)}>
      {children ?? meta.format("selectAll")}
    </Button>
  );
}

/**
 * Removes the filter of the list's field only, and the list stays open with focus on it. It is
 * disabled while the field has no filter, and stays focusable. `DataTableFilter.Clear` removes
 * every filter instead. Children replace its label, "Clear all".
 */
export function DataTableFilterClearValues({
  children,
  disabled = false,
  onClick,
  ...props
}: DataTableFilterValuesActionProps): ReactElement {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.ClearValues");
  const { fieldId } = useValueList("DataTableFilter.ClearValues");
  const empty = findFilter(state.filters, fieldId) === undefined;
  return (
    <Button
      data-slot="data-table-filter-clear-values"
      variant="ghost"
      size="sm"
      focusableWhenDisabled
      disabled={disabled || empty}
      onClick={chain(() => {
        actions.clearValues(fieldId);
      }, onClick)}
      {...definedProps(props)}>
      {children ?? meta.format("clearValues")}
    </Button>
  );
}

/**
 * Closes the list's overlay, the add menu or the value popover, and focus goes where that overlay
 * returns it: the Trigger, or the chip's Value. Picks have applied already. It sits at the
 * footer's inline end. Disabled, it stays focusable, as the other actions do. Children replace its
 * label, "Done".
 */
export function DataTableFilterDone({
  className,
  children,
  onClick,
  ...props
}: DataTableFilterValuesActionProps): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.Done");
  // Only for the composition error: Done closes whichever overlay holds its list.
  useValueList("DataTableFilter.Done");
  return (
    <Button
      data-slot="data-table-filter-done"
      variant="ghost"
      size="sm"
      focusableWhenDisabled
      className={cn(slots.done(), className)}
      onClick={chain(actions.close, onClick)}
      {...definedProps(props)}>
      {children ?? meta.format("done")}
    </Button>
  );
}

DataTableFilterValuesFooter.displayName = "DataTableFilter.ValuesFooter";
DataTableFilterSelectAllValues.displayName = "DataTableFilter.SelectAllValues";
DataTableFilterClearValues.displayName = "DataTableFilter.ClearValues";
DataTableFilterDone.displayName = "DataTableFilter.Done";
