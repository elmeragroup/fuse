"use client";

// The add menu: a Base UI 1.9 filterable Menu, opened by the Trigger through a detached handle.
// Option and multi-option fields are filterable submenus of checkbox items, ticked live. Text,
// number and date fields drill in place: the field list gives way to that field's editor in the
// same popup, which is a `dialog` under Menu.FilterProvider (`MenuFilterPopup.tsx`), so form
// controls may live in it outside the `menu` list. Content is the Bar's sibling, not its child,
// because popup key events bubble through the React tree and the toolbar's roving handler must
// never see them.

import { createContext, use, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode, TransitionEvent } from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { CaretRight } from "../../icons/generated/caret-right";
import { Check } from "../../icons/generated/check";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { menuPopupShellClass } from "../../styles/inner-corner/menu";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { InputGroupAddon, InputGroupPlainInput, InputGroupRoot } from "../input-group/input-group";
import {
  menuGroupLabelClass,
  menuItemClass,
  menuItemIndicatorClass,
  menuItemIndicatorRoomClass,
  menuSeparatorClass,
} from "../overlay/menu-row-classes";
import { overlayPositionerClass, overlayTimedPopupClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import { EditorTargetContext, useFilterInternals, useOverlayRef } from "./data-table-filter";
import type { EditorTarget } from "./data-table-filter";
import { OptionCount } from "./data-table-filter-editors";
import { DefaultEditor } from "./data-table-filter-value-content";
import { dataTableFilterSlots as slots } from "./data-table-filter-variants";
import type { FilterField, FilterFieldOfKind, FilterOption } from "./filter-fields";
import { findFilter } from "./filter-model";
import { matchOptions, OPTION_LIMIT, snapshotOrder } from "./option-list";
import { closeSubmenuOnBackspace, keepKeysFromToolbar, SearchableMenu } from "./searchable-menu";
import { useContains } from "./use-contains";

type OptionField = FilterFieldOfKind<"option" | "multiOption">;

/** The menu's query, which `Content` owns beside its filter provider and `FieldList` reads. */
const MenuQueryContext = createContext("");

/** Quick search lists option values across fields from this many characters on. */
const QUICK_SEARCH_MIN = 2;

/** The popup's two morphed dimensions. */
const MORPHED = ["width", "height"] as const;

type Size = Record<(typeof MORPHED)[number], number>;

/** Whether the morph has pinned either dimension inline. */
function pinned(popup: HTMLElement): boolean {
  return MORPHED.some((dimension) => popup.style[dimension] !== "");
}

/**
 * Morphs the popup's width and height when its step changes, from the field list to an editor and
 * back, and only then, so a keystroke that grows or shrinks the list snaps. Base UI measures a popup
 * only when its payload changes (`usePopupViewport.tsx`), and the menu has none, so this measures
 * the step change itself. A CSS transition, so a change mid-flight retargets. A dimension the
 * central reduced-motion rule leaves out of the transition list is never pinned.
 *
 * @param step - The current step.
 * @returns A ref for the popup and its `transitionend` handler.
 */
function useStepMorph(step: string) {
  // The popup's settled size. The menu opens and filters without rendering this part again, so a
  // ResizeObserver attached as the popup mounts keeps it current. It reports after layout, so at a
  // step change the effect below still reads the size from before the change.
  const lastSize = useRef<Size | null>(null);
  const lastStep = useRef(step);
  const popupRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((popup: HTMLElement | null) => {
    popupRef.current = popup;
    lastSize.current = null;
    if (popup === null) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      if (!pinned(popup)) {
        lastSize.current = { width: popup.offsetWidth, height: popup.offsetHeight };
      }
    });
    observer.observe(popup);
    return () => {
      observer.disconnect();
    };
  }, []);
  useLayoutEffect(() => {
    const popup = popupRef.current;
    const changed = lastStep.current !== step;
    lastStep.current = step;
    if (popup === null || !changed) {
      return;
    }
    const transitioned = getComputedStyle(popup)
      .transitionProperty.split(",")
      .map((property) => property.trim());
    // The dimensions leave the transition list while the morph measures and pins its start. The
    // field list's width is a length, 18rem, so pinning the start would otherwise run a transition
    // of its own, which the end value then cancels before any `transitionend` releases the pin.
    const ownProperty = popup.style.transitionProperty;
    popup.style.transitionProperty =
      transitioned.filter((property) => !MORPHED.some((dimension) => dimension === property)).join(", ") ||
      "none";
    // A Back right after a drill starts from where the running morph has got to.
    const from = pinned(popup) ? popup.getBoundingClientRect() : lastSize.current;
    for (const dimension of MORPHED) {
      popup.style[dimension] = "";
    }
    const to = { width: popup.offsetWidth, height: popup.offsetHeight } satisfies Size;
    lastSize.current = to;
    // Before the first settled size there is nothing to morph from.
    const start = from ?? to;
    const morphing = MORPHED.filter(
      (dimension) => transitioned.includes(dimension) && Math.abs(start[dimension] - to[dimension]) >= 0.5
    );
    for (const dimension of morphing) {
      popup.style[dimension] = `${String(start[dimension])}px`;
    }
    // Reading the size commits the start values, so the end values transition from them.
    popup.getBoundingClientRect();
    popup.style.transitionProperty = ownProperty;
    for (const dimension of morphing) {
      popup.style[dimension] = `${String(to[dimension])}px`;
    }
  }, [step]);
  // The morph hands each dimension back to the content when it ends, so a later keystroke snaps.
  // Only `transitionend`: a cancelled transition is one a newer morph replaced.
  const onTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    const dimension = MORPHED.find((name) => name === event.propertyName);
    if (event.target === event.currentTarget && dimension !== undefined) {
      event.currentTarget.style[dimension] = "";
    }
  };
  return { ref, onTransitionEnd };
}

/**
 * The props of `DataTableFilter.Content`: Base UI Menu Popup's, except `finalFocus`, since the Root
 * decides where focus goes as the menu closes.
 */
export type DataTableFilterContentProps = Omit<
  ComponentProps<typeof MenuPrimitive.Popup>,
  "children" | "finalFocus"
> & {
  /**
   * The menu's body: `FieldList` and an `Editor` for the in-place drill, each rendering only for
   * its step. Defaults to both, with the default kind editors.
   */
  children?: ReactNode;
};

/**
 * The add menu the Trigger opens, named "Add filter". Its field list filters by the search and
 * caps every value list at 50 rows. An option field opens a submenu of its values, ticked live. A
 * text, number or date field drills in place: its editor replaces the search and the list, values
 * apply live, and Back, Escape or a fresh Backspace in an empty text input return to the list with
 * the search kept and the field highlighted. The table stays scrollable while it is open.
 */
export function DataTableFilterContent({
  className,
  children,
  onKeyDown,
  onTransitionEnd,
  ref,
  ...props
}: DataTableFilterContentProps): ReactElement {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.Content");
  const { registerContent } = actions;
  useLayoutEffect(registerContent, [registerContent]);
  const [query, setQuery] = useState("");
  const morph = useStepMorph(state.drilled ?? "");
  const popupRef = useRef<HTMLDivElement | null>(null);
  const drilledField = state.drilled === null ? undefined : meta.fields[state.drilled];
  const target: EditorTarget = {
    place: "menu",
    fieldId: state.drilled,
    back: () => {
      // A drill from the field list returns to the row Base UI kept highlighted. A drill that
      // `actions.edit` opened had no list to keep a highlight in, so the search takes the field's
      // name, and Base UI's `autoHighlight` lights its row as the first match.
      if (state.drillOrigin === "edit" && drilledField !== undefined) {
        setQuery(drilledField.label);
      }
      actions.back();
    },
  };
  const { ref: morphRef } = morph;
  const attachPopup = useCallback(
    (popup: HTMLDivElement | null) => {
      popupRef.current = popup;
      return morphRef(popup);
    },
    [morphRef]
  );
  const overlayRef = useOverlayRef(actions.registerOverlay, "menu");
  // A consumer's ref joins the popup ref that drives focus return and the height morph.
  const popupRefs = useMergedRefs(ref, useMergedRefs(attachPopup, overlayRef));
  return (
    <SearchableMenu.Provider filter={null} value={query} onValueChange={setQuery} autoHighlight>
      <MenuPrimitive.Root
        handle={meta.menuHandle}
        // Values apply live, so the table stays scrollable while the menu is open.
        modal={false}
        // Escape, an outside press and Tab close the menu, each an exit for the editor. A press on
        // Clear or Remove ended its session first.
        onOpenChange={(open) => {
          if (open) {
            actions.noteOpen("menu");
          } else {
            actions.applyDrafts();
          }
        }}
        onOpenChangeComplete={(open) => {
          if (!open) {
            actions.settleMenu();
          }
        }}>
        <OverlayPortal portal={MenuPrimitive.Portal}>
          <MenuPrimitive.Positioner
            data-slot="data-table-filter-content-positioner"
            side="bottom"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className={overlayPositionerClass}>
            <MenuPrimitive.Popup
              ref={popupRefs}
              data-slot="data-table-filter-content"
              data-step={state.drilled === null ? "fields" : "editor"}
              aria-label={meta.format("addFilter")}
              // The Trigger, Base UI's default, unless focus already moved to the value popover.
              finalFocus={() => !meta.focusLeft("menu", popupRef.current)}
              className={mergeClassName(
                className,
                selfFocusRingClass,
                overlayTimedPopupClass,
                menuPopupShellClass,
                slots.menu()
              )}
              onKeyDown={(event) => {
                onKeyDown?.(event);
                keepKeysFromToolbar(event);
              }}
              onTransitionEnd={(event) => {
                onTransitionEnd?.(event);
                morph.onTransitionEnd(event);
              }}
              {...props}>
              <MenuQueryContext value={query}>
                <EditorTargetContext value={target}>
                  {children ?? (
                    <>
                      <DataTableFilterFieldList />
                      <DefaultEditor />
                    </>
                  )}
                </EditorTargetContext>
              </MenuQueryContext>
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </OverlayPortal>
      </MenuPrimitive.Root>
    </SearchableMenu.Provider>
  );
}

/** The search group: Fuse's InputGroup around Base UI's Menu.Input, as Command.Input does. */
function MenuSearch({
  label,
  placeholder,
  hidden = false,
  onKeyDown,
  inputRef,
}: {
  readonly label: string;
  readonly placeholder: string;
  readonly hidden?: boolean;
  readonly onKeyDown?: ComponentProps<typeof SearchableMenu.Input>["onKeyDown"];
  readonly inputRef?: (input: HTMLInputElement | null) => void;
}): ReactElement {
  return (
    <div data-slot="data-table-filter-search" hidden={hidden} className={slots.search()}>
      <InputGroupRoot>
        <InputGroupAddon align="inline-start">
          <MagnifyingGlass aria-hidden />
        </InputGroupAddon>
        <SearchableMenu.Input
          ref={inputRef}
          aria-label={label}
          placeholder={placeholder}
          render={<InputGroupPlainInput />}
          {...definedProps({ onKeyDown })}
        />
      </InputGroupRoot>
    </div>
  );
}

/** The props of `DataTableFilter.FieldList`. */
export type DataTableFilterFieldListProps = Record<never, never>;

/**
 * The add menu's field step: the field search, one row per field and, from two characters on, a
 * "Values" group of option values across fields, "Status › Pending". Field rows are menu items,
 * and value rows are `menuitemcheckbox` with `aria-checked`. While a field is drilled into, only
 * its search stays mounted, hidden, so the query and Base UI's highlight survive until Back.
 */
export function DataTableFilterFieldList(_props: DataTableFilterFieldListProps): ReactElement {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.FieldList");
  const query = use(MenuQueryContext);
  const contains = useContains(meta.locale);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const attachSearch = useCallback((input: HTMLInputElement | null) => {
    searchRef.current = input;
  }, []);
  const { returnTo, drillOrigin } = state;
  const { clearReturnTo } = actions;
  // Back from an in-place editor: focus returns to the search. A search that took the field's
  // name is selected, so typing replaces it.
  useLayoutEffect(() => {
    const search = searchRef.current;
    if (returnTo === null || search === null) {
      return;
    }
    search.focus({ preventScroll: true });
    if (drillOrigin === "edit") {
      search.select();
    }
    clearReturnTo();
  }, [returnTo, drillOrigin, clearReturnTo]);
  const drilled = state.drilled !== null;
  const needle = query.trim();
  const fieldIds = Object.keys(meta.fields).filter((fieldId) => {
    const field = meta.fields[fieldId];
    return field !== undefined && (needle === "" || contains(field.label, needle));
  });

  // Quick search: every option field's values in config order, capped across fields.
  const quick: { readonly fieldId: string; readonly field: OptionField; readonly option: FilterOption }[] =
    [];
  let more = false;
  if (!drilled && needle.length >= QUICK_SEARCH_MIN) {
    for (const [fieldId, field] of Object.entries(meta.fields)) {
      if (more || (field.kind !== "option" && field.kind !== "multiOption")) {
        continue;
      }
      for (const option of field.options) {
        if (!contains(option.label, needle)) {
          continue;
        }
        if (quick.length === OPTION_LIMIT) {
          more = true;
          break;
        }
        quick.push({ fieldId, field, option });
      }
    }
  }

  return (
    <>
      <MenuSearch
        label={meta.format("searchFields")}
        placeholder={meta.format("searchFieldsPlaceholder")}
        hidden={drilled}
        inputRef={attachSearch}
      />
      {drilled ? null : (
        <>
          <SearchableMenu.Empty className={slots.empty()}>{meta.format("noFields")}</SearchableMenu.Empty>
          <SearchableMenu.List data-slot="data-table-filter-fields" className={slots.list()}>
            {fieldIds.map((fieldId) => {
              const field = meta.fields[fieldId];
              if (field === undefined) {
                return null;
              }
              const active = findFilter(state.filters, fieldId) !== undefined;
              return field.kind === "option" || field.kind === "multiOption" ? (
                <FieldSubmenu key={fieldId} fieldId={fieldId} field={field} active={active} />
              ) : (
                <FieldItem key={fieldId} fieldId={fieldId} field={field} active={active} />
              );
            })}
            {quick.length > 0 ? (
              <MenuPrimitive.Group data-slot="data-table-filter-quick">
                <MenuPrimitive.GroupLabel className={menuGroupLabelClass}>
                  {meta.format("valuesGroup")}
                </MenuPrimitive.GroupLabel>
                {quick.map(({ fieldId, field, option }) => (
                  <ValueItem
                    key={`${fieldId}:${option.value}`}
                    fieldId={fieldId}
                    field={field}
                    option={option}
                    path
                  />
                ))}
              </MenuPrimitive.Group>
            ) : null}
          </SearchableMenu.List>
          <p role="status" data-slot="data-table-filter-narrow" className={slots.narrowHint()}>
            {more ? meta.format("narrowHint") : null}
          </p>
        </>
      )}
    </>
  );
}

/** A field row's icon, label and the dot that says the field already has a filter. */
function FieldRowContent({
  field,
  active,
}: {
  readonly field: FilterField;
  readonly active: boolean;
}): ReactElement {
  return (
    <>
      {field.icon === undefined ? null : (
        <span aria-hidden className="contents text-muted-foreground">
          {field.icon}
        </span>
      )}
      <span className="min-w-0 truncate">{field.label}</span>
      {active ? <span aria-hidden className={slots.activeDot()} /> : null}
    </>
  );
}

/**
 * A text, number or date field: an item that drills into the field's editor in place. It keeps
 * the menu open, since `closeOnClick` defaults to true on Menu.Item (`MenuItem.tsx`). It ends with
 * a caret like a submenu row, because it leads to a further step.
 */
function FieldItem({
  fieldId,
  field,
  active,
}: {
  readonly fieldId: string;
  readonly field: FilterField;
  readonly active: boolean;
}): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.FieldList");
  return (
    <MenuPrimitive.Item
      data-slot="data-table-filter-field"
      data-field={fieldId}
      data-active={active || undefined}
      label={field.label}
      // The dot is decoration, and this says the row edits a filter.
      aria-description={active ? meta.format("filtered") : undefined}
      className={cn(menuItemClass, slots.row())}
      closeOnClick={false}
      onClick={() => {
        actions.drill(fieldId);
      }}>
      <FieldRowContent field={field} active={active} />
      <CaretRight aria-hidden className={active ? "text-muted-foreground" : slots.caret()} />
    </MenuPrimitive.Item>
  );
}

/**
 * An option or multi-option field: a filterable submenu of its values with its own query and
 * the shared cap. On a narrow viewport neither inline side fits, so it falls back below its row
 * through `fallbackAxisSide: "end"`, level with the menu's edge and as wide, covering only the
 * rows after its own.
 */
function FieldSubmenu({
  fieldId,
  field,
  active,
}: {
  readonly fieldId: string;
  readonly field: OptionField;
  readonly active: boolean;
}): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.FieldList");
  const [query, setQuery] = useState("");
  // Focus in a value submenu stays the menu's when the menu closes.
  const overlayRef = useOverlayRef(actions.registerOverlay, "menu");
  return (
    <SearchableMenu.Provider filter={null} value={query} onValueChange={setQuery} autoHighlight>
      <MenuPrimitive.SubmenuRoot
        onOpenChange={(open) => {
          actions.setSubmenuOpen(fieldId, open);
        }}>
        <MenuPrimitive.SubmenuTrigger
          data-slot="data-table-filter-field"
          data-field={fieldId}
          data-active={active || undefined}
          label={field.label}
          aria-description={active ? meta.format("filtered") : undefined}
          className={cn(menuItemClass, slots.row(), slots.fieldRow())}>
          <FieldRowContent field={field} active={active} />
          <CaretRight aria-hidden className={active ? "text-muted-foreground" : slots.caret()} />
        </MenuPrimitive.SubmenuTrigger>
        <OverlayPortal portal={MenuPrimitive.Portal}>
          <MenuPrimitive.Positioner
            data-slot="data-table-filter-submenu-positioner"
            // Beside the row on a wide screen, 4px out, its search level with the field row. Below
            // the row on a narrow one, 2px down. Either way -4 cancels the menu's 4px padding, so a
            // submenu below its row is flush with the menu's edge.
            sideOffset={({ side }) => (side === "top" || side === "bottom" ? 2 : 4)}
            alignOffset={-4}
            collisionPadding={8}
            collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "end" }}
            className={overlayPositionerClass}>
            <MenuPrimitive.Popup
              ref={overlayRef}
              data-slot="data-table-filter-options-menu"
              data-field={fieldId}
              // Base UI hands the trigger's label to the list inside, so the dialog names itself.
              aria-label={field.label}
              className={cn(selfFocusRingClass, overlayTimedPopupClass, menuPopupShellClass, slots.menu())}
              onKeyDown={keepKeysFromToolbar}>
              <OptionMenuBody fieldId={fieldId} field={field} query={query} />
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </OverlayPortal>
      </MenuPrimitive.SubmenuRoot>
    </SearchableMenu.Provider>
  );
}

/**
 * The submenu's body. Its order is taken as the submenu opens, so a tick never moves a row, and
 * picked values sit first under a separator. Each tick applies at once, and the chip appears in
 * the bar under the open menu.
 */
function OptionMenuBody({
  fieldId,
  field,
  query,
}: {
  readonly fieldId: string;
  readonly field: OptionField;
  readonly query: string;
}): ReactElement {
  const { state, meta } = useFilterInternals("DataTableFilter.FieldList");
  const filter = findFilter(state.filters, fieldId);
  const picked: readonly string[] = filter?.kind === field.kind ? filter.values : [];
  const counts = meta.facets.counts(fieldId);
  const [order] = useState(() => snapshotOrder(field, picked, counts));
  const contains = useContains(meta.locale);
  const matches = matchOptions(order, query, contains, OPTION_LIMIT);
  const searchLabel = meta.format("searchValues", { field: field.label });
  return (
    <>
      <MenuSearch label={searchLabel} placeholder={searchLabel} onKeyDown={closeSubmenuOnBackspace} />
      <SearchableMenu.Empty className={slots.empty()}>{meta.format("noValues")}</SearchableMenu.Empty>
      <SearchableMenu.List data-slot="data-table-filter-options" className={slots.list()}>
        {matches.pinned.length > 0 ? (
          <MenuPrimitive.Group data-group="pinned">
            {matches.pinned.map((option) => (
              <ValueItem key={option.value} fieldId={fieldId} field={field} option={option} pinned />
            ))}
            {matches.rest.length > 0 ? <MenuPrimitive.Separator className={menuSeparatorClass} /> : null}
          </MenuPrimitive.Group>
        ) : null}
        {matches.rest.map((option) => (
          <ValueItem key={option.value} fieldId={fieldId} field={field} option={option} />
        ))}
      </SearchableMenu.List>
      <p role="status" data-slot="data-table-filter-narrow" className={slots.narrowHint()}>
        {matches.more ? meta.format("narrowHint") : null}
      </p>
    </>
  );
}

/**
 * One option value, a `menuitemcheckbox` with `aria-checked`. A checkbox and not a radio, because
 * a second pick adds a value, `is` becoming `is any of`, and never replaces the first. It stays
 * open on a press, Menu.CheckboxItem's default. The count is hidden from assistive technology, so
 * the row's name stays "Paid".
 */
function ValueItem({
  fieldId,
  field,
  option,
  pinned = false,
  path = false,
}: {
  readonly fieldId: string;
  readonly field: OptionField;
  readonly option: FilterOption;
  readonly pinned?: boolean;
  /** A quick-search row, "Status › Pending", named "Status Pending". */
  readonly path?: boolean;
}): ReactElement {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.FieldList");
  const filter = findFilter(state.filters, fieldId);
  const picked: readonly string[] = filter?.kind === field.kind ? filter.values : [];
  const counts = meta.facets.counts(fieldId);
  const count = counts === undefined ? undefined : (counts.get(option.value) ?? 0);
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="data-table-filter-option"
      data-quick={path || undefined}
      data-field={fieldId}
      data-value={option.value}
      data-pinned={pinned || undefined}
      data-zero={count === 0 || undefined}
      label={path ? `${field.label} ${option.label}` : option.label}
      checked={picked.includes(option.value)}
      onCheckedChange={() => {
        actions.toggle(fieldId, option.value);
      }}
      className={cn(menuItemClass, menuItemIndicatorRoomClass, slots.row(), slots.option())}>
      <span className={menuItemIndicatorClass}>
        <MenuPrimitive.CheckboxItemIndicator>
          <Check aria-hidden />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {option.icon === undefined ? null : (
        <span aria-hidden className="contents">
          {option.icon}
        </span>
      )}
      <span className="min-w-0 truncate">
        {path ? (
          <>
            <span className={slots.pathSeparator()}>{field.label}</span>
            <span aria-hidden className={slots.pathSeparator()}>
              {" ›"}
            </span>{" "}
          </>
        ) : null}
        {option.label}
      </span>
      {count === undefined ? null : <OptionCount count={count} />}
    </MenuPrimitive.CheckboxItem>
  );
}

DataTableFilterContent.displayName = "DataTableFilter.Content";
DataTableFilterFieldList.displayName = "DataTableFilter.FieldList";
