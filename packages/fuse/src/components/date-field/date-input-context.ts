"use client";

import { createContext, use } from "react";
import type { KeyboardEvent } from "react";

import type { DateDraft, EditableSegmentType, HourCycle } from "./date-draft";
import type { DateInputEditableSegmentData, DateInputSegmentData } from "./date-input-types";

/** What a segment's gestures do, carried out by the Root over its edit session. */
export type DateInputActions = {
  /**
   * A key down on a focusable segment, a unit or the zone's name: the arrows, page keys, Home, End,
   * Backspace and Delete.
   */
  readonly keyDown: (segment: DateInputSegmentData, event: KeyboardEvent<HTMLElement>) => void;
  /** Backspace or Delete from a virtual keyboard's `beforeinput`. */
  readonly erase: (segment: DateInputEditableSegmentData, event: Event, target: HTMLElement) => void;
  /** A character typed into a segment. */
  readonly type: (type: EditableSegmentType, key: string, event: Event, target: HTMLElement) => void;
  /** A segment took focus. */
  readonly segmentFocused: () => void;
  /**
   * A focused segment is leaving the DOM, as a granularity change removes it: focus moves to the
   * segment before it, or after it when it was the first, as React Aria's `useDateSegment` does.
   */
  readonly segmentRemoved: (element: HTMLElement) => void;
};

/** What a Segment reads from its Root. */
export type DateInputRootContextValue = {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly invalid: boolean;
  /** Whether segments are textboxes, for iOS VoiceOver. */
  readonly ios: boolean;
  readonly locale: string;
  readonly hourCycle: HourCycle;
  /** What the segments show. */
  readonly draft: DateDraft;
  /** The first segment a user can focus, which carries the description. */
  readonly firstEditableIndex: number;
  readonly ariaLabel: string | undefined;
  readonly ariaLabelledBy: string | undefined;
  readonly describedBy: string | undefined;
  /** A segment's spoken unit, such as "month". */
  readonly segmentName: (type: EditableSegmentType | "timeZoneName") => string;
  /** The word an empty spinbutton speaks. */
  readonly emptyText: string;
  readonly actions: DateInputActions;
};

/** The Root's context for its segments. */
export const DateInputRootContext = createContext<DateInputRootContextValue | undefined>(undefined);

/**
 * The enclosing `DateInput.Root`'s context.
 *
 * @returns The context.
 * @throws Error when a Segment renders outside a Root, a composition defect.
 */
export function useDateInputRootContext(): DateInputRootContextValue {
  const context = use(DateInputRootContext);
  if (context === undefined) {
    throw new Error("DateInput.Segment must be rendered inside DateInput.Root");
  }
  return context;
}

/** The selector that finds a Root's focusable segments, in document order. */
export const SEGMENT_SELECTOR = '[data-slot="date-input-segment"][tabindex]';
