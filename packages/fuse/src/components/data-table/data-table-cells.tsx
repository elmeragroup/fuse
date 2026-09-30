"use client";

import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { formatCurrencyCell, formatDateCell, formatNumberCell } from "./data-table-format";
import type { DateFormatOptions, DateTimeFormatOptions, NumberFormatOptions } from "./data-table-format";
import { dataTableVariants } from "./data-table-variants";

const { cellNumber } = dataTableVariants();

type CellClassName = {
  /** Extra classes, merged last through `cn`. */
  className?: string;
};

/** Props for `DataTable.Text`. */
export type DataTableTextProps = CellClassName & {
  /** The text to render. */
  value: string;
};

/** Props for `DataTable.Number`. */
export type DataTableNumberProps = CellClassName &
  NumberFormatOptions & {
    /** The number to format for the active locale. */
    value: number;
  };

/** Props for `DataTable.Currency`. */
export type DataTableCurrencyProps = CellClassName &
  NumberFormatOptions & {
    /** The amount to format for the active locale. */
    value: number;
    /** The ISO 4217 currency code, such as `"NOK"`. Required: there is no sensible default. */
    currency: string;
  };

/** Props for `DataTable.Date`. */
export type DataTableDateProps = CellClassName &
  DateFormatOptions & {
    /** The date to format for the active locale. */
    value: Date;
  };

/** Props for `DataTable.DateTime`. */
export type DataTableDateTimeProps = CellClassName &
  DateTimeFormatOptions & {
    /** The date and time to format for the active locale. */
    value: Date;
  };

/** A text cell. */
export function DataTableText({ value, className }: DataTableTextProps): ReactElement {
  return (
    <span data-slot="data-table-text" className={className}>
      {value}
    </span>
  );
}

/** A number cell, formatted for the active locale with tabular figures. */
export function DataTableNumber({ value, className, ...options }: DataTableNumberProps): ReactElement {
  const { locale } = useLocale();
  return (
    <span data-slot="data-table-number" className={cn(cellNumber(), className)}>
      {formatNumberCell(locale, value, options)}
    </span>
  );
}

/** An amount in a currency, formatted for the active locale with tabular figures. */
export function DataTableCurrency({
  value,
  currency,
  className,
  ...options
}: DataTableCurrencyProps): ReactElement {
  const { locale } = useLocale();
  return (
    <span data-slot="data-table-currency" className={cn(cellNumber(), className)}>
      {formatCurrencyCell(locale, value, currency, options)}
    </span>
  );
}

/** A date, formatted for the active locale. `dateStyle` defaults to `"medium"`. */
export function DataTableDate({
  value,
  className,
  dateStyle = "medium",
  ...options
}: DataTableDateProps): ReactElement {
  const { locale } = useLocale();
  return (
    <span data-slot="data-table-date" className={className}>
      {formatDateCell(locale, value, { dateStyle, ...options })}
    </span>
  );
}

/**
 * A date and time, formatted for the active locale. `dateStyle` defaults to `"medium"` and
 * `timeStyle` to `"short"`.
 */
export function DataTableDateTime({
  value,
  className,
  dateStyle = "medium",
  timeStyle = "short",
  ...options
}: DataTableDateTimeProps): ReactElement {
  const { locale } = useLocale();
  return (
    <span data-slot="data-table-date-time" className={className}>
      {formatDateCell(locale, value, { dateStyle, timeStyle, ...options })}
    </span>
  );
}

DataTableText.displayName = "DataTable.Text";
DataTableNumber.displayName = "DataTable.Number";
DataTableCurrency.displayName = "DataTable.Currency";
DataTableDate.displayName = "DataTable.Date";
DataTableDateTime.displayName = "DataTable.DateTime";
