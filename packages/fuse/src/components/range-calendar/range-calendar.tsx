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
import { CalendarRootContext, createSelectionOwner } from "../calendar/calendar-context";
import type { CalendarRootContextValue } from "../calendar/calendar-context";
import { showsDay, startAlignedMonths } from "../calendar/calendar-dates";
import {
  parseCalendarDay,
  useCalendarBounds,
  useCalendarSettings,
  useVisibleMonthCount,
} from "../calendar/calendar-input";
import type { CalendarViewProps } from "../calendar/calendar-input";
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
 * A range as the Root takes it: each end a `Temporal.PlainDate` from any implementation or its
 * ISO text (`"2026-10-12"`), the form a server component passes across the boundary. An end that
 * is a date-time or zoned value selects its own wall-clock day.
 */
export type RangeCalendarValueInput = {
  /** The first day. */
  readonly start: Temporal.PlainDate | string;
  /** The last day. A range given in reverse shows earlier day first. */
  readonly end: Temporal.PlainDate | string;
};

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

/** `RangeCalendar.Root` takes a `div`'s props, Base UI's `render` and the calendar's own. */
export type RangeCalendarRootProps = Omit<
  useRender.ComponentProps<"div", RangeCalendarRootState>,
  "defaultValue" | "onChange"
> &
  CalendarViewProps & {
    /** The selected range, when the parent owns it. `null` selects nothing. */
    value?: RangeCalendarValueInput | null;
    /** The range selected first, when the calendar owns its value. Takes what `value` takes. */
    defaultValue?: RangeCalendarValueInput | null;
    /**
     * Called when the user completes a range, with this runtime's `Temporal.PlainDate`s, earlier
     * day first. The first day pressed only anchors the range and calls nothing. `details.reason`
     * is `"day-press"`, `"keyboard"`, `"outside-press"` or `"focus-out"`. Canceling a day press or
     * key with `details.cancel()` keeps the value and the anchor, so the user can pick another end;
     * canceling an outside press or focus-out keeps the value and drops the anchor.
     * `details.getValidationError()` returns `null` for a range the calendar accepts, and
     * otherwise `"rangeUnderflow"` for a start before `minValue`, `"rangeOverflow"` for an end
     * after `maxValue` and `"unavailable"` for an end `isDateUnavailable` refuses with no anchor.
     */
    onValueChange?: (value: RangeCalendarValue, details: RangeCalendarRootValueChangeEventDetails) => void;
    /**
     * What an open range does when focus leaves the calendar or the user presses outside its days
     * and month buttons: `"select"` completes it at the focused or hovered day, `"reset"` drops the
     * anchor and keeps the previous range.
     * @default "select"
     */
    commitBehavior?: RangeCalendarCommitBehavior;
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

/** The range a range prop names, earlier day first, or `null` without one. */
function parseRange(input: RangeCalendarValueInput | null | undefined, prop: string): DayRange | null {
  if (input == null) {
    return null;
  }
  return orderedRange(
    parseCalendarDay(input.start, "RangeCalendar.Root", `${prop}.start`),
    parseCalendarDay(input.end, "RangeCalendar.Root", `${prop}.end`)
  );
}

/** The text a range prop prints, the key its parse is memoized by. */
function rangeKey(input: RangeCalendarValueInput | null | undefined): string | null | undefined {
  return input == null ? input : `${String(input.start)}/${String(input.end)}`;
}

function sameRange(a: DayRange | null, b: DayRange | null): boolean {
  return a === b || (a !== null && b !== null && a.start.equals(b.start) && a.end.equals(b.end));
}

/**
 * A calendar that selects a range of days, on the same parts as Calendar: the months, their day
 * grids and the buttons that page them. The first day pressed (or chosen with Enter or Space)
 * anchors the range; the range then follows the focused or hovered day across every visible month
 * until a second day completes it, earlier day first. Enter or Space moves focus on a day after
 * anchoring, so a keyboard user sees a range start. Escape drops the anchor. Focus leaving the
 * calendar, or a press outside its days and month buttons, completes or drops an open range by
 * `commitBehavior`. It is a `group` named by `aria-label` or `aria-labelledby`; values are
 * `Temporal.PlainDate`s, and a host without native Temporal imports
 * `@elmeragroup/fuse/temporal-polyfill` once.
 *
 * Today is marked from the first client effect on; a server render marks no today. A calendar
 * with neither `value` nor `defaultValue` opens on today's month from that effect on.
 *
 * The Root's first element child is a hidden prompt the days' `aria-describedby` points at, so the
 * consumer's first part is not its `:first-child`.
 *
 * @throws TypeError naming the prop when a range end, `minValue` or `maxValue` is text that is not
 *   an ISO date, a host defect.
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
  const valueKey = rangeKey(valueProp);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed by the printed value
  const value = useMemo(() => parseRange(valueProp, "value"), [valueKey]);
  const bounds = useCalendarBounds(minValue, maxValue, "RangeCalendar.Root");
  const visibleMonths = useVisibleMonthCount(visibleMonthsProp, "RangeCalendar.Root");
  const rules = useMemo(
    (): RangeRules => ({ bounds, isDateUnavailable, visibleMonths }),
    [bounds, isDateUnavailable, visibleMonths]
  );

  const [store] = useState(() => {
    const initial = controlled ? value : parseRange(defaultValue, "defaultValue");
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
