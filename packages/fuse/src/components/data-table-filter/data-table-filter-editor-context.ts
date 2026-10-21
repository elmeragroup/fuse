"use client";

// The editor's own context: the edited field, its applied filter and the draft a text, number or
// date editor holds until it commits. Option editors commit on each toggle and ignore the draft.

import { createContext, use, useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { DataTableFilterCompositionError } from "./data-table-filter-error";
import type { DraftValues, EditorDraft } from "./editor-draft";
import type { FilterField, FilterFieldOfKind } from "./filter-fields";
import type { FilterKind, FilterOperator, FilterValue } from "./filter-model";

export type { DraftValues, EditorDraft } from "./editor-draft";

/** The editor a kind editor renders in. */
export type EditorContextValue = {
  /** The edited field's column id. */
  readonly fieldId: string;
  /** The edited field. */
  readonly field: FilterField;
  /** The applied filter, if any. */
  readonly filter: FilterValue | undefined;
  /** The draft, which follows the applied filter whenever that changes to something it does not say. */
  readonly draft: EditorDraft;
  /** A person's change: replaces the draft's values, marks it edited, and opens a new session. */
  readonly setDraft: (draft: DraftValues) => void;
  /** A person's change derived from the latest draft, which an earlier change in the event set. */
  readonly updateDraft: (change: (current: DraftValues) => DraftValues) => void;
  /**
   * A control's commit, such as a NumberField's blur: derives the draft and settles it, in the
   * editor's current session only. After a Clear or a Remove ended the session, it does nothing.
   */
  readonly commitDraft: (change: (current: DraftValues) => DraftValues) => void;
  /**
   * Commits the draft in one write, if it writes anything, and consumes it: a second call for the
   * same draft writes nothing, and so does any call after a Clear or a Remove ended the session. Every exit path goes through it: a typing pause, Enter, Escape, a
   * blur, an outside press, Tab out, Back, and a move to another field.
   */
  readonly settle: () => void;
  /** Changes the operator, converting the current draft, and settles the pair in one write. */
  readonly changeOperator: (operator: FilterOperator) => void;
  /** The key `useFocusRequest` matches when another chip's Value moves the popover here. */
  readonly focusKey: string;
  /** In the add menu, goes back to the field list. Undefined in the value popover. */
  readonly back: (() => void) | undefined;
  /** Whether a key belongs to an IME composition, which must neither apply nor dismiss. */
  readonly isComposing: (event: KeyboardEvent) => boolean;
};

/** The composition handlers for an editor's element, and its key test. */
type CompositionGuard = {
  readonly onCompositionStart: () => void;
  readonly onCompositionEnd: () => void;
  readonly isComposing: (event: KeyboardEvent) => boolean;
};

/**
 * Tracks IME composition inside the editor. A key pressed while composing confirms the
 * composition, not the editor. Safari fires `compositionend` before the keydown that ends the
 * composition, with `isComposing` already false, so the guard stays up for 5 ms after it, as Base
 * UI's dismissal does (`useDismiss.ts`).
 *
 * @returns The composition handlers for the editor's element, and the key test.
 */
export function useCompositionGuard(): CompositionGuard {
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    []
  );
  const onCompositionStart = useCallback(() => {
    clearTimeout(timer.current);
    composing.current = true;
  }, []);
  const onCompositionEnd = useCallback(() => {
    composing.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      composing.current = false;
    }, 5);
  }, []);
  const isComposing = useCallback(
    (event: KeyboardEvent) => composing.current || event.nativeEvent.isComposing,
    []
  );
  return { onCompositionStart, onCompositionEnd, isComposing };
}

/** Provided by `DataTableFilter.Editor` for its kind editors. */
export const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * The editor a kind editor renders in, when the edited field has one of its kinds.
 *
 * @template K - The kinds the editor handles.
 * @param part - The kind editor's name, for the error.
 * @param kinds - The kinds the editor handles.
 * @returns The editor narrowed to those kinds, or null when the edited field has another kind.
 */
export function useKindEditor<K extends FilterKind>(
  part: string,
  kinds: readonly K[]
): (EditorContextValue & { readonly field: FilterFieldOfKind<K> }) | null {
  const editor = use(EditorContext);
  if (editor === null) {
    throw new DataTableFilterCompositionError(part, "outside-editor");
  }
  if (!isFieldOfKinds(editor.field, kinds)) {
    return null;
  }
  return { ...editor, field: editor.field };
}

function isFieldOfKinds<K extends FilterKind>(
  field: FilterField,
  kinds: readonly K[]
): field is FilterFieldOfKind<K> {
  const all: readonly FilterKind[] = kinds;
  return all.includes(field.kind);
}
