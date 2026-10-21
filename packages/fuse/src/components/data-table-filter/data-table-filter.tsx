"use client";

// DataTableFilter.Root renders no element. It owns the shared state the way Command.Root does:
// the table's `columnFilters`, read through the table and never copied, the overlays' handles, the
// chip whose editor is open in the value popover, the field drilled into in the add menu, the
// ghost chip, and where focus goes after an action. Every part
// reads it through context and writes through `actions`, so only this module knows the state
// lives in TanStack.

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement, ReactNode } from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useLocale } from "../../intl/locale-context";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { DataTableFilterCompositionError } from "./data-table-filter-error";
import type { DataTableFilterCompositionRule } from "./data-table-filter-error";
import type { FilterTableSource } from "./data-table-filter-source";
import { createFacetReader } from "./filter-facets";
import type { FacetReader } from "./filter-facets";
import type { AnyFilterFacets, FilterFacets, FilterField, FilterFieldMap } from "./filter-fields";
import { firstOperator } from "./filter-fields";
import { focusEdge, focusMovedElsewhere, resolveFocusTarget } from "./filter-focus";
import type {
  DataTableFilterEntry,
  DataTableFilterState,
  FilterKind,
  FilterOperator,
  FilterValue,
} from "./filter-model";
import { findFilter, removeFilter, setFilterOperator, setFilterValues, toggleOption } from "./filter-model";
import { viewColumnFilters } from "./filter-parse";
import { dataTableFilterStrings } from "./intl";
import type { DataTableFilterStringKey } from "./intl";

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
    /** Ticks or unticks an option value. The operator follows the value count. */
    readonly toggle: (fieldId: string, optionValue: string) => void;
    /** Sets a filter's operator and values. An empty list removes the filter. */
    readonly setValues: (
      fieldId: string,
      operator: FilterOperator,
      values: readonly (string | number)[]
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
     * add menu, which opens if it is closed. An option field with no chip does nothing, since its
     * values open from the menu's own row.
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
    /** An operator's label: the Root's `formatOperator`, else the dictionary's. */
    readonly formatOperator: (operator: FilterOperator, kind: FilterKind) => string;
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
    /** A `Content` registered, which the Trigger checks in development. */
    readonly hasContent: boolean;
    /** A `ValueContent` registered, which a Value checks in development. */
    readonly hasValueContent: boolean;
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
    readonly locale: string;
    readonly format: (key: DataTableFilterStringKey, vars?: Record<string, string | number>) => string;
    /** The id the Trigger registers with the menu's handle. */
    readonly triggerId: string;
    /** The id each chip's Value registers with the value popover's handle. */
    readonly valueId: (fieldId: string) => string;
    /** A chip's element, or null. */
    readonly chipElement: (fieldId: string) => HTMLElement | null;
    /** A chip's Value segment, the value popover's trigger for that chip. */
    readonly valueElement: (fieldId: string) => HTMLElement | null;
    /** The Trigger's element, or null. */
    readonly triggerElement: () => HTMLElement | null;
    /** Focuses the neighbour of the chip at `index`, which goes away, and returns what took focus. */
    readonly neighbourOf: (chips: readonly ChipFilter[], index: number) => HTMLElement | null;
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

const DataTableFilterContext = createContext<DataTableFilterContextValue | null>(null);
const DataTableFilterInternalContext = createContext<DataTableFilterInternals | null>(null);

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

/** The overlays whose focus return asks `focusMovedElsewhere`: the add menu and the value popover. */
export type OverlayKind = "menu" | "value";

/**
 * The field the person works with and the overlay that holds it, or will: the add menu for a drill
 * or a value submenu, the value popover for a chip's editor. An editor asked for while the add menu
 * is open is `queued`: it opens once the menu has closed and returned focus, since opened earlier,
 * focus-out would close it again. Every request replaces the record, so a newer one wins and
 * `close()` cancels a queued one. An overlay that finishes its exit clears the record only while it
 * still holds it, so a field opened during that exit stays active.
 */
type Intent = { readonly field: string; readonly owner: "menu" | "value"; readonly queued: boolean } | null;

/**
 * The intent once the add menu opens, whatever came before: the menu shows a field, so that field
 * is active. A menu record that is not queued is a drill asked for with this open, so it stays.
 * Otherwise a drill the menu still shows from before, such as one its interrupted exit kept,
 * becomes active, and with no drill the field list shows and no field is active. A queued editor,
 * a cleared record and another chip's open editor all give way.
 *
 * @param current - The intent before the menu opened.
 * @param drilled - The drill the menu shows, if any.
 * @returns The intent.
 */
function intentOnMenuOpen(current: Intent, drilled: string | null): Intent {
  if (current?.owner === "menu" && !current.queued) {
    return current;
  }
  return drilled === null ? null : { field: drilled, owner: "menu", queued: false };
}

/**
 * The focus request once the add menu opens. A drill's request that is already there stays, a
 * fresh drill's included. A drill the menu still shows from before asks for focus again, since a
 * chip's editor opened during the menu's exit replaced its request. With no drill, the field list
 * shows, and Base UI focuses its search. A drill's other state needs no restoring: `drillOrigin`
 * changes only with `drilled`, and `returnTo` is null whenever `drilled` is set.
 *
 * @param current - The focus request before the menu opened.
 * @param drilled - The drill the menu shows, if any.
 * @returns The focus request.
 */
function focusOnMenuOpen(current: string | null, drilled: string | null): string | null {
  if (current?.startsWith("drill:") === true || drilled === null) {
    return current;
  }
  return drillKey(drilled);
}

/**
 * The props of `DataTableFilter.Root`.
 *
 * @template TFields - The fields map, from `defineFilterFields`.
 */
export type DataTableFilterRootProps<TFields extends FilterFieldMap = FilterFieldMap> = {
  /** The table, from `useTable` or a Fuse table hook with `columnFilteringFeature`. */
  table: FilterTableSource;
  /** The filterable fields keyed by column id, from `defineFilterFields`. */
  fields: TFields;
  /**
   * Server counts and ranges. They win over TanStack faceting, and with `manualFiltering` they
   * are the only source, since TanStack would count the current page only.
   */
  facets?: FilterFacets<TFields> | undefined;
  /** The zone for date presets and the date editor's today. Defaults to the runtime zone. */
  timeZone?: string | undefined;
  /** An operator's label. Return undefined to keep the dictionary's. */
  formatOperator?: ((operator: FilterOperator, kind: FilterKind) => string | undefined) | undefined;
  /** Called with the field whose editor opens, and null when it closes. A server fetches facets from it. */
  onActiveFieldChange?: ((fieldId: string | null) => void) | undefined;
  /** The Bar, the overlays and anything else that reads the filter. */
  children?: ReactNode;
};

type Ghost = { readonly id: string; readonly value: FilterValue; readonly index: number };

type FocusTarget = { readonly chip: string; readonly edge: "first" | "last" } | { readonly trigger: true };

/**
 * Where focus goes when a chip goes: the next chip's first segment, else the previous chip's last,
 * else the Trigger.
 */
function neighbourTarget(list: readonly { readonly id: string }[], index: number): FocusTarget {
  const next = list[index + 1];
  if (next !== undefined) {
    return { chip: next.id, edge: "first" };
  }
  const previous = list[index - 1];
  return previous === undefined ? { trigger: true } : { chip: previous.id, edge: "last" };
}

function moveTo(entries: DataTableFilterEntry[], id: string, index: number): DataTableFilterEntry[] {
  const entry = entries.find((item) => item.id === id);
  if (entry === undefined) {
    return entries;
  }
  const rest = entries.filter((item) => item.id !== id);
  rest.splice(Math.min(index, rest.length), 0, entry);
  return rest;
}

/**
 * The filter's state, which renders no element. It reads and writes the table's `columnFilters`
 * through `table.setColumnFilters`, so controlled and uncontrolled state come from the table's own
 * options. Render the Bar, `Content` and `ValueContent` inside it as siblings, and anything else
 * that reads the filter, such as a `Clear` in the table's empty state.
 *
 * @template TFields - The fields map, from `defineFilterFields`.
 */
export function DataTableFilterRoot<TFields extends FilterFieldMap>({
  table,
  fields,
  facets,
  timeZone,
  formatOperator,
  onActiveFieldChange,
  children,
}: DataTableFilterRootProps<TFields>): ReactElement {
  const strings = useLocalizedStrings(dataTableFilterStrings);
  const { locale } = useLocale();
  // Apps narrow `useFuseTable`'s selector, so the filter cannot rely on the app re-rendering it.
  // It subscribes to the atom itself.
  const filtersAtom = table.atoms.columnFilters;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = filtersAtom.subscribe(() => {
        onChange();
      });
      return () => {
        subscription.unsubscribe();
      };
    },
    [filtersAtom]
  );
  const getSnapshot = useCallback(() => filtersAtom.get(), [filtersAtom]);
  const columnFilters = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const filters = viewColumnFilters(columnFilters, fields);
  const knownFacets: AnyFilterFacets | undefined = facets;

  const [menuHandle] = useState(() => MenuPrimitive.createHandle());
  const [valueHandle] = useState(() => PopoverPrimitive.createHandle<ValuePayload>());
  // The field each overlay keeps mounted, through its exit animation too.
  const [editing, setEditing] = useState<string | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  // The field the person works with now, apart from what stays mounted for an exit.
  const [intent, setIntent] = useState<Intent>(null);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const [drilled, setDrilled] = useState<string | null>(null);
  const [drillOrigin, setDrillOrigin] = useState<"list" | "edit">("list");
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  // Each chip's Operator, Value and Remove, by field id, so focus can move to a neighbour chip's
  // segment whatever element it renders.
  const segments = useRef(new Map<string, Set<HTMLElement>>());
  const registerSegment = useCallback((fieldId: string, element: HTMLElement) => {
    const set = segments.current.get(fieldId) ?? new Set<HTMLElement>();
    set.add(element);
    segments.current.set(fieldId, set);
    return () => {
      set.delete(element);
    };
  }, []);
  // Each open editor's draft, by editor key. Every exit path settles them, each in at most one
  // write, and a Clear or a Remove of the edited filter discards them, so a closing editor never
  // writes a filter back.
  const drafts = useRef(new Map<string, DraftOwner>());
  const registerDraft = useCallback((key: string, owner: DraftOwner) => {
    drafts.current.set(key, owner);
    return () => {
      if (drafts.current.get(key) === owner) {
        drafts.current.delete(key);
      }
    };
  }, []);
  const applyDrafts = () => {
    for (const owner of [...drafts.current.values()]) {
      owner.settle();
    }
  };
  const discardDrafts = (keys: readonly string[] | null) => {
    for (const [key, owner] of drafts.current) {
      if (keys === null || keys.includes(key)) {
        owner.discard();
      }
    }
  };
  const keysOf = (fieldId: string | null) =>
    fieldId === null ? null : [editKey(fieldId), drillKey(fieldId)];
  /**
   * A press on Clear, or on a chip's Remove, ends the editing sessions it is about to remove, in
   * the button's own capture handlers. That runs before the press blurs the editor, before Base UI
   * dismisses the overlay, and before any settle, so the button's click makes the one write. A
   * press that slides off before its click therefore drops the unapplied draft, and the applied
   * filter stays as it was.
   */
  const discardEditors = (fieldId: string | null) => {
    discardDrafts(keysOf(fieldId));
    setIntent((current) =>
      current !== null && (fieldId === null || current.field === fieldId) ? null : current
    );
    // The overlay holding an ended editor closes now, so neither a control's buffered input nor
    // any later input in it outlives the session.
    if (fieldId === null || drilled === fieldId) {
      menuHandle.close();
    }
    if (fieldId === null || editing === fieldId) {
      valueHandle.close();
    }
  };
  // Every open starts a fresh editing session: the editors mount anew, while a closing editor's
  // late callbacks stay with the session that ended.
  const [openCount, setOpenCount] = useState(0);
  const rootId = useId();
  // The Command.Root pattern: overlays register on mount, so a press with nothing to open can
  // name the missing part.
  const [hasContent, setHasContent] = useState(false);
  const [hasValueContent, setHasValueContent] = useState(false);
  const registerContent = useCallback(() => {
    setHasContent(true);
    return () => {
      setHasContent(false);
    };
  }, []);
  const registerValueContent = useCallback(() => {
    setHasValueContent(true);
    return () => {
      setHasValueContent(false);
    };
  }, []);
  // Elements by field id, from each Chip's ref: a consumer `id` cannot break a focus move.
  const chipElements = useRef(new Map<string, HTMLElement>());
  const triggerRef = useRef<HTMLElement | null>(null);
  const registerChip = useCallback((fieldId: string, element: HTMLElement | null) => {
    if (element === null) {
      chipElements.current.delete(fieldId);
    } else {
      chipElements.current.set(fieldId, element);
    }
  }, []);
  const registerTrigger = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
  }, []);
  // Each overlay's popups, from their refs, so focus return counts only this Root's own.
  const overlays = useRef({ menu: new Set<HTMLElement>(), value: new Set<HTMLElement>() });
  const registerOverlay = useCallback((kind: OverlayKind, element: HTMLElement) => {
    const set = overlays.current[kind];
    set.add(element);
    return () => {
      set.delete(element);
    };
  }, []);
  const chipElement = useCallback((fieldId: string) => chipElements.current.get(fieldId) ?? null, []);
  const valueElement = useCallback(
    (fieldId: string) =>
      chipElement(fieldId)?.querySelector<HTMLElement>("[data-slot=data-table-filter-value]") ?? null,
    [chipElement]
  );
  const triggerElement = useCallback(() => triggerRef.current, []);
  const valueId = useCallback((fieldId: string) => `${rootId}value-${fieldId}`, [rootId]);
  const triggerId = `${rootId}trigger`;

  const chips: ChipFilter[] = filters.flatMap((entry) => {
    const field = fields[entry.id];
    return field === undefined ? [] : [{ id: entry.id, value: entry.value, field, ghost: false }];
  });
  // A ghost shows while its editor is open.
  if (editing !== null && ghost?.id === editing && !chips.some((chip) => chip.id === editing)) {
    const field = fields[ghost.id];
    if (field !== undefined) {
      chips.splice(Math.min(ghost.index, chips.length), 0, {
        id: ghost.id,
        value: ghost.value,
        field,
        ghost: true,
      });
    }
  }

  /**
   * One user decision, one `setColumnFilters` call. The updater reads TanStack's latest state, so
   * two quick toggles never lose one. Entries for columns that are not fields stay as they are.
   */
  const commit = (reducer: (state: DataTableFilterState) => DataTableFilterEntry[]) => {
    // An edit that empties the chip being edited keeps it as a ghost until the popover closes, and
    // a value applied to the ghost puts the filter back in its old place.
    const preview = reducer(filters);
    if (editing !== null) {
      const index = filters.findIndex((entry) => entry.id === editing);
      const kept = preview.some((entry) => entry.id === editing);
      const before = filters[index];
      if (before !== undefined && !kept) {
        setGhost({ id: editing, value: before.value, index });
      } else if (index === -1 && kept && ghost?.id === editing) {
        setGhost(null);
      }
    }
    const refill = editing !== null && ghost?.id === editing ? ghost : null;
    table.setColumnFilters((previous) => {
      const foreign = previous.filter((entry) => !Object.hasOwn(fields, entry.id));
      let next = reducer(viewColumnFilters(previous, fields));
      if (refill !== null && !previous.some((entry) => entry.id === refill.id)) {
        next = moveTo(next, refill.id, refill.index);
      }
      return [...foreign, ...next];
    });
  };

  const facetReader = createFacetReader(table, fields, knownFacets);

  // Focuses the target's segment that takes focus, else the Trigger. Returns the element that took
  // focus.
  const focusTarget = (target: FocusTarget): HTMLElement | null =>
    "trigger" in target
      ? focusEdge(undefined, "first", triggerElement())
      : focusEdge(segments.current.get(target.chip), target.edge, triggerElement());

  // Focuses the neighbour of a chip that goes, now rather than after a commit.
  const neighbourOf = (list: readonly ChipFilter[], index: number): HTMLElement | null =>
    focusTarget(neighbourTarget(list, index));

  // Focus after a remove or a clear. The chips it names exist once this commit lands.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target === null) {
      return;
    }
    pendingFocus.current = null;
    focusTarget(target);
  });

  /**
   * The one way into a chip's editor, for a press on its Value and for `edit()` alike. The editor it
   * leaves settles its draft, the field becomes the intent, a ghost of another field goes, and the
   * new editor takes focus: through the popover's `initialFocus` on an opening, and through a focus
   * request when the open popover moves to another chip, since Base UI does not run initial focus
   * again for a new trigger. A press opens or moves the popover through Base UI. From code, the
   * chip scrolls into view first, because the popover anchors to it and a narrow bar's strip may
   * hide it, and then the handle opens on it. `handle.open(id)` throws for a trigger id nothing
   * registered (`popupHandle.ts`), so code enters only a chip whose Value is mounted.
   */
  const enterEditor = (fieldId: string, via: "press" | "code") => {
    if (via === "code" && valueElement(fieldId) === null) {
      return;
    }
    applyDrafts();
    setEditing(fieldId);
    setIntent({ field: fieldId, owner: "value", queued: false });
    setGhost((current) => (current?.id === fieldId ? current : null));
    setFocusRequest(valueHandle.isOpen ? editKey(fieldId) : null);
    if (via === "code") {
      chipElement(fieldId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
      valueHandle.open(valueId(fieldId));
    }
  };

  const activeField = intent?.field ?? null;
  // The latest callback, so an inline one that sets the host's state never loops. It hears each
  // change of the active field once, and nothing on mount.
  const activeFieldListener = useRef(onActiveFieldChange);
  useLayoutEffect(() => {
    activeFieldListener.current = onActiveFieldChange;
  });
  const reportedField = useRef(activeField);
  useEffect(() => {
    if (reportedField.current !== activeField) {
      reportedField.current = activeField;
      activeFieldListener.current?.(activeField);
    }
  }, [activeField]);

  /**
   * The add menu's field list gives way to a field's editor, which takes focus as it mounts. An
   * open value submenu unmounts with the field list without reporting a close.
   */
  const drill = (fieldId: string, origin: "list" | "edit") => {
    setDrilled(fieldId);
    setDrillOrigin(origin);
    setReturnTo(null);
    setIntent({ field: fieldId, owner: "menu", queued: false });
    setFocusRequest(drillKey(fieldId));
  };

  const value: DataTableFilterContextValue = {
    state: { filters, chips, editing, drilled },
    actions: {
      toggle: (fieldId, optionValue) => {
        const field = fields[fieldId];
        if (field?.kind !== "option" && field?.kind !== "multiOption") {
          return;
        }
        commit((state) => toggleOption(state, fieldId, field, optionValue, firstOperator(field)));
      },
      setValues: (fieldId, operator, values) => {
        const field = fields[fieldId];
        if (field === undefined) {
          return;
        }
        commit((state) => setFilterValues(state, fieldId, field, operator, values));
      },
      setOperator: (fieldId, operator) => {
        const field = fields[fieldId];
        if (field === undefined) {
          return;
        }
        const upper = field.kind === "number" ? facetReader.range(fieldId)?.[1] : undefined;
        // A pick that removes the filter, since none of its values is still an option, is a
        // removal, and focus goes where a removal sends it.
        if (
          findFilter(filters, fieldId) !== undefined &&
          findFilter(setFilterOperator(filters, fieldId, field, operator, upper), fieldId) === undefined
        ) {
          value.actions.remove(fieldId);
          return;
        }
        commit((state) => setFilterOperator(state, fieldId, field, operator, upper));
      },
      remove: (fieldId) => {
        discardEditors(fieldId);
        if (findFilter(filters, fieldId) === undefined) {
          // Nothing to write. A ghost's editor closed with the discard above, and its finalFocus
          // settles focus. Another field's open editor stays.
          return;
        }
        pendingFocus.current = neighbourTarget(
          chips,
          chips.findIndex((chip) => chip.id === fieldId)
        );
        commit((state) => removeFilter(state, fieldId));
      },
      clear: () => {
        pendingFocus.current = { trigger: true };
        discardDrafts(null);
        setIntent(null);
        menuHandle.close();
        valueHandle.close();
        commit(() => []);
      },
      edit: (fieldId) => {
        const field = fields[fieldId];
        if (field === undefined) {
          return;
        }
        // A move to another field is an exit for the editor it leaves.
        applyDrafts();
        if (chips.some((chip) => chip.id === fieldId)) {
          // With the menu open or still settling a queued edit, this one replaces any queued edit.
          if (menuHandle.isOpen || intent?.queued === true) {
            setIntent({ field: fieldId, owner: "value", queued: true });
            menuHandle.close();
            return;
          }
          enterEditor(fieldId, "code");
          return;
        }
        if (field.kind === "option" || field.kind === "multiOption") {
          return;
        }
        drill(fieldId, "edit");
        if (!menuHandle.isOpen) {
          menuHandle.open(triggerId);
        }
      },
      close: () => {
        applyDrafts();
        setIntent(null);
        menuHandle.close();
        valueHandle.close();
      },
    },
    meta: {
      fields,
      facets: facetReader,
      timeZone,
      formatOperator: (operator, kind) =>
        formatOperator?.(operator, kind) ??
        // SAFETY: every kind and operator pair of OPERATORS has a dictionary row, which the
        // dictionary's unit test checks.
        strings.format(`${kind}.${operator}` as DataTableFilterStringKey),
    },
  };

  const internals: DataTableFilterInternals = {
    state: { ...value.state, focusRequest, drillOrigin, returnTo, hasContent, hasValueContent, openCount },
    actions: {
      ...value.actions,
      beginEdit: (fieldId) => {
        enterEditor(fieldId, "press");
      },
      drill: (fieldId) => {
        drill(fieldId, "list");
      },
      back: () => {
        applyDrafts();
        setReturnTo(drilled);
        setDrilled(null);
        setIntent((current) => (current?.owner === "menu" ? null : current));
        setFocusRequest(null);
      },
      clearReturnTo: () => {
        setReturnTo(null);
      },
      setSubmenuOpen: (fieldId, open) => {
        if (open) {
          setIntent({ field: fieldId, owner: "menu", queued: false });
          return;
        }
        setIntent((current) => (current?.owner === "menu" && current.field === fieldId ? null : current));
      },
      settleMenu: () => {
        setDrilled(null);
        setReturnTo(null);
        setFocusRequest((current) => (current?.startsWith("drill:") === true ? null : current));
        // The menu's own field goes. A queued editor opens now that the menu returned focus, and
        // writes its own record.
        setIntent((current) => (current?.owner === "menu" || current?.queued === true ? null : current));
        if (intent?.queued === true) {
          enterEditor(intent.field, "code");
        }
      },
      settleValue: () => {
        // The popover's field goes only while it is still the active one.
        setIntent((current) =>
          current?.owner === "value" && !current.queued && current.field === editing ? null : current
        );
        setEditing(null);
        setGhost(null);
        setFocusRequest(null);
      },
      applyDrafts,
      discardEditors,
      noteOpen: (overlay) => {
        setOpenCount((count) => count + 1);
        if (overlay === "menu") {
          // A drill the menu shows again comes back whole: active, and its editor takes focus.
          setIntent((current) => intentOnMenuOpen(current, drilled));
          setFocusRequest((current) => focusOnMenuOpen(current, drilled));
        }
      },
      registerDraft,
      registerSegment,
      registerContent,
      registerValueContent,
      registerChip,
      registerTrigger,
      registerOverlay,
    },
    meta: {
      ...value.meta,
      menuHandle,
      valueHandle,
      locale,
      format: (key, vars) => strings.format(key, vars),
      triggerId,
      valueId,
      chipElement,
      valueElement,
      triggerElement,
      neighbourOf,
      focusLeft: (kind, popup) =>
        focusMovedElsewhere(popup, [
          ...overlays.current[kind],
          ...chips.flatMap((chip) => {
            const element = chip.ghost ? chipElement(chip.id) : null;
            return element === null ? [] : [element];
          }),
        ]),
    },
  };

  return (
    <DataTableFilterContext value={value}>
      <DataTableFilterInternalContext value={internals}>{children}</DataTableFilterInternalContext>
    </DataTableFilterContext>
  );
}

DataTableFilterRoot.displayName = "DataTableFilter.Root";
