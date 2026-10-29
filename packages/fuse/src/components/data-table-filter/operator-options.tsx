"use client";

// The operator Select's items and list, shared by the chip's operator and the editor header's.
// Each caller keeps its own trigger.

import type { ReactElement } from "react";

import type { SelectContentProps } from "../select/select";
import { SelectContent, SelectItem } from "../select/select";
import { useFilterInternals } from "./data-table-filter-context";
import type { FilterField } from "./filter-fields";
import type { FilterOperator, FilterValue } from "./filter-model";
import { operatorChoices } from "./filter-model";

/** One operator in the Select, with its label. */
export type OperatorItem = { readonly value: FilterOperator; readonly label: string };

/**
 * The operators a field's Select lists, labelled: the chip's own choices, so an applied operator
 * the config has since left out still shows its label as the current choice. A current operator
 * the config left out before it was ever applied keeps its label too.
 *
 * @param part - The calling part's name, for the error outside a Root.
 * @param field - The field.
 * @param fieldId - The field's id, which `formatOperator` receives.
 * @param filter - The applied filter, if any.
 * @param current - The Select's current operator.
 * @returns The items, in menu order.
 */
export function useOperatorItems(
  part: string,
  field: FilterField,
  fieldId: string,
  filter: FilterValue | undefined,
  current: FilterOperator
): readonly OperatorItem[] {
  const { meta } = useFilterInternals(part);
  const choices = operatorChoices(field, filter);
  return (choices.includes(current) ? choices : [current, ...choices]).map((operator) => ({
    value: operator,
    label: meta.formatOperator(operator, field.kind, fieldId),
  }));
}

/** The operator Select's popup, listing its items. */
export function OperatorOptions({
  items,
  ...props
}: Pick<SelectContentProps, "align" | "ref"> & { readonly items: readonly OperatorItem[] }): ReactElement {
  return (
    <SelectContent alignItemWithTrigger={false} {...props}>
      {items.map((item) => (
        <SelectItem key={item.value} value={item.value}>
          {item.label}
        </SelectItem>
      ))}
    </SelectContent>
  );
}
