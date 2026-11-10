"use client";

// A segment's DOM input, as React Aria's `useDateSegment` handles it. Typing and deleting arrive as
// `beforeinput`, which React's `onBeforeInput` (a `keypress` polyfill) misses for deletion,
// composition and Android's virtual keyboards; every edit is prevented and handed to the session, so
// the segment's text is always React's. Composition cannot be canceled, so its text is put back on
// `input`. A selection inside the focused segment stays collapsed, or Chrome on Android composes
// into it. The listeners belong to the element: a callback ref attaches them to each node the
// segment renders, so a `render` that swaps the element keeps them.

import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefCallback } from "react";

import { hasFocus } from "../../internal/active-element";
import { isInputEvent } from "../../internal/dom-node";

/** What a segment's DOM input does with an edit. */
export type SegmentInputHandlers = {
  /** Whether the segment takes edits now; an edit to another segment is still prevented. */
  readonly editable: boolean;
  /** Whether the segment is the day period, whose letters Android may send as composition. */
  readonly dayPeriod: boolean;
  /** Backspace or Delete from a virtual keyboard. */
  readonly erase: (event: InputEvent) => void;
  /** A typed character. */
  readonly type: (key: string, event: InputEvent) => void;
};

/**
 * A callback ref that wires a segment element's `beforeinput`, `input` and the document's
 * `selectionchange` while it is mounted, reading the latest handlers at event time.
 *
 * @param handlers - The segment's handlers this render.
 * @returns The ref to put on the segment element.
 */
export function useSegmentInput(handlers: SegmentInputHandlers): RefCallback<HTMLElement> {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });

  return useCallback((element: HTMLElement | null) => {
    if (element === null) {
      return undefined;
    }
    const document = element.ownerDocument;
    let composed: string | null = null;

    function onBeforeInput(event: Event): void {
      if (element === null || !isInputEvent(event, element) || !latest.current.editable) {
        return;
      }
      switch (event.inputType) {
        case "deleteContentBackward":
        case "deleteContentForward":
          event.preventDefault();
          latest.current.erase(event);
          return;
        case "insertCompositionText":
          composed = element.textContent;
          // oxlint-disable-next-line no-self-assign -- Safari stays in composition unless the text is written back.
          element.textContent = element.textContent;
          return;
        default:
          event.preventDefault();
          for (const character of event.data ?? "") {
            latest.current.type(character, event);
          }
      }
    }

    function onInput(event: Event): void {
      if (element === null || !isInputEvent(event, element) || event.inputType !== "insertCompositionText") {
        return;
      }
      element.textContent = composed;
      if (event.data !== null && latest.current.editable && latest.current.dayPeriod) {
        latest.current.type(event.data, event);
      }
    }

    function onSelectionChange(): void {
      // Every segment hears every selection change on the page; only the focused one reads it.
      if (element === null || !hasFocus(element) || !latest.current.editable) {
        return;
      }
      const selection = document.getSelection();
      if (selection?.anchorNode != null && element.contains(selection.anchorNode)) {
        selection.collapse(element);
      }
    }

    element.addEventListener("beforeinput", onBeforeInput);
    element.addEventListener("input", onInput);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      element.removeEventListener("beforeinput", onBeforeInput);
      element.removeEventListener("input", onInput);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);
}
