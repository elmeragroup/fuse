// Field config: a plain object per filterable column, keyed by column id, discriminated by `kind`
// and checked against the row type. Serializable apart from icons, so a server module can define
// the map and pass it to the client Root.

import type { ReactNode } from "react";

import type { FilterKind, FilterOperator } from "./filter-model";

type FieldBase = {
  /** The field's name: the chip's subject, the menu row and the editor's title. */
  readonly label: string;
  /** Shown at 16px beside the label and hidden from assistive technology. */
  readonly icon?: ReactNode;
};

/**
 * One value an option field offers.
 *
 * @template V - The option's stored value.
 */
export type FilterOption<V extends string = string> = {
  /** The value the filter stores and the cell holds. */
  readonly value: V;
  /** The value's name in lists and summaries. */
  readonly label: string;
  /** Shown at 16px before the label and hidden from assistive technology. */
  readonly icon?: ReactNode;
};

/**
 * A field whose cell holds one value from a known set, such as a status.
 *
 * @template V - The option values.
 */
export type OptionFilterField<V extends string = string> = FieldBase & {
  readonly kind: "option";
  /** Any length. A list shows its first 50 matches and asks for more typing. */
  readonly options: readonly FilterOption<V>[];
  /**
   * A subset of the option operators, in menu order. Defaults to all of them. A listed
   * multi-value operator also allows its one-value sibling, so `["isAnyOf"]` starts a filter at
   * `is`. Without a multi-value operator, as in `["is", "isNot"]`, the field is single-select: a
   * second pick replaces the first.
   */
  readonly operators?: readonly FilterOperator<"option">[];
  /** List order: config order, the default, or by count with the highest first. */
  readonly order?: "options" | "count";
};

/**
 * A field whose cell holds an array of values from a known set, such as tags.
 *
 * @template V - The option values.
 */
export type MultiOptionFilterField<V extends string = string> = Omit<
  OptionFilterField<V>,
  "kind" | "operators"
> & {
  readonly kind: "multiOption";
  /**
   * A subset of the multi-option operators, in menu order. Defaults to all of them. A listed
   * multi-value operator also allows its one-value sibling, and without one the field is
   * single-select, as for an option field.
   */
  readonly operators?: readonly FilterOperator<"multiOption">[];
};

/** A field whose cell holds free text, matched case- and accent-insensitively. */
export type TextFilterField = FieldBase & {
  readonly kind: "text";
  /** The text editor's placeholder. Defaults to the dictionary's. */
  readonly placeholder?: string;
  /**
   * A subset of the text operators, in menu order. Defaults to `contains` and `doesNotContain`.
   * List `startsWith` or `doesNotStartWith` to offer them.
   */
  readonly operators?: readonly FilterOperator<"text">[];
};

/** A field whose cell holds a number. */
export type NumberFilterField = FieldBase & {
  readonly kind: "number";
  /** Formats the editor, the chip's summary and the slider's value text. */
  readonly format?: Intl.NumberFormatOptions;
  /** The slider's lower bound when no facet range is known. Used only together with `max`. */
  readonly min?: number;
  /** The slider's upper bound when no facet range is known. Used only together with `min`. */
  readonly max?: number;
  /** The slider's and the number fields' step. Defaults to 1. */
  readonly step?: number;
  /** A subset of the number operators, in menu order. Defaults to all of them. */
  readonly operators?: readonly FilterOperator<"number">[];
};

/** A field whose cell holds a `Date` or an ISO calendar date, compared as a calendar day. */
export type DateFilterField = FieldBase & {
  readonly kind: "date";
  /**
   * A subset of the date operators, in menu order. Defaults to all of them. The presets write
   * `isBetween`, so without it the editor offers only Today, as `is`, and no preset without `is`
   * either.
   */
  readonly operators?: readonly FilterOperator<"date">[];
};

/** Any field. */
export type FilterField =
  | OptionFilterField
  | MultiOptionFilterField
  | TextFilterField
  | NumberFilterField
  | DateFilterField;

/**
 * The field of one kind.
 *
 * @template K - The kind.
 */
export type FilterFieldOfKind<K extends FilterKind> = Extract<FilterField, { readonly kind: K }>;

/** The fields a cell type admits. An ISO date string may be a date field. */
type FieldFor<V> = [NonNullable<V>] extends [Date]
  ? DateFilterField
  : [NonNullable<V>] extends [number]
    ? NumberFilterField
    : [NonNullable<V>] extends [readonly (infer E extends string)[]]
      ? MultiOptionFilterField<E>
      : [NonNullable<V>] extends [string]
        ? string extends NonNullable<V>
          ? TextFilterField | OptionFilterField | DateFilterField
          : OptionFilterField<NonNullable<V>> | TextFilterField
        : FilterField;

/**
 * A fields map for a row type. A key that is a row key takes only the fields its cell type
 * admits. Any other key, such as an accessor function column's id, takes any field.
 *
 * @template TRow - The table's row type.
 */
export type FilterFields<TRow> = { readonly [K in keyof TRow & string]?: FieldFor<TRow[K]> } & {
  readonly [columnId: string]: FilterField;
};

/** Any fields map, as the Root reads it. */
export type FilterFieldMap = { readonly [columnId: string]: FilterField };

/**
 * Pins a fields map to a row type: an option's values must be the column's values, and a kind
 * must fit the column's type. Pass the row type once, as with `createColumnHelper<TRow>()`, and
 * the map's literal type is inferred.
 *
 * @template TRow - The table's row type.
 * @returns A function that returns the map it receives, typed as written.
 */
export function defineFilterFields<TRow>(): <const TFields extends FilterFields<TRow>>(
  fields: TFields
) => TFields {
  return (fields) => fields;
}

/**
 * The facet a field takes. It distributes over a union, so a map typed as `FilterFieldMap`, whose
 * every entry is any field, takes the facet of any kind.
 */
type FacetFor<TField> = TField extends { readonly kind: "option" | "multiOption" }
  ? { readonly counts: Readonly<Record<string, number>> }
  : TField extends { readonly kind: "number" }
    ? { readonly range: readonly [number, number] }
    : never;

/**
 * Server truth per field: counts for option fields and a range for number fields. An absent entry
 * means unknown, and a list then shows no counts and the number editor no slider.
 *
 * @template TFields - The fields map.
 */
export type FilterFacets<TFields> = { readonly [K in keyof TFields]?: FacetFor<TFields[K]> };

/** The facets shape the Root reads at runtime. */
export type AnyFilterFacets = {
  readonly [columnId: string]:
    | { readonly counts?: Readonly<Record<string, number>>; readonly range?: readonly [number, number] }
    | undefined;
};

/**
 * The operator a new filter starts with: the field's first allowed operator, else the kind's
 * default for one value, or `isBetween` for a number or date.
 *
 * @param field - The field.
 * @returns The operator.
 */
export function firstOperator(field: FilterField): FilterOperator {
  const [first] = field.operators ?? [];
  if (first !== undefined) {
    return first;
  }
  switch (field.kind) {
    case "option":
      return "is";
    case "multiOption":
      return "includes";
    case "text":
      return "contains";
    case "number":
    case "date":
      return "isBetween";
  }
}

/**
 * The options of an option field, or none for other kinds.
 *
 * @param field - The field.
 * @returns Its options.
 */
export function optionsOf(field: FilterField): readonly FilterOption[] {
  return field.kind === "option" || field.kind === "multiOption" ? field.options : [];
}
