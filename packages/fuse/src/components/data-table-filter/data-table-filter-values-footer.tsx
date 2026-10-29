"use client";

// The values footer: Select all, Clear all and Done under a value list. Both value lists provide
// the same context, the add menu's value submenu and the chip's option editor, so one consumer
// footer serves both and a part never learns whether a Menu or a Combobox holds it. Picks apply
// live, so the footer holds no draft and offers no Cancel.

import { createContext, use } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import type { LabelButtonProps } from "../button/button";
import { useFilterInternals } from "./data-table-filter-context";
import { DataTableFilterCompositionError } from "./data-table-filter-error";
import { dataTableFilterSlots as slots } from "./data-table-filter-variants";
import { firstOperator } from "./filter-fields";
import { allowsManyValues, canSetOptionCount, findFilter } from "./filter-model";
import { currentOrder, pickedValues, unpickedMatches } from "./option-list";
import type { ListField, OptionOrder } from "./option-list";

/**
 * The value list a footer part sits in, in the Root context's shape. Each list provides it around
 * the consumer's footer, so the parts read the list's field, order and query, and write through the
 * Root.
 */
type ValueListContextValue = {
  readonly state: {
    /** The listed field's column id. */
    readonly fieldId: string;
    /** The listed field. */
    readonly field: ListField;
    /** The list's order, taken as it opened. */
    readonly order: OptionOrder;
    /** The list's search. */
    readonly query: string;
  };
  readonly actions: {
    /** Sets an option or multi-option field's values in one write. */
    readonly setValues: (values: readonly string[]) => void;
    /** Removes the field's filter, and the list stays open. */
    readonly clear: () => void;
    /** Closes the add menu and the value popover. */
    readonly close: () => void;
  };
  readonly meta: {
    /** The locale's matcher, the one the list filters its rows with. */
    readonly contains: (text: string, query: string) => boolean;
  };
};

const ValueListContext = createContext<ValueListContextValue | null>(null);

/**
 * Provides a value list to the consumer's footer. The add menu's value submenu and the chip's
 * option editor each render it after their list, with their own order and query.
 *
 * @param props - The listed field, the list's order and query, the matcher and the footer.
 * @returns The footer, inside the list's context.
 */
export function ValueListProvider({
  fieldId,
  field,
  order,
  query,
  contains,
  children,
}: {
  readonly fieldId: string;
  readonly field: ListField;
  readonly order: OptionOrder;
  readonly query: string;
  readonly contains: (text: string, query: string) => boolean;
  readonly children: ReactNode;
}): ReactElement {
  const { actions } = useFilterInternals("DataTableFilter.ValuesFooter");
  const value: ValueListContextValue = {
    state: { fieldId, field, order, query },
    actions: {
      setValues: (values) => {
        actions.setOptions(fieldId, values);
      },
      clear: () => {
        actions.clearValues(fieldId);
      },
      close: actions.close,
    },
    meta: { contains },
  };
  return <ValueListContext value={value}>{children}</ValueListContext>;
}

/**
 * The value list a footer part sits in.
 *
 * @param part - The part's name, for the error.
 * @returns The list's context.
 */
function useValueList(part: string): ValueListContextValue {
  const list = use(ValueListContext);
  if (list === null) {
    throw new DataTableFilterCompositionError(part, "outside-value-list");
  }
  return list;
}

/** Runs the consumer's handler, then the part's own unless the consumer prevented it. */
function chain<E extends { readonly defaultPrevented: boolean }>(
  own: () => void,
  theirs: ((event: E) => void) | undefined
): (event: E) => void {
  return (event) => {
    theirs?.(event);
    if (!event.defaultPrevented) {
      own();
    }
  };
}

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
  const { state } = useValueList("DataTableFilter.ValuesFooter");
  if (fields?.some((fieldId) => !Object.hasOwn(meta.fields, fieldId)) === true) {
    throw new DataTableFilterCompositionError("DataTableFilter.ValuesFooter", "unknown-field");
  }
  if (fields !== undefined && !fields.includes(state.fieldId)) {
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
 * values already picked, including options the host added while the list is open. With a search it picks every option the search matches. It is disabled, and
 * stays focusable, once every option in its scope is picked, and while the chip's operator cannot
 * hold that many values, such as `is not` on a field that allows `is any of` but not
 * `is none of`. It renders nothing on a boolean or a single-select field. Children replace its
 * label, "Select all".
 */
export function DataTableFilterSelectAllValues({
  children,
  disabled = false,
  onClick,
  ...props
}: DataTableFilterValuesActionProps): ReactElement | null {
  const { state: root, meta } = useFilterInternals("DataTableFilter.SelectAllValues");
  const { state, actions, meta: list } = useValueList("DataTableFilter.SelectAllValues");
  const { field, fieldId, order, query } = state;
  // A field that never holds two values leaves it out. One whose current operator cannot, while
  // another of its operators could, shows it disabled, so the row never shifts as the chip's
  // operator changes.
  if (field.kind === "boolean" || !allowsManyValues(field)) {
    return null;
  }
  const picked = pickedValues(field, findFilter(root.filters, fieldId));
  const pickedSet = new Set(picked);
  // The field's current options in the list's order, so options a host adds while the list is
  // open are in scope and removed ones are not. The check and the press read the same scope.
  const scope = currentOrder(order, field.options);
  // The walk stops at the second unpicked match, so a large field walks all its options only on a
  // press, or while every option in scope is picked. Two tell the count's form apart: the model's
  // operators differ only between none, one and more.
  const sample = unpickedMatches(scope, query, list.contains, pickedSet, 2);
  const offered = new Set(field.options.map((option) => option.value));
  const count = picked.filter((value) => offered.has(value)).length + sample.length;
  const writable =
    sample.length > 0 && canSetOptionCount(root.filters, fieldId, field, count, firstOperator(field));
  return (
    <Button
      data-slot="data-table-filter-select-all"
      variant="ghost"
      size="sm"
      focusableWhenDisabled
      disabled={disabled || !writable}
      onClick={chain(() => {
        const added = unpickedMatches(scope, query, list.contains, pickedSet, Number.POSITIVE_INFINITY);
        actions.setValues([...picked, ...added.map((option) => option.value)]);
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
  const { state: root, meta } = useFilterInternals("DataTableFilter.ClearValues");
  const { state, actions } = useValueList("DataTableFilter.ClearValues");
  const empty = findFilter(root.filters, state.fieldId) === undefined;
  return (
    <Button
      data-slot="data-table-filter-clear-values"
      variant="ghost"
      size="sm"
      focusableWhenDisabled
      disabled={disabled || empty}
      onClick={chain(actions.clear, onClick)}
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
  const { meta } = useFilterInternals("DataTableFilter.Done");
  const { actions } = useValueList("DataTableFilter.Done");
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
