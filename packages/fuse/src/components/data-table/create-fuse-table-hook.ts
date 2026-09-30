"use client";

import type { ComponentType, ReactElement } from "react";

import { createTableHook } from "@tanstack/react-table";
import type {
  Column,
  CreateTableHookOptions,
  CreateTableHookResult,
  Row,
  RowData,
  TableFeatures,
} from "@tanstack/react-table";

import { fuseTableContexts } from "./data-table-contexts";
import {
  CurrencyCell,
  DateCell,
  DateTimeCell,
  NumberCell,
  RegisteredColumnToggle,
  RegisteredContent,
  RegisteredPagination,
  RegisteredRow,
  RegisteredSortButton,
  TextCell,
} from "./data-table-registered";
import type {
  CurrencyCellProps,
  DateCellProps,
  DateTimeCellProps,
  NumberCellProps,
  RegisteredColumnToggleProps,
  RegisteredContentProps,
  RegisteredPaginationProps,
  RegisteredRowProps,
  RegisteredSortButtonProps,
  TextCellProps,
} from "./data-table-registered";
import type { NoComponents } from "./data-table-source";

/** A registry of named components, as `createTableHook` accepts them. */
// oxlint-disable-next-line typescript/no-explicit-any -- SAFETY: createTableHook's own registry constraint; a component's props are contravariant, so only `any` admits every component
type ComponentRegistry = Record<string, ComponentType<any>>;

/**
 * The app's table registry. A replacement `Row` must accept the props `table.Content` renders its
 * default rows with, since the registered parts call it with only those.
 */
type TableRegistry<TFeatures extends TableFeatures> = ComponentRegistry & {
  // oxlint-disable-next-line typescript/no-explicit-any -- SAFETY: the app's row data type is bound per column helper, not per hook, so the constraint admits a Row typed over any of them
  readonly Row?: ComponentType<RegisteredRowProps<Row<TFeatures, any>>>;
};

/**
 * The app's registry wins by key, and a replaced Fuse component's props are gone. An intersection
 * would overload the two and keep accepting the replaced props.
 */
type Merge<TFuse, TApp> = Omit<TFuse, keyof TApp> & TApp;

/** Includes `TPart` exactly when `TFeatures` registers `TFeature`. */
type WithFeature<TFeatures, TFeature extends string, TPart> = TFeature extends keyof TFeatures
  ? TPart
  : NoComponents;

/**
 * The table parts Fuse registers on the table `useFuseTable` returns. `Pagination` and
 * `ColumnToggle` appear only with their feature.
 */
export type FuseTableComponents<TFeatures extends TableFeatures> = {
  /** The whole table, rendered through the registered header and cell wrappers. */
  Content: <TData extends RowData = RowData>(
    props: RegisteredContentProps<Row<TFeatures, TData>>
  ) => ReactElement;
  /** One row. It renders inside `Content`'s row takeover, which keeps it current. */
  Row: <TData extends RowData = RowData>(props: RegisteredRowProps<Row<TFeatures, TData>>) => ReactElement;
} & WithFeature<
  TFeatures,
  "rowPaginationFeature",
  {
    /** Rows-per-page select, page status and page buttons. */
    Pagination: (props: RegisteredPaginationProps) => ReactElement;
  }
> &
  WithFeature<
    TFeatures,
    "columnVisibilityFeature",
    {
      /** The column visibility menu. */
      ColumnToggle: <TData extends RowData = RowData>(
        props: RegisteredColumnToggleProps<Column<TFeatures, TData, unknown>>
      ) => ReactElement;
    }
  >;

/** The header parts Fuse registers. `SortButton` appears only with `rowSortingFeature`. */
export type FuseHeaderComponents<TFeatures extends TableFeatures> = WithFeature<
  TFeatures,
  "rowSortingFeature",
  {
    /** The header's sort toggle. */
    SortButton: (props: RegisteredSortButtonProps) => ReactElement;
  }
>;

/** The default cells Fuse registers. An app replaces one by registering its own under the key. */
export type FuseCellComponents = {
  /** The cell value as text. */
  TextCell: (props: TextCellProps) => ReactElement;
  /** A number, formatted for the locale. */
  NumberCell: (props: NumberCellProps) => ReactElement;
  /** An amount in a required currency, formatted for the locale. */
  CurrencyCell: (props: CurrencyCellProps) => ReactElement;
  /** A date, formatted for the locale. */
  DateCell: (props: DateCellProps) => ReactElement;
  /** A date and time, formatted for the locale. */
  DateTimeCell: (props: DateTimeCellProps) => ReactElement;
};

/**
 * Options for `createFuseTableHook`: every `createTableHook` option except the contexts, which
 * Fuse owns.
 */
export type CreateFuseTableHookOptions<
  TFeatures extends TableFeatures,
  TTableComponents extends TableRegistry<TFeatures>,
  TCellComponents extends ComponentRegistry,
  THeaderComponents extends ComponentRegistry,
> = CreateTableHookOptions<TFeatures, TTableComponents, TCellComponents, THeaderComponents> & {
  /** Fuse owns the table context. */
  readonly tableContext?: never;
  /** Fuse owns the cell context. */
  readonly cellContext?: never;
  /** Fuse owns the header context. */
  readonly headerContext?: never;
};

/** What `createFuseTableHook` returns: `createTableHook`'s result over the merged registries. */
export type CreateFuseTableHookResult<
  TFeatures extends TableFeatures,
  TTableComponents extends TableRegistry<TFeatures>,
  TCellComponents extends ComponentRegistry,
  THeaderComponents extends ComponentRegistry,
> = CreateTableHookResult<
  TFeatures,
  Merge<FuseTableComponents<TFeatures>, TTableComponents>,
  Merge<FuseCellComponents, TCellComponents>,
  Merge<FuseHeaderComponents<TFeatures>, THeaderComponents>
>;

/**
 * Erased to the registry constraint: the parts are typed over every stock feature, which TypeScript
 * cannot compare with the app's `TFeatures`, so the factory retypes them with one cast.
 */
// oxlint-disable-next-line anti-slop/no-known-value-widening -- deliberate erasure; see above
const FUSE_TABLE_COMPONENTS: ComponentRegistry = {
  Content: RegisteredContent,
  Row: RegisteredRow,
  Pagination: RegisteredPagination,
  ColumnToggle: RegisteredColumnToggle,
};

const FUSE_HEADER_COMPONENTS = { SortButton: RegisteredSortButton };

const FUSE_CELL_COMPONENTS: FuseCellComponents = {
  TextCell,
  NumberCell,
  CurrencyCell,
  DateCell,
  DateTimeCell,
};

/** Fuse's parts first, then the app's, so the app wins by key at runtime, as `Merge` describes. */
function mergeRegistry<TFuse extends ComponentRegistry, TApp extends ComponentRegistry>(
  fuse: TFuse,
  app: TApp | undefined
): Merge<TFuse, TApp> {
  // SAFETY: an omitted registry option leaves `TApp` at its `NoComponents` default, which the
  // empty registry is. Only explicit type arguments without the option break this.
  return { ...fuse, ...(app ?? ({} as TApp)) };
}

/**
 * Bind an app's table features, default options and components into one `useFuseTable` hook, with
 * Fuse's parts registered: `table.Content`, `table.Row`, `table.Pagination`,
 * `table.ColumnToggle`, `header.SortButton` and the default cells `TextCell`, `NumberCell`,
 * `CurrencyCell`, `DateCell` and `DateTimeCell`.
 *
 * It wraps TanStack's `createTableHook` and passes `features` and every default option through
 * untouched; Fuse adds no features of its own. The app's components are registered after Fuse's,
 * so registering `cellComponents: { NumberCell }` replaces Fuse's `NumberCell`, props included. A
 * registered part appears in the types only when its feature is in `features`: `Pagination` needs
 * `rowPaginationFeature`, `ColumnToggle` `columnVisibilityFeature` and `SortButton`
 * `rowSortingFeature`. Render the registered table parts inside `<table.AppTable>`.
 *
 * @example
 * ```tsx
 * export const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
 *   features: tableFeatures({ rowPaginationFeature, rowSortingFeature }),
 *   enableSortingRemoval: false,
 *   cellComponents: { OrderIdCell },
 * });
 * ```
 *
 * @template TFeatures - The app's `tableFeatures({...})` object.
 * @template TTableComponents - The app's table components.
 * @template TCellComponents - The app's cell components.
 * @template THeaderComponents - The app's header components.
 * @param options - Features, default table options and the app's components.
 * @returns TanStack's table hook result, typed with Fuse's parts merged under the app's.
 */
export function createFuseTableHook<
  TFeatures extends TableFeatures,
  const TTableComponents extends TableRegistry<TFeatures> = NoComponents,
  const TCellComponents extends ComponentRegistry = NoComponents,
  const THeaderComponents extends ComponentRegistry = NoComponents,
>(
  options: CreateFuseTableHookOptions<TFeatures, TTableComponents, TCellComponents, THeaderComponents>
): CreateFuseTableHookResult<TFeatures, TTableComponents, TCellComponents, THeaderComponents> {
  // SAFETY: Fuse's parts read the context table typed over every stock feature, and a registered
  // part reads a feature's members only when its public type is present. The public type lists
  // Pagination and ColumnToggle only with their feature and types rows and columns over the app's
  // `TFeatures`, which TanStack's feature-mapped `Row` and `Column` keep TypeScript from relating
  // to the stock features.
  const fuseTableComponents = FUSE_TABLE_COMPONENTS as FuseTableComponents<TFeatures>;
  // The header part's props name no feature, so it satisfies either branch of `WithFeature`.
  const fuseHeaderComponents: FuseHeaderComponents<TFeatures> = FUSE_HEADER_COMPONENTS;
  return createTableHook({
    ...options,
    tableContext: fuseTableContexts.tableContext,
    cellContext: fuseTableContexts.cellContext,
    headerContext: fuseTableContexts.headerContext,
    tableComponents: mergeRegistry(fuseTableComponents, options.tableComponents),
    cellComponents: mergeRegistry(FUSE_CELL_COMPONENTS, options.cellComponents),
    headerComponents: mergeRegistry(fuseHeaderComponents, options.headerComponents),
  });
}
