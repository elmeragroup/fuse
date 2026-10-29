"use client";

// The filter's context contracts and their readers: what DataTableFilter.Root provides, what a
// custom part reads through `useDataTableFilter()`, and the wiring the library's own parts read.
// The Root owns the state and fills these contexts. Every part reads them from here, so a part
// never imports the Root's orchestration.

import { createContext, use, useCallback, useLayoutEffect, useRef, useState } from "react";

import type { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import type { SupportedLocale } from "../../intl/locale-context";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { DataTableFilterCompositionError } from "./data-table-filter-error";
import type { DataTableFilterCompositionRule } from "./data-table-filter-error";
import type { FacetReader } from "./filter-facets";
import type { FilterField, FilterFieldMap } from "./filter-fields";
import { resolveFocusTarget } from "./filter-focus";
import type { DataTableFilterState, FilterKind, FilterOperator, FilterValue } from "./filter-model";
import type { DataTableFilterStringKey } from "./intl";
import type { ListField, OptionOrder } from "./option-list";

export type { FacetReader } from "./filter-facets";

/** The payload each chip's Value hands the shared value popover. */
export type ValuePayload = { readonly fieldId: string };

/** One chip: a filter, or a ghost whose editor emptied it and is still open. */
export type ChipFilter = {
  /** The field's column id. */
  readonly id: string;
  /** The field's config. */
  readonly field: FilterField;
  /** The applied value. A ghost keeps the value it had before its editor emptied it. */
  readonly value: FilterValue;
  /**
   * The chip shows while its editor is open, but no filter is applied, because its editor emptied
   * it. It leaves when the editor closes.
   */
  readonly ghost: boolean;
};

/**
 * What a custom part reads through `useDataTableFilter()`: the filters, the chip being edited,
 * the decisions a part may make and the field metadata. The overlay handles, element ids and
 * focus bookkeeping stay with the library's own parts, so reworking them never breaks a custom
 * part.
 */
export type DataTableFilterContextValue = {
  readonly state: {
    /** The applied filters, in chip order. */
    readonly filters: DataTableFilterState;
    /** The chips to render: the filters, plus a ghost chip in its place. */
    readonly chips: readonly ChipFilter[];
    /** The field whose editor is open in the value popover, or null after its close animation. */
    readonly editing: string | null;
    /** The field whose editor shows in place in the add menu, or null after the menu closes. */
    readonly drilled: string | null;
  };
  readonly actions: {
    /**
     * Ticks or unticks an option value, and the operator follows the value count. On a boolean
     * field the values are `"true"` and `"false"`, and a pick replaces the other. On a toggle,
     * `"true"` turns it on or off.
     */
    readonly toggle: (fieldId: string, optionValue: string) => void;
    /** Sets a filter's operator and values. An empty list removes the filter. */
    readonly setValues: (
      fieldId: string,
      operator: FilterOperator,
      values: readonly (string | number | boolean)[]
    ) => void;
    /** Sets a filter's operator and converts its values to the operator's shape. */
    readonly setOperator: (fieldId: string, operator: FilterOperator) => void;
    /** Removes a filter and moves focus to a neighbouring chip, else the Trigger. */
    readonly remove: (fieldId: string) => void;
    /** Removes every filter and moves focus to the Trigger. */
    readonly clear: () => void;
    /**
     * Opens a field's editor. A field with a chip opens in the value popover, after the add menu
     * has closed if it is open. A text, number or date field with no chip opens in place in the
     * add menu, which opens if it is closed. An option or boolean field with no chip does nothing,
     * since its values open from the menu's own row, and so does a toggle that is on, which has no
     * editor.
     */
    readonly edit: (fieldId: string) => void;
    /** Closes the add menu and the value popover. */
    readonly close: () => void;
  };
  readonly meta: {
    /** The fields map. */
    readonly fields: FilterFieldMap;
    /** Counts and ranges per field. */
    readonly facets: FacetReader;
    /** The zone dates compare in, or undefined for the runtime zone. */
    readonly timeZone: string | undefined;
    /** An operator's label on one field: the Root's `formatOperator`, else the dictionary's. */
    readonly formatOperator: (operator: FilterOperator, kind: FilterKind, fieldId: string) => string;
  };
};

/** The library parts' own view: the public value plus the overlay, focus and element wiring. */
export type DataTableFilterInternals = {
  readonly state: DataTableFilterContextValue["state"] & {
    /** The editor whose first control takes focus as it mounts in an overlay that is open. */
    readonly focusRequest: string | null;
    /** How the drill started: from the field list, or from `actions.edit` with no list shown. */
    readonly drillOrigin: "list" | "edit";
    /** The field row Back returns to. The field list focuses its search as it mounts. */
    readonly returnTo: string | null;
    /** How many times an overlay has opened. The editors remount, with a fresh session, on each. */
    readonly openCount: number;
  };
  readonly actions: DataTableFilterContextValue["actions"] & {
    /** A chip Value's press opens that field's editor. */
    readonly beginEdit: (fieldId: string) => void;
    /** A text, number or date row's press: its editor replaces the field list in the add menu. */
    readonly drill: (fieldId: string) => void;
    /** The in-place editor's Back, Escape or Backspace: the field list again. */
    readonly back: () => void;
    /** The field list calls it once it has focused its search after a Back. */
    readonly clearReturnTo: () => void;
    /**
     * A field's value submenu opened or closed, for `onActiveFieldChange`. A close clears the field
     * only while it is still this submenu's: Base UI closes the previous sibling after the next one
     * opened.
     */
    readonly setSubmenuOpen: (fieldId: string, open: boolean) => void;
    /**
     * A value list's Select all: an option or multi-option field's values in one write, the
     * operator following their count. Other kinds write nothing.
     */
    readonly setOptions: (fieldId: string, values: readonly string[]) => void;
    /**
     * A value list's Clear all: removes the field's filter while its list stays open, so unlike
     * `remove` it ends no editor, closes no overlay and moves no focus.
     */
    readonly clearValues: (fieldId: string) => void;
    /** The add menu finished closing: the drill resets, and an editor waiting on the close opens. */
    readonly settleMenu: () => void;
    /** An exit: every open editor settles its draft. */
    readonly applyDrafts: () => void;
    /**
     * A press on Clear, or on `fieldId`'s Remove, began: it ends those editing sessions unwritten and
     * closes the overlay that holds them.
     */
    readonly discardEditors: (fieldId: string | null) => void;
    /**
     * An overlay opened, so its editors start a fresh session. The add menu reopening during its
     * exit drops an editor queued for after that exit, and the drill it still shows, if any, is
     * active again, also after `close()` cleared it.
     */
    readonly noteOpen: (overlay: OverlayKind) => void;
    /** A chip's focusable segment, so focus can return to it after a neighbour goes. Returns the cleanup. */
    readonly registerSegment: (fieldId: string, element: HTMLElement) => () => void;
    /** An editor's draft owner, which exits settle and a Clear or a Remove discards. Returns the cleanup. */
    readonly registerDraft: (key: string, owner: DraftOwner) => () => void;
    /** The value popover finished closing, so the editing field and the ghost chip go. */
    readonly settleValue: () => void;
    /** `Content` calls it in a layout effect, and the cleanup unregisters. */
    readonly registerContent: () => () => void;
    /** `ValueContent` calls it in a layout effect, and the cleanup unregisters. */
    readonly registerValueContent: () => () => void;
    /** `Chip` calls it from its ref, so focus moves and the popover's anchor never search by id. */
    readonly registerChip: (fieldId: string, element: HTMLElement | null) => void;
    /** `Trigger` calls it from its ref. */
    readonly registerTrigger: (element: HTMLElement | null) => void;
    /**
     * A popup that counts as part of the add menu or the value popover, its nested popups
     * included, from the popup's ref. Returns the cleanup.
     */
    readonly registerOverlay: (kind: OverlayKind, element: HTMLElement) => () => void;
  };
  readonly meta: DataTableFilterContextValue["meta"] & {
    readonly menuHandle: MenuPrimitive.Handle<unknown>;
    readonly valueHandle: PopoverPrimitive.Handle<ValuePayload>;
    readonly locale: SupportedLocale;
    readonly format: (key: DataTableFilterStringKey, vars?: Record<string, string | number>) => string;
    /** The id the Trigger registers with the menu's handle. */
    readonly triggerId: string;
    /** The id each chip's Value registers with the value popover's handle. */
    readonly valueId: (fieldId: string) => string;
    /** A chip's element, or null. */
    readonly chipElement: (fieldId: string) => HTMLElement | null;
    /** Whether a `Content` is registered, which the Trigger checks in development. */
    readonly hasContent: () => boolean;
    /** Whether a `ValueContent` is registered, which a Value checks in development. */
    readonly hasValueContent: () => boolean;
    /** Focuses the neighbour of the chip at `index`, which goes away, and returns what took focus. */
    readonly neighbourOf: (chips: readonly ChipFilter[], index: number) => HTMLElement | null;
    /** Focuses a chip's first or last segment, else the Trigger, and returns what took focus. */
    readonly focusChipEdge: (fieldId: string, edge: "first" | "last") => HTMLElement | null;
    /** Whether focus left this Root's closing overlay of `kind` for somewhere else. */
    readonly focusLeft: (kind: OverlayKind, popup: HTMLElement | null) => boolean;
  };
};

/** An open editor's hold on its draft. */
export type DraftOwner = {
  /** Commits the draft in at most one write and consumes it. */
  readonly settle: () => void;
  /**
   * Ends the editing session without writing, for good: its controls' late blurs and commits write
   * nothing. A Clear or a Remove of the edited filter ends it.
   */
  readonly discard: () => void;
};

/** The public context the Root provides. */
export const DataTableFilterContext = createContext<DataTableFilterContextValue | null>(null);
/** The library parts' context the Root provides. */
export const DataTableFilterInternalContext = createContext<DataTableFilterInternals | null>(null);

/** The chip a part renders in, provided by `Chips` per chip. */
export const ChipContext = createContext<ChipFilter | null>(null);

/** Tells `Clear` it renders in the Bar, so it joins the toolbar's focus order. */
export const BarContext = createContext(false);

/**
 * Throws the composition error for a part that opens an overlay nothing rendered. A press would
 * otherwise do nothing at all, the hardest composition mistake to find, so it throws in
 * development.
 *
 * @param part - The part that was pressed.
 * @param present - Whether the overlay registered.
 * @param rule - `no-content` or `no-value-content`.
 */
export function assertOverlay(part: string, present: boolean, rule: DataTableFilterCompositionRule): void {
  if (isThemeDevelopment() && !present) {
    throw new DataTableFilterCompositionError(part, rule);
  }
}

/**
 * The filter's state, actions and field metadata, for a custom part under `DataTableFilter.Root`.
 *
 * @returns The public context.
 * @throws DataTableFilterCompositionError outside a Root.
 */
export function useDataTableFilter(): DataTableFilterContextValue {
  const context = use(DataTableFilterContext);
  if (context === null) {
    throw new DataTableFilterCompositionError("useDataTableFilter", "outside-root");
  }
  return context;
}

/**
 * The library parts' context: the public value plus the wiring.
 *
 * @param part - The part's name, for the error.
 * @returns The internals.
 */
export function useFilterInternals(part: string): DataTableFilterInternals {
  const context = use(DataTableFilterInternalContext);
  if (context === null) {
    throw new DataTableFilterCompositionError(part, "outside-root");
  }
  return context;
}

/**
 * A ref that registers a popup with the Root as part of the add menu or the value popover, so
 * focus inside it counts as staying when that overlay closes.
 *
 * @param registerOverlay - The Root's `actions.registerOverlay`.
 * @param kind - The overlay the popup belongs to.
 * @returns The popup's ref, which unregisters on detach.
 */
export function useOverlayRef(
  registerOverlay: DataTableFilterInternals["actions"]["registerOverlay"],
  kind: OverlayKind
): (element: HTMLElement | null) => (() => void) | undefined {
  return useCallback(
    (element: HTMLElement | null) => (element === null ? undefined : registerOverlay(kind, element)),
    [registerOverlay, kind]
  );
}

/**
 * The chip a part renders in.
 *
 * @param part - The part's name, for the error.
 * @returns The chip.
 */
export function useChip(part: string): ChipFilter {
  const chip = use(ChipContext);
  if (chip === null) {
    throw new DataTableFilterCompositionError(part, "outside-chip");
  }
  return chip;
}

/**
 * The chip a custom segment renders in: its field, value and ghost state.
 *
 * @returns The chip.
 * @throws DataTableFilterCompositionError outside `DataTableFilter.Chip`.
 */
export function useDataTableFilterChip(): ChipFilter {
  return useChip("useDataTableFilterChip");
}

/**
 * The focus request key of a field's editor.
 *
 * @param fieldId - The field.
 * @returns The key.
 */
export function editKey(fieldId: string): string {
  return `edit:${fieldId}`;
}

/**
 * The focus request key of a field's editor drilled into in the add menu.
 *
 * @param fieldId - The field.
 * @returns The key.
 */
export function drillKey(fieldId: string): string {
  return `drill:${fieldId}`;
}

/**
 * Where an `Editor` renders and for which field. The add menu provides it for its in-place editor
 * and the value popover for a chip's editor, so one composition of the kind editors serves both.
 */
export type EditorTarget =
  | { readonly place: "menu"; readonly fieldId: string | null; readonly back: () => void }
  | { readonly place: "popover"; readonly fieldId: string | null };

/** Provided by `Content` and `ValueContent` for the `Editor` inside them. */
export const EditorTargetContext = createContext<EditorTarget | null>(null);

/**
 * Focuses an editor's first control when that editor mounts in a popover that is already open,
 * after a press on another chip's Value. The popover's own `initialFocus` handles an opening.
 * The request stays until the next edit or close, because Base UI's Viewport mounts the new
 * editor once more as it swaps the previous one out, and the editor it focused first unmounts.
 *
 * The focus waits for the render after mount, which React runs synchronously in the same task, so
 * it still lands before Base UI's focus manager looks for focus lost with the previous editor. A
 * Base UI composite, such as the date presets' toggle group, numbers its items in that render, and
 * an item focused in the mount commit would report no index: the group would highlight none, and
 * the first arrow key would only land on the first item.
 *
 * @template T - The element type the ref attaches to.
 * @param key - The editor's focus request key.
 * @returns A ref for the control or a wrapper around it.
 */
export function useFocusRequest<T extends HTMLElement>(key: string) {
  const { state } = useFilterInternals("useFocusRequest");
  const ref = useRef<T>(null);
  const [mounted, setMounted] = useState(false);
  const { focusRequest } = state;
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- the render after mount is the point: Base UI composites number their items in it, and the focus below waits for it
    setMounted(true);
  }, []);
  useLayoutEffect(() => {
    if (mounted && focusRequest === key && ref.current !== null) {
      resolveFocusTarget(ref.current)?.focus({ preventScroll: true });
    }
  }, [mounted, focusRequest, key]);
  return ref;
}

/**
 * The value list a footer part sits in. The add menu's value submenu and the chip's option editor
 * each provide it around the consumer's footer, with their own order and query, so the parts read
 * the list and write through the Root.
 */
export type ValueList = {
  /** The listed field's column id. */
  readonly fieldId: string;
  /** The listed field. */
  readonly field: ListField;
  /** The list's order, taken as it opened. */
  readonly order: OptionOrder;
  /** The list's search. */
  readonly query: string;
  /** The locale's matcher, the one the list filters its rows with. */
  readonly contains: (text: string, query: string) => boolean;
};

/** Provided by each value list for the footer the consumer renders after it. */
export const ValueListContext = createContext<ValueList | null>(null);

/**
 * The value list a footer part sits in.
 *
 * @param part - The part's name, for the error.
 * @returns The list.
 */
export function useValueList(part: string): ValueList {
  const list = use(ValueListContext);
  if (list === null) {
    throw new DataTableFilterCompositionError(part, "outside-value-list");
  }
  return list;
}

/** The overlays whose focus return asks `focusMovedElsewhere`: the add menu and the value popover. */
export type OverlayKind = "menu" | "value";
