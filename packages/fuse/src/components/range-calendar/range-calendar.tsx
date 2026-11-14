"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { isElement } from "../../internal/dom-node";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { temporal } from "../../temporal/temporal";
import type { TemporalValue } from "../../temporal/temporal-value";
import { CalendarRootContext, createSelectionOwner } from "../calendar/calendar-context";
import type { CalendarRootContextValue } from "../calendar/calendar-context";
import { boundDay, showsDay, startAlignedMonths } from "../calendar/calendar-dates";
import {
  useCalendarBounds,
  useCalendarSettings,
  useRangeProp,
  useVisibleMonthCount,
} from "../calendar/calendar-input";
import type { CalendarViewProps, RangePropEnds } from "../calendar/calendar-input";
import { createCalendarStore, useCalendarSelector } from "../calendar/calendar-store";
import { calendarVariants } from "../calendar/calendar-variants";
import { initialSharedState, useCalendarNavigation } from "../calendar/use-calendar-navigation";
import { rangeCalendarStrings } from "./intl";
import { anchoredBounds, orderedRange, unavailableFor } from "./range-selection";
import type {
  DayRange,
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValue,
  RangeCommitBehavior,
  RangeRules,
} from "./range-selection";
import { useOutsidePress } from "./use-outside-press";
import { useRangeSelection } from "./use-range-selection";
import type { RangeCalendarState } from "./use-range-selection";

export type {
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValue,
  RangeCalendarValueChangeReason,
} from "./range-selection";

const styles = calendarVariants();

/**
 * What an open range does when focus leaves the calendar or the user presses outside its days:
 * `"select"` completes it at the focused or hovered day; `"reset"` drops it and keeps the previous
 * range.
 */
export type RangeCalendarCommitBehavior = RangeCommitBehavior;

/** The state `RangeCalendar.Root` shares with its `render` callback and writes as data attributes. */
export type RangeCalendarRootState = {
  /** Whether nothing in the calendar responds. */
  readonly disabled: boolean;
  /** Whether the value cannot change. */
  readonly readonly: boolean;
  /** Whether the range has an end the calendar would refuse: out of bounds or unavailable. */
  readonly invalid: boolean;
  /** Whether the user is choosing a range: one end is anchored and the other follows focus. */
  readonly selecting: boolean;
};

type RootElementProps = Omit<
  useRender.ComponentProps<"div", RangeCalendarRootState>,
  "defaultValue" | "onChange" | "aria-label" | "aria-labelledby" | "className"
>;

type RootClassName = useRender.ComponentProps<"div", RangeCalendarRootState>["className"];

/** `RangeCalendar.Root` takes a `div`'s props, Base UI's `render` and the calendar's own. */
export type RangeCalendarRootProps = RootElementProps &
  CalendarViewProps & {
    /**
     * The selected range, when the parent owns it: each end a `Temporal.PlainDate` from any
     * implementation. A range given in reverse shows the earlier day first. A server component
     * cannot pass one, since it reaches the client as ISO text, which the calendar refuses with a
     * `TypeError`: build the value in a client component. `null` selects nothing.
     *
     * The range's first and last day buttons start their names with the whole range, such as
     * "Selected Range: Monday, October 12 to Friday, October 16, 2026", and every selected day's
     * name ends in " selected". The focused day is described as "Click to start selecting date
     * range", and as "Click to finish selecting date range" while a range is open.
     *
     * Import `@elmeragroup/fuse/temporal-polyfill` on the server and in the browser for engines
     * without `Temporal`, and type-check with TypeScript 6 and an `esnext` lib, as
     * `/quick-start#temporal` shows.
     */
    value?: RangeCalendarValue | null;
    /**
     * The range selected first, when the calendar owns its value. Takes what `value` takes. With
     * neither `value` nor `defaultValue`, the calendar opens on today's month, as `Calendar` does.
     */
    defaultValue?: RangeCalendarValue | null;
    /**
     * Called when the user completes a range, with this runtime's `Temporal.PlainDate`s, earlier
     * day first. The first day pressed, or chosen with Enter or Space, only anchors the range and
     * calls nothing. The range then follows the focused or hovered day across every visible month
     * until a second day completes it, and a second day before the first swaps them. After
     * anchoring, Enter or Space also moves focus on a day, so a keyboard user sees the range
     * start. Escape drops the anchor and keeps the previous range.
     *
     * `details.reason` is `"day-press"`, `"keyboard"`, `"outside-press"` or `"focus-out"`, and
     * `details.event` and `details.trigger` are the DOM event and the element. A press on an
     * outside element that takes focus, such as a mouse press on a button in most browsers,
     * reports `"focus-out"`, while a touch tap on the same button reports `"outside-press"`, so
     * treat the two alike. Canceling a day press or key with `details.cancel()` keeps the value
     * and the anchor, so the user can pick another end; canceling an outside press or focus-out
     * keeps the value and drops the anchor. `details.getValidationError()` returns `null` for a
     * range the calendar accepts, and otherwise `"rangeUnderflow"` for a start before `minValue`,
     * `"rangeOverflow"` for an end after `maxValue` and `"unavailable"` for an end
     * `isDateUnavailable` refuses with no anchor.
     */
    onValueChange?: (value: RangeCalendarValue, details: RangeCalendarRootValueChangeEventDetails) => void;
    /**
     * What an open range does when focus leaves the calendar or the user releases a press outside
     * its days and month buttons: `"select"` completes it at the focused or hovered day, `"reset"`
     * drops the anchor and keeps the previous range. A touch that scrolls the page leaves the
     * range open.
     * @default "select"
     */
    commitBehavior?: RangeCalendarCommitBehavior;
    /**
     * Extra classes, merged last. The Root carries `data-selecting` while a range is open, and
     * `data-invalid` when an end falls outside the bounds or on an unavailable day. Each day's
     * cell and button carry `data-selected` on every selected day, `data-in-range` from the
     * range's start to its end, `data-selection-start` and `data-selection-end` on its ends, and
     * `data-highlighted` on the days of a range being chosen.
     */
    className?: RootClassName;
    /**
     * The parts, Calendar's under the same names: a `RangeCalendar.Header` with
     * `RangeCalendar.DecrementMonth`, `RangeCalendar.VisibleRangeHeading` and
     * `RangeCalendar.IncrementMonth`, then `RangeCalendar.Months`. The Root's first element child
     * is a hidden prompt, so your first part is not its `:first-child`.
     */
    children?: RootElementProps["children"];
    /**
     * Days the user may focus but not select, given the anchored day while a range is being chosen
     * (`null` otherwise), so the available days can depend on the first day picked. Once a range is
     * anchored it can reach only the run of available days around the anchor, looked for up to
     * `visibleMonths` months each way: the days past the nearest unavailable day are disabled until
     * the range completes. An unavailable day further from the anchor is not looked for, as in React
     * Aria, so a longer range can span it; check such a range in `onValueChange`. Keep the
     * function's identity stable across renders, since every day re-renders when it changes.
     */
    isDateUnavailable?: (date: Temporal.PlainDate, anchor: Temporal.PlainDate | null) => boolean;
  };

/** A range prop's two ends, each present. */
type PresentEnds = { readonly start: TemporalValue; readonly end: TemporalValue };

/**
 * A range prop's ends, the same object, once both are present. Only an absent range selects
 * nothing: a range missing an end reaches the prop past its types, from plain JavaScript, so it
 * throws on every render rather than clearing the selection.
 *
 * @param ends - The ends `useRangeProp` read.
 * @param prop - The prop, named in the error with the end.
 * @returns The ends, or `null` without a range.
 * @throws TypeError naming the Root, the prop and the end when an end is `null` or missing.
 */
function presentEnds(ends: RangePropEnds | null, prop: string): PresentEnds | null {
  if (ends === null || bothEnds(ends)) {
    return ends;
  }
  const missing = ends.start === null ? "start" : "end";
  throw new TypeError(
    `RangeCalendar.Root ${prop}.${missing}: received no day, but a range takes both ends as Temporal.PlainDates. Pass null for no range.`
  );
}

function bothEnds(ends: RangePropEnds): ends is PresentEnds {
  return ends.start !== null && ends.end !== null;
}

/** The range a range prop's ends name, earlier day first, or `null` without one. */
function dayRange(ends: PresentEnds | null): DayRange | null {
  return ends === null ? null : orderedRange(boundDay(ends.start), boundDay(ends.end));
}

function sameRange(a: DayRange | null, b: DayRange | null): boolean {
  return a === b || (a !== null && b !== null && a.start.equals(b.start) && a.end.equals(b.end));
}

/**
 * A calendar that selects a range of days, on the same parts as Calendar. It is a `group`. A host
 * without native Temporal imports `@elmeragroup/fuse/temporal-polyfill` once. Today is marked from
 * the first client effect on; a server render marks no today. The Root's first element child is
 * a hidden prompt the days' `aria-describedby` points at.
 *
 * @throws TypeError naming the prop and the fix when a range end, `minValue` or `maxValue` is a
 *   string rather than a Temporal object, or a range lacks an end, a host defect.
 */
export function RangeCalendarRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  commitBehavior = "select",
  visibleMonths: visibleMonthsProp = 1,
  pageBehavior = "visible",
  minValue,
  maxValue,
  isDateUnavailable,
  disabled = false,
  readOnly = false,
  firstDayOfWeek,
  onVisibleRangeChange,
  className,
  render,
  children,
  ref: refProp,
  ...props
}: RangeCalendarRootProps): ReactElement {
  const { locale, timeZone } = useLocale();
  const strings = useLocalizedStrings(rangeCalendarStrings);
  const controlled = valueProp !== undefined;
  const valueEnds = presentEnds(useRangeProp(valueProp, "RangeCalendar.Root", "value"), "value");
  const value = useMemo(() => dayRange(valueEnds), [valueEnds]);
  // The default range seeds the selection once, below; reading it on every render refuses a
  // string or missing end whether the calendar is controlled or the default changed.
  const defaultEnds = presentEnds(
    useRangeProp(defaultValue, "RangeCalendar.Root", "defaultValue"),
    "defaultValue"
  );

  const bounds = useCalendarBounds(minValue, maxValue, "RangeCalendar.Root");
  const visibleMonths = useVisibleMonthCount(visibleMonthsProp, "RangeCalendar.Root");
  const rules = useMemo(
    (): RangeRules => ({ bounds, isDateUnavailable, visibleMonths }),
    [bounds, isDateUnavailable, visibleMonths]
  );

  const [store] = useState(() => {
    const initial = controlled ? value : dayRange(defaultEnds);
    const shared = initialSharedState(initial?.start ?? null, { bounds, visibleMonths });
    const { focused } = shared;
    let { visible } = shared;
    // A range too long for the centred view opens on its first month, as React Aria aligns it.
    if (initial !== null && focused !== null && visible !== null && !showsDay(visible, initial.end)) {
      visible = startAlignedMonths(focused, visibleMonths, bounds);
    }
    return createCalendarStore<RangeCalendarState>({ ...shared, visible, value: initial, anchor: null });
  });

  // While a range is being chosen the anchor narrows the selectable days, so the Root re-renders
  // when the anchor changes, and only then: a hover moves focus without touching it.
  const anchorIso = useCalendarSelector(store, (state) => state.anchor?.toString() ?? null);
  const anchor = useMemo(
    () => (anchorIso === null ? null : temporal().PlainDate.from(anchorIso)),
    [anchorIso]
  );
  // Each keeps its identity across an anchor change that alters nothing, as without
  // `isDateUnavailable`, so the settings and the parts' context stay as they were.
  const activeBounds = useMemo(
    () => (anchor === null ? bounds : anchoredBounds(rules, anchor)),
    [bounds, rules, anchor]
  );
  const activeUnavailable = useMemo(() => unavailableFor(rules, anchor), [rules, anchor]);
  const settings = useCalendarSettings({
    locale,
    bounds: activeBounds,
    isDateUnavailable: activeUnavailable,
    disabled,
    readOnly,
    firstDayOfWeek,
    visibleMonths,
    pageBehavior,
    ariaLabel: props["aria-label"],
    ariaLabelledBy: props["aria-labelledby"],
  });

  // A controlled value reaches the store before paint without moving focus or the view.
  useLayoutEffect(() => {
    const state = store.get();
    if (controlled && !sameRange(state.value, value)) {
      store.set({ ...state, value });
    }
  }, [store, controlled, value]);

  const rootRef = useRef<HTMLDivElement>(null);
  // The Root's element as state, so the outside-press listeners move with it when `render`
  // swaps the element.
  const [rootNode, setRootNode] = useState<HTMLDivElement | null>(null);
  const { actions, showDay } = useCalendarNavigation(
    store,
    settings,
    timeZone,
    onVisibleRangeChange,
    rootRef
  );

  const descriptionId = useId();
  const { model, commit, invalid } = useRangeSelection(store, {
    settings,
    rules,
    locale,
    strings,
    descriptionId,
    showDay,
    onValueChange,
    controlled,
    commitBehavior,
  });

  const selection = useMemo(() => createSelectionOwner(store, model), [store, model]);

  // A press outside the days and month buttons completes or drops an open range, as React Aria's
  // window `pointerup` listener does, so a touch that scrolls the page settles nothing.
  // `useOutsidePress` tells the Root's own presses apart across shadow roots, and listens only
  // while a range is open.
  const settleOutside = useCallback(
    (event: Event, trigger: Element | undefined) => commit("outside-press", event, trigger),
    [commit]
  );
  useOutsidePress(anchor === null ? null : rootNode, settleOutside);

  const context = useMemo(
    (): CalendarRootContextValue => ({ store, settings, actions, selection }),
    [store, settings, actions, selection]
  );
  const state = useMemo(
    (): RangeCalendarRootState => ({ disabled, readonly: readOnly, invalid, selecting: anchor !== null }),
    [disabled, readOnly, invalid, anchor]
  );

  const element = useRender({
    defaultTagName: "div",
    render,
    ref: refProp === undefined ? [rootRef, setRootNode] : [rootRef, setRootNode, refProp],
    state,
    props: {
      "data-slot": "range-calendar",
      ...mergeProps<"div">(
        {
          role: "group",
          className: cn(styles.root(), className),
          // The prompt the tab-stop day points `aria-describedby` at sits inside the Root, before
          // its children, so the Root stays one node in its parent's layout and the consumer's
          // last child stays the Root's last, as `space-y-*` and `divide-y` count it.
          children: (
            <>
              <span id={descriptionId} hidden>
                {strings.format(anchor === null ? "startRangeSelectionPrompt" : "finishRangeSelectionPrompt")}
              </span>
              {children}
            </>
          ),
          onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
            // Escape on a day drops a range being chosen and goes no further, so an enclosing
            // popup stays open; with no range open it passes through.
            if (
              event.key === "Escape" &&
              isElement(event.target) &&
              event.target.closest("[data-slot=calendar-day-button]") !== null &&
              store.get().anchor !== null
            ) {
              event.stopPropagation();
              store.set({ ...store.get(), anchor: null });
            }
          },
          onBlur(event: FocusEvent<HTMLDivElement>) {
            // Focus moving to another element outside the calendar settles an open range. A blur
            // with no next element (the window losing focus, a press on something that takes no
            // focus, or a day removed by a month remount) leaves it open; a press outside settles
            // it on pointer up.
            const next = event.relatedTarget;
            if (next !== null && !event.currentTarget.contains(next)) {
              commit("focus-out", event.nativeEvent, event.target);
            }
          },
        },
        props
      ),
    },
  });
  return <CalendarRootContext value={context}>{element}</CalendarRootContext>;
}
