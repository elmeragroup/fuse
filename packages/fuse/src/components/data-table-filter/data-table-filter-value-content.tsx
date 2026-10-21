"use client";

// The value popover: one Base UI Popover from a handle, shared by every chip. Each chip's Value is
// a detached trigger of it, so the editors are written once, and a press on another chip's Value
// while it is open moves the popover there instead of opening a second one. `Editor` lives here
// too. The popover renders it for a chip, and the add menu renders the same part in place for a
// drilled field.

import { Fragment, use, useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent, ReactElement, ReactNode } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Select as SelectPrimitive } from "@base-ui/react/select";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { CaretDown } from "../../icons/generated/caret-down";
import { CaretLeft } from "../../icons/generated/caret-left";
import { definedProps } from "../../internal/defined-props";
import { isHTMLElement } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { popoverShellClass } from "../../styles/inner-corner/popover";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { Button } from "../button/button";
import { overlayPositionerClass, overlayTimedPopupClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import { SelectContent, SelectItem, SelectRoot } from "../select/select";
import {
  drillKey,
  editKey,
  EditorTargetContext,
  useFilterInternals,
  useOverlayRef,
} from "./data-table-filter";
import type { EditorTarget } from "./data-table-filter";
import { EditorContext, useCompositionGuard } from "./data-table-filter-editor-context";
import type { EditorContextValue } from "./data-table-filter-editor-context";
import {
  DataTableFilterDateEditor,
  DataTableFilterNumberEditor,
  DataTableFilterOptionEditor,
  DataTableFilterTextEditor,
} from "./data-table-filter-editors";
import { DataTableFilterCompositionError } from "./data-table-filter-error";
import { dataTableFilterSlots as slots } from "./data-table-filter-variants";
import { draftFor, draftSays, draftWrite } from "./editor-draft";
import type { DraftValues, EditorDraft } from "./editor-draft";
import type { FilterField } from "./filter-fields";
import { resolveFocusTarget } from "./filter-focus";
import type { FilterOperator } from "./filter-model";
import { convertValues, filterValuesEqual, findFilter, operatorChoices } from "./filter-model";

/** The props of `DataTableFilter.ValueContent`: Base UI Popover Popup's. */
export type DataTableFilterValueContentProps = Omit<
  ComponentProps<typeof PopoverPrimitive.Popup>,
  "children"
> & {
  /** Replaces the editor. `useDataTableFilter().state.editing` names the edited field. */
  children?: ReactNode;
};

/**
 * The value popover every chip's Value opens, anchored below the whole chip at a fixed width. It
 * is named by the editor's title. Focus moves to the editor's first control as it opens and back
 * to the chip's Value as it closes. A ghost chip's focus goes to its neighbour instead, since the
 * ghost leaves. A press on another chip's Value moves the popover there: it glides, its height
 * morphs and the editors cross-fade.
 */
export function DataTableFilterValueContent({
  className,
  children,
  ref,
  ...props
}: DataTableFilterValueContentProps): ReactElement {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.ValueContent");
  const { registerValueContent } = actions;
  useLayoutEffect(registerValueContent, [registerValueContent]);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useOverlayRef(actions.registerOverlay, "value");
  // A consumer's ref joins the popup ref that initial focus and focus return read.
  const popupRefs = useMergedRefs(ref, useMergedRefs(popupRef, overlayRef));
  const field = state.editing === null ? undefined : meta.fields[state.editing];
  // Anchored to the whole chip, while focus return and aria-expanded follow the Value that opened
  // it. Base UI 1.9 resolves a function anchor once per mount (`useAnchorPositioning.ts`), so the
  // element itself is passed, and a move to another chip anchors anew and glides. The chip
  // registered its element before the press that set `editing`.
  const anchor = state.editing === null ? null : meta.chipElement(state.editing);
  const target: EditorTarget = { place: "popover", fieldId: state.editing };
  return (
    <PopoverPrimitive.Root
      handle={meta.valueHandle}
      // Escape, an outside press and Tab close the popover, each an exit for the editor. A press
      // on Clear or Remove ended its session first.
      onOpenChange={(open) => {
        if (open) {
          actions.noteOpen("value");
        } else {
          actions.applyDrafts();
        }
      }}
      onOpenChangeComplete={(open) => {
        if (!open) {
          actions.settleValue();
        }
      }}>
      <OverlayPortal portal={PopoverPrimitive.Portal}>
        <PopoverPrimitive.Positioner
          data-slot="data-table-filter-positioner"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          {...definedProps({ anchor: anchor ?? undefined })}
          className={cn(overlayPositionerClass, slots.positioner())}>
          <PopoverPrimitive.Popup
            ref={popupRefs}
            data-slot="data-table-filter-value-content"
            data-kind={field?.kind}
            // Base UI runs this again when another chip's Value takes over the open popover. The
            // Viewport then still holds the previous editor beside the current one, so the search
            // starts in the current one, or focus would land on a control about to unmount.
            initialFocus={() => {
              const popup = popupRef.current;
              if (popup === null) {
                return true;
              }
              const current = popup.querySelector<HTMLElement>("[data-current]") ?? popup;
              return resolveFocusTarget(current) ?? true;
            }}
            finalFocus={() => {
              if (meta.focusLeft("value", popupRef.current)) {
                return false;
              }
              // A ghost chip unmounts once this closes, so its focus goes to a neighbour.
              const index = state.chips.findIndex((chip) => chip.ghost);
              return index === -1 ? true : (meta.neighbourOf(state.chips, index) ?? true);
            }}
            className={mergeClassName(
              className,
              selfFocusRingClass,
              overlayTimedPopupClass,
              popoverShellClass,
              slots.content()
            )}
            {...definedProps(props)}>
            <PopoverPrimitive.Viewport data-slot="data-table-filter-viewport" className={slots.viewport()}>
              <EditorTargetContext value={target}>{children ?? <DefaultEditor />}</EditorTargetContext>
            </PopoverPrimitive.Viewport>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </OverlayPortal>
    </PopoverPrimitive.Root>
  );
}

/** What `<DataTableFilter.ValueContent />` renders without children. */
export function DefaultEditor(): ReactElement {
  return (
    <DataTableFilterEditor>
      <DataTableFilterOptionEditor />
      <DataTableFilterTextEditor />
      <DataTableFilterNumberEditor />
      <DataTableFilterDateEditor />
    </DataTableFilterEditor>
  );
}

/** The props of `DataTableFilter.Editor`. */
export type DataTableFilterEditorProps = ComponentProps<"div">;

/**
 * A field's editor in whichever overlay renders it: the value popover for a chip, or the add menu
 * in place of its field list. Its header holds the field's name and, for text, number and date
 * fields, the operator. In the add menu it also starts with a Back button, it is a group named by
 * its title, and it keeps every key but Tab from the menu. The kind editors are its children, and
 * each renders only for its own kinds. A move to another field mounts it fresh.
 */
export function DataTableFilterEditor({
  className,
  children,
  ...props
}: DataTableFilterEditorProps): ReactElement | null {
  const { state, meta } = useFilterInternals("DataTableFilter.Editor");
  const target = use(EditorTargetContext);
  if (target === null) {
    throw new DataTableFilterCompositionError("DataTableFilter.Editor", "outside-overlay");
  }
  const { fieldId } = target;
  const field = fieldId === null ? undefined : meta.fields[fieldId];
  if (fieldId === null || field === undefined) {
    return null;
  }
  const key = target.place === "menu" ? drillKey(fieldId) : editKey(fieldId);
  return (
    // Keyed by the overlay's open too, so every open starts a fresh editing session.
    <Fragment key={`${key}:${String(state.openCount)}`}>
      <EditorFrame
        fieldId={fieldId}
        field={field}
        focusKey={key}
        target={target}
        className={className}
        {...props}>
        {children}
      </EditorFrame>
    </Fragment>
  );
}

/**
 * Keeps keys typed in the menu's in-place editor inside it. The menu popup's own handlers would
 * take them otherwise. Its list navigation prevents Home and End and moves its highlight on the
 * arrows (`useListNavigation.ts`), its dismissal closes the whole menu on Escape
 * (`useDismiss.ts`), and the toolbar relay takes the rest. All of them sit on the popup or the
 * document, so a stop at the editor reaches them first. A popup inside the editor, such as the
 * operator's Select, stops its own Escape before this sees it. Escape goes back to the field list.
 *
 * Tab passes, so focus moves on and leaves the menu as it does from the search. Shift+Tab from
 * Back, the editor's first control, closes the menu, as Shift+Tab from the search does
 * (`useMenuFilterKeyDown.ts`). Left to the browser it would move focus to the Trigger with the
 * menu still open, since focus-out never closes a popup when focus returns to the element it came
 * from (`FloatingFocusManager.tsx`).
 */
function keepKeysInEditor(
  event: KeyboardEvent<HTMLDivElement>,
  back: () => void,
  close: () => void,
  composing: boolean
): void {
  if (event.key === "Tab") {
    if (
      event.shiftKey &&
      isHTMLElement(event.target) &&
      event.target.dataset.slot === "data-table-filter-back"
    ) {
      event.preventDefault();
      close();
    }
    return;
  }
  if (event.key === "Escape" && !composing) {
    event.preventDefault();
    back();
  }
  event.stopPropagation();
}

function EditorFrame({
  fieldId,
  field,
  focusKey,
  target,
  className,
  children,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: DataTableFilterEditorProps & {
  readonly fieldId: string;
  readonly field: FilterField;
  readonly focusKey: string;
  readonly target: EditorTarget;
}): ReactElement {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.Editor");
  const titleId = useId();
  const filter = findFilter(state.filters, fieldId);
  const range = meta.facets.range(fieldId);
  const [draft, setDraftState] = useState<EditorDraft>(() => draftFor(field, filter, range));
  // The draft follows the applied filter whenever it changes to something the draft does not
  // already say: a Clear, a Remove, or an operator picked on the chip. A commit of the draft
  // itself changes nothing, so typing carries on, and so does an equal copy, such as a host that
  // parses its filters from the URL again. The state changes during render, as React's docs
  // adjust state from a changed prop.
  const [seenFilter, setSeenFilter] = useState(filter);
  if (!filterValuesEqual(seenFilter, filter)) {
    setSeenFilter(filter);
    if (!draftSays(field.kind, draft, filter)) {
      setDraftState(draftFor(field, filter, range));
    }
  }
  // The editor owns its draft and its one commit. Event handlers read the latest draft from here,
  // written at once by setDraft, so a value committed in the same event as its change settles.
  const latest = useRef({ draft, filter, range });
  useLayoutEffect(() => {
    latest.current = { draft, filter, range };
  });
  // The draft the last settle consumed, so a second exit path for the same draft writes nothing.
  const settled = useRef<EditorDraft | null>(null);
  // The editing session. A Clear or a Remove ends it, and closes the overlay that holds the editor.
  // No settle or commit from an ended session writes, such as a focused field's blur as it closes.
  const ended = useRef(false);
  const write = useCallback((next: EditorDraft) => {
    latest.current = { ...latest.current, draft: next };
    setDraftState(next);
  }, []);
  const setDraft = useCallback(
    (next: DraftValues) => {
      if (ended.current) {
        return;
      }
      write({ operator: next.operator, values: next.values, edited: true });
    },
    [write]
  );
  const updateDraft = useCallback(
    (change: (current: DraftValues) => DraftValues) => {
      setDraft(change(latest.current.draft));
    },
    [setDraft]
  );
  const { registerDraft } = actions;
  // The Root recreates its actions on every render, so settle reads the latest one. Its own
  // identity never changes, so a host's re-render never restarts the text editor's pause.
  const setValues = useRef(actions.setValues);
  useLayoutEffect(() => {
    setValues.current = actions.setValues;
  });
  const settle = useCallback(() => {
    const current = latest.current;
    if (ended.current || settled.current === current.draft) {
      return;
    }
    settled.current = current.draft;
    const next = draftWrite(field.kind, current.draft, current.filter, current.range);
    if (next !== undefined) {
      setValues.current(fieldId, next.operator, next.values);
    }
  }, [field.kind, fieldId]);
  const commitDraft = useCallback(
    (change: (current: DraftValues) => DraftValues) => {
      if (ended.current) {
        return;
      }
      const next = change(latest.current.draft);
      write({ operator: next.operator, values: next.values, edited: true });
      settle();
    },
    [write, settle]
  );
  const discard = useCallback(() => {
    ended.current = true;
    settled.current = latest.current.draft;
  }, []);
  useLayoutEffect(
    () => registerDraft(focusKey, { settle, discard }),
    [registerDraft, focusKey, settle, discard]
  );
  const changeOperator = (operator: FilterOperator) => {
    const current = latest.current;
    const upper = field.kind === "number" ? current.range?.[1] : undefined;
    const values = convertValues(field.kind, current.draft.operator, operator, current.draft.values, upper);
    // The pick keeps whether the values were edited. A draft nobody has touched only changes shape,
    // and anything typed, or an applied filter, applies with the new operator in one write.
    if (ended.current) {
      return;
    }
    write({ operator, values, edited: current.draft.edited });
    settle();
  };
  const back = target.place === "menu" ? target.back : undefined;
  const composition = useCompositionGuard();
  const editor: EditorContextValue = {
    fieldId,
    field,
    filter,
    draft,
    setDraft,
    updateDraft,
    commitDraft,
    settle,
    changeOperator,
    focusKey,
    back,
    isComposing: composition.isComposing,
  };
  const operatorInHeader = field.kind === "text" || field.kind === "number" || field.kind === "date";
  const title = (
    <>
      {field.icon === undefined ? null : (
        <span aria-hidden className="contents">
          {field.icon}
        </span>
      )}
      <span className={slots.titleText()}>{field.label}</span>
    </>
  );
  return (
    <EditorContext value={editor}>
      <div
        data-slot="data-table-filter-editor"
        data-kind={field.kind}
        data-place={target.place}
        // A group of the editor's controls. In the menu it is named by its title inside the "Add
        // filter" dialog. In the popover the dialog itself takes its name from the title.
        role="group"
        {...definedProps({ "aria-labelledby": back === undefined ? undefined : titleId })}
        className={cn(slots.editor(), back === undefined ? undefined : slots.menuEditor(), className)}
        // The consumer's handlers run first, then the part's own, as everywhere in Fuse.
        onCompositionStart={(event) => {
          onCompositionStart?.(event);
          composition.onCompositionStart();
        }}
        onCompositionEnd={(event) => {
          onCompositionEnd?.(event);
          composition.onCompositionEnd();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (back !== undefined && !event.isPropagationStopped()) {
            keepKeysInEditor(event, back, actions.close, composition.isComposing(event));
          }
        }}
        {...props}>
        <div data-slot="data-table-filter-header" className={slots.header()}>
          {back === undefined ? (
            <PopoverPrimitive.Title className={slots.title()}>{title}</PopoverPrimitive.Title>
          ) : (
            <>
              <Button
                data-slot="data-table-filter-back"
                variant="ghost"
                size="icon-sm"
                aria-label={meta.format("back")}
                className={slots.back()}
                onClick={back}>
                <CaretLeft aria-hidden />
              </Button>
              <span id={titleId} className={slots.title()}>
                {title}
              </span>
            </>
          )}
          {operatorInHeader ? <EditorOperator /> : null}
        </div>
        {/* The body scrolls under a still header when a tall editor, such as a calendar, meets
            the popup's height cap. */}
        <div data-slot="data-table-filter-editor-body" className={slots.editorBody()}>
          {children}
        </div>
      </div>
    </EditorContext>
  );
}

/**
 * The header's operator for text, number and date fields. It lists the operators the field
 * allows, and the operator decides the editor's shape, one value or a range. A pick converts the
 * editor's current draft, typed text included, and applies the pair in one write. An untouched
 * draft only changes shape. Its trigger has the chip operator's face, a ghost Fuse Button.
 */
function EditorOperator(): ReactElement | null {
  const editor = use(EditorContext);
  const { actions, meta } = useFilterInternals("DataTableFilter.Editor");
  // Focus in the operator's popup stays with the overlay that holds the editor: the add menu for
  // the in-place editor, else the value popover.
  const host = use(EditorTargetContext)?.place === "menu" ? "menu" : "value";
  const overlayRef = useOverlayRef(actions.registerOverlay, host);
  if (editor === null) {
    return null;
  }
  const { field, draft } = editor;
  // The chip's own choices, so an applied operator the config has since left out still shows its
  // label as the current choice.
  const choices = operatorChoices(field, editor.filter);
  // A draft's operator the config left out before it was ever applied keeps its label too.
  const items = (choices.includes(draft.operator) ? choices : [draft.operator, ...choices]).map(
    (operator) => ({
      value: operator,
      label: meta.formatOperator(operator, field.kind),
    })
  );
  return (
    <SelectRoot<FilterOperator>
      items={items}
      value={draft.operator}
      modal={false}
      onValueChange={(operator) => {
        if (operator !== null) {
          editor.changeOperator(operator);
        }
      }}>
      <SelectPrimitive.Trigger
        data-slot="data-table-filter-editor-operator"
        aria-label={meta.format("operatorLabel", { field: field.label })}
        render={<Button variant="ghost" size="sm" />}
        className={slots.headerOperator()}>
        <SelectPrimitive.Value />
        <CaretDown data-icon="inline-end" aria-hidden />
      </SelectPrimitive.Trigger>
      <SelectContent ref={overlayRef} alignItemWithTrigger={false} align="end">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

DataTableFilterValueContent.displayName = "DataTableFilter.ValueContent";
DataTableFilterEditor.displayName = "DataTableFilter.Editor";
