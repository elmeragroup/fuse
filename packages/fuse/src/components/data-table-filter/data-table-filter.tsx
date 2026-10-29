"use client";

// DataTableFilter.Root renders no element. It owns the shared state the way Command.Root does:
// the table's `columnFilters`, read through the table and never copied, the overlays' handles, the
// chip whose editor is open in the value popover, the field drilled into in the add menu, the
// ghost chip, and where focus goes after an action. Every part reads it through the contexts in
// `data-table-filter-context.ts` and writes through `actions`, so only this module knows the state
// lives in TanStack.

import {
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
import {
  DataTableFilterContext,
  DataTableFilterInternalContext,
  drillKey,
  editKey,
} from "./data-table-filter-context";
import type {
  ChipFilter,
  DataTableFilterContextValue,
  DataTableFilterInternals,
  DraftOwner,
  OverlayKind,
  ValuePayload,
} from "./data-table-filter-context";
import type { FilterTableSource } from "./data-table-filter-source";
import { createFacetReader } from "./filter-facets";
import type { AnyFilterFacets, FilterFacets, FilterFieldMap } from "./filter-fields";
import { firstOperator } from "./filter-fields";
import { focusEdge, focusMovedElsewhere } from "./filter-focus";
import type {
  DataTableFilterEntry,
  DataTableFilterState,
  FilterKind,
  FilterOperator,
  FilterValue,
} from "./filter-model";
import {
  findFilter,
  isToggleOn,
  removeFilter,
  setFilterOperator,
  setFilterValues,
  setOptionValues,
  toggleBoolean,
  toggleOption,
} from "./filter-model";
import { viewColumnFilters } from "./filter-parse";
import { dataTableFilterStrings } from "./intl";
import type { DataTableFilterStringKey } from "./intl";
import { isListField } from "./option-list";

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
  /**
   * An operator's label for one field. Return undefined to keep the dictionary's. The field id
   * lets one field relabel an operator without changing every field of its kind.
   */
  formatOperator?:
    | ((operator: FilterOperator, kind: FilterKind, fieldId: string) => string | undefined)
    | undefined;
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
  // name the missing part. Only press handlers read them, so they are refs, not state.
  const contentRegistered = useRef(false);
  const valueContentRegistered = useRef(false);
  const registerContent = useCallback(() => {
    contentRegistered.current = true;
    return () => {
      contentRegistered.current = false;
    };
  }, []);
  const registerValueContent = useCallback(() => {
    valueContentRegistered.current = true;
    return () => {
      valueContentRegistered.current = false;
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
   * chip scrolls into view first, because the popover anchors to it and the bar's strip may hide
   * it, and then the handle opens on it. `handle.open(id)` throws for a trigger id nothing
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
        if (field?.kind === "boolean") {
          if (optionValue === "true" || optionValue === "false") {
            const picked = optionValue === "true";
            commit((state) => toggleBoolean(state, fieldId, field, picked, firstOperator(field)));
          }
          return;
        }
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
        const after = findFilter(setFilterOperator(filters, fieldId, field, operator, upper), fieldId);
        // A pick that removes the filter, since none of its values is still an option, is a
        // removal, and focus goes where a removal sends it.
        if (findFilter(filters, fieldId) !== undefined && after === undefined) {
          value.actions.remove(fieldId);
          return;
        }
        // A pick that turns a stale toggle on unmounts the chip's Operator, so focus goes to Remove.
        if (isToggleOn(field, after)) {
          pendingFocus.current = { chip: fieldId, edge: "last" };
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
        // A toggle that is on has no editor.
        if (field === undefined || isToggleOn(field, findFilter(filters, fieldId))) {
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
        if (isListField(field)) {
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
      formatOperator: (operator, kind, fieldId) =>
        formatOperator?.(operator, kind, fieldId) ??
        // SAFETY: every kind and operator pair of OPERATORS has a dictionary row, which the
        // dictionary's unit test checks.
        strings.format(`${kind}.${operator}` as DataTableFilterStringKey),
    },
  };

  const internals: DataTableFilterInternals = {
    state: { ...value.state, focusRequest, drillOrigin, returnTo, openCount },
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
      setOptions: (fieldId, values) => {
        const field = fields[fieldId];
        if (field?.kind !== "option" && field?.kind !== "multiOption") {
          return;
        }
        commit((state) => setOptionValues(state, fieldId, field, values, firstOperator(field)));
      },
      clearValues: (fieldId) => {
        // An edit that empties the chip being edited keeps it as a ghost, so the popover's anchor
        // and its open list stay.
        commit((state) => removeFilter(state, fieldId));
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
      hasContent: () => contentRegistered.current,
      hasValueContent: () => valueContentRegistered.current,
      neighbourOf,
      focusChipEdge: (chip, edge) => focusTarget({ chip, edge }),
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
