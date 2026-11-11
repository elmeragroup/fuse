"use client";

// The parts every calendar Root shares: the header, the month buttons, the visible-range heading,
// the months and each month's day grid. They read only `calendar-context.ts`, so Calendar and
// RangeCalendar render the same parts over their own selection models.
//
// Anatomy, data attributes and test scenarios are ported from Base UI's unreleased Calendar
// (mui/base-ui at ec04355f, `packages/react/src/calendar`, MIT License, Copyright (c) 2019 Material-UI
// SAS). Fuse keeps neither its store nor its Composite keyboard: state lives in a per-Root external
// store read through per-day selectors, and the keyboard is date arithmetic over a date-keyed roving
// tab stop (`calendar-dates.ts`). The snapshot's defects are fixed here: `aria-selected` sits on the
// gridcell, the Root has a role, the arrows follow the writing direction, weekday labels come from
// `Intl` rather than a first letter, today rolls over at midnight, and a focus request survives a
// month remount (the design of Base UI #4462).

import { useId, useLayoutEffect, useMemo, useRef } from "react";
import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { monthWeeks } from "../../temporal/month-grid";
import { referenceDay } from "../../temporal/reference-day";
import { Button } from "../button/button";
import type { IconButtonProps, IconButtonSize } from "../button/button";
import {
  CalendarDayContext,
  CalendarMonthContext,
  DAY_FLAG_STATE_ATTRIBUTES,
  dayFlagState,
  NO_DAY_FLAGS,
  useCalendarDayContext,
  useCalendarMonthContext,
  useCalendarRootContext,
} from "./calendar-context";
import type {
  CalendarDayContextValue,
  CalendarDayFlagState,
  CalendarMonthContextValue,
} from "./calendar-context";
import { canPage, dayStatus, focusMoveForKey, lastVisibleMonth } from "./calendar-dates";
import {
  formatDayName,
  formatDayNumber,
  formatMonth,
  formatMonthRange,
  formatWeekday,
  formatWeekdayName,
} from "./calendar-format";
import { useCalendarSelector, useCalendarStateField } from "./calendar-store";
import { calendarVariants } from "./calendar-variants";
import { calendarStrings } from "./intl";

const styles = calendarVariants();

/** `Calendar.Header` takes a `div`'s props plus Base UI's `render`. */
export type CalendarHeaderProps = useRender.ComponentProps<"div">;

/**
 * The row above the months: the month buttons around the visible-range heading. It is layout
 * only; put the parts in it in the order they should read.
 */
export function CalendarHeader({ className, render, ...props }: CalendarHeaderProps): ReactElement {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "calendar-header",
      ...mergeProps<"div">({ className: cn(styles.header(), className) }, props),
    },
  });
}

/** The props of a month button: Button's, named and sized for an icon. */
type CalendarMonthButtonProps = Omit<IconButtonProps, "aria-label" | "size" | "children"> & {
  /** The accessible name. Defaults to the locale dictionary: "Previous" or "Next" in en-US. */
  "aria-label"?: string;
  /** Button's square size. Defaults to `"icon"`. */
  size?: IconButtonSize;
  /** The icon. Defaults to a caret that points along the writing direction. */
  children?: ReactNode;
};

/**
 * `Calendar.DecrementMonth` takes Button's props, named and sized for an icon. Its `onClick` runs
 * before the page changes, and `event.preventBaseUIHandler()` there stops the change.
 */
export type CalendarDecrementMonthProps = CalendarMonthButtonProps;

/**
 * `Calendar.IncrementMonth` takes Button's props, named and sized for an icon. Its `onClick` runs
 * before the page changes, and `event.preventBaseUIHandler()` there stops the change.
 */
export type CalendarIncrementMonthProps = CalendarMonthButtonProps;

/** The Button props a month button merges with the consumer's. */
type MergedButton = (props: Omit<IconButtonProps, "size" | "aria-label" | "children">) => ReactElement;

const MONTH_BUTTONS = {
  decrement: { slot: "calendar-decrement-month", step: -1, labelKey: "previous", Icon: CaretLeft },
  increment: { slot: "calendar-increment-month", step: 1, labelKey: "next", Icon: CaretRight },
} as const;

function CalendarMonthButton({
  direction,
  className,
  size = "icon",
  "aria-label": ariaLabel,
  children,
  ...props
}: CalendarMonthButtonProps & { direction: keyof typeof MONTH_BUTTONS }): ReactElement {
  const button = MONTH_BUTTONS[direction];
  const { store, settings, actions } = useCalendarRootContext(
    direction === "decrement" ? "Calendar.DecrementMonth" : "Calendar.IncrementMonth"
  );
  const strings = useLocalizedStrings(calendarStrings);
  const { bounds, disabled: calendarDisabled } = settings;
  const pageable = useCalendarSelector(store, (state) =>
    state.visible === null ? false : canPage(state.visible, button.step, bounds)
  );
  const { Icon } = button;

  return (
    <Button
      data-slot={button.slot}
      // The consumer's props merge after the defaults, so its `onClick` runs first and
      // `event.preventBaseUIHandler()` there cancels the page change.
      {...mergeProps<MergedButton>(
        {
          variant: "ghost",
          // Disabled at the bounds and still focusable there, so the focus that paged to the
          // last page stays on the button instead of falling back to the document.
          disabled: calendarDisabled || !pageable,
          focusableWhenDisabled: true,
          onClick: (event: MouseEvent<HTMLButtonElement>) =>
            actions.page(button.step, event.nativeEvent, event.currentTarget),
        },
        definedProps(props)
      )}
      size={size}
      aria-label={ariaLabel ?? strings.format(button.labelKey)}
      className={cn(styles.nav(), className)}>
      {children ?? <Icon aria-hidden="true" className="rtl:-scale-x-100" />}
    </Button>
  );
}

/** Pages back: the visible months move back one page, and focus moves with them. */
export function CalendarDecrementMonth(props: CalendarDecrementMonthProps): ReactElement {
  return <CalendarMonthButton direction="decrement" {...props} />;
}

/** Pages forward: the visible months move on one page, and focus moves with them. */
export function CalendarIncrementMonth(props: CalendarIncrementMonthProps): ReactElement {
  return <CalendarMonthButton direction="increment" {...props} />;
}

/** `Calendar.VisibleRangeHeading` takes an `h2`'s props plus Base UI's `render`. */
export type CalendarVisibleRangeHeadingProps = useRender.ComponentProps<"h2">;

/**
 * The visible months as one heading, such as "October 2026" or "October – December 2026", and
 * the calendar's one live region: a month button's page is announced politely. It stays quiet
 * until the user first pages, so the months a calendar opens or hydrates on are not announced,
 * and while keyboard focus is on a day, since the newly focused day and its grid name say the
 * same. Render one per calendar.
 */
export function CalendarVisibleRangeHeading({
  className,
  render,
  ...props
}: CalendarVisibleRangeHeadingProps): ReactElement {
  const { store, settings } = useCalendarRootContext("Calendar.VisibleRangeHeading");
  const { locale } = settings;
  const visible = useCalendarStateField(store, "visible");
  const text = useMemo(
    () => (visible === null ? "" : formatMonthRange(locale, visible.start, lastVisibleMonth(visible))),
    [locale, visible]
  );
  const quiet = useCalendarSelector(store, (state) => !state.paged || state.gridFocused);
  return useRender({
    defaultTagName: "h2",
    render,
    props: {
      "data-slot": "calendar-visible-range-heading",
      ...mergeProps<"h2">(
        {
          "aria-live": quiet ? "off" : "polite",
          "aria-atomic": true,
          className: cn(styles.visibleRangeHeading(), className),
          children: text,
        },
        props
      ),
    },
  });
}

/** `Calendar.Months` takes a `div`'s props, Base UI's `render` and a function of each month. */
export type CalendarMonthsProps = Omit<useRender.ComponentProps<"div">, "children"> & {
  /**
   * Renders one visible month, normally a `Calendar.Month` keyed by `month.toString()`. Called
   * for each month from the first, `visibleMonths` times. Defaults to a `Calendar.Month` with
   * its `MonthHeading`, visually hidden in a one-month view, and a `DayGrid` with the weekday row
   * and the weeks, which is also how a server component renders the months, since a function
   * cannot cross to the client.
   */
  children?: (month: Temporal.PlainYearMonth, index: number) => ReactNode;
};

/** The default month: heading, weekday row and weeks. */
function DefaultMonth({ month, single }: { month: Temporal.PlainYearMonth; single: boolean }): ReactElement {
  return (
    <CalendarMonth value={month}>
      <CalendarMonthHeading className={single ? "sr-only" : undefined} />
      <CalendarDayGrid>
        <CalendarDayGridHeader />
        <CalendarDayGridBody />
      </CalendarDayGrid>
    </CalendarMonth>
  );
}

/** The most weeks a month spans, which a placeholder grid reserves. */
const PLACEHOLDER_WEEKS = 6;

/**
 * A month the calendar cannot name yet: one with neither a value nor a default value shows today's
 * months, and only the client's first effect reads the clock, never a render, so the server and the
 * hydrating render write this instead. It is the default month's frame, the weekday row over six
 * weeks of empty days, hidden from assistive technology. Six weeks are the most a month spans, so
 * the popup or page never grows when today's months replace it, and shrinks by a row or two for a
 * month of four or five weeks; hydration matches either way. Its weekday row is the real
 * `DayGridHeader` over the reference day's month: any month names the same weekdays.
 */
function PlaceholderMonth({ single }: { readonly single: boolean }): ReactElement {
  const month = useMemo(() => referenceDay().toPlainYearMonth(), []);
  return (
    <CalendarMonth value={month} aria-hidden>
      {/* A one-month view's heading is visually hidden; a multi-month one keeps its line. */}
      {single ? null : (
        <div data-slot="calendar-month-heading" className={styles.monthHeading()}>
          {"\u00a0"}
        </div>
      )}
      <table data-slot="calendar-day-grid" role="presentation" className={styles.dayGrid()}>
        <CalendarDayGridHeader />
        <tbody data-slot="calendar-day-grid-body" className={styles.dayGridBody()}>
          {Array.from({ length: PLACEHOLDER_WEEKS }, (_, row) => (
            <tr key={row} data-slot="calendar-day-grid-row" className={styles.dayGridRow()}>
              {Array.from({ length: 7 }, (_, column) => (
                <td key={column} data-slot="calendar-day-grid-cell" className={styles.dayGridCell()}>
                  {/* An empty day keeps the day's size, invisible as a neighbouring month's day. */}
                  <span data-slot="calendar-day-button" data-outside-month="" className={styles.day()} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </CalendarMonth>
  );
}

/**
 * The visible months in a row that wraps, so a narrow host stacks them. A calendar with neither
 * a value nor a default value writes placeholder months on the server and in the hydrating render,
 * the default month's frame with six weeks of empty days, until its first effect has read today
 * and shows today's months; `children` renders the months from then on.
 */
export function CalendarMonths({ className, render, children, ...props }: CalendarMonthsProps): ReactElement {
  const { store, settings } = useCalendarRootContext("Calendar.Months");
  const visible = useCalendarStateField(store, "visible");
  const months = useMemo(
    () =>
      visible === null
        ? []
        : Array.from({ length: visible.count }, (_, index) => visible.start.add({ months: index })),
    [visible]
  );
  const renderMonth =
    children ??
    ((month: Temporal.PlainYearMonth) => (
      <DefaultMonth key={month.toString()} month={month} single={months.length === 1} />
    ));
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "calendar-months",
      ...mergeProps<"div">(
        {
          className: cn(styles.months(), className),
          children:
            visible === null
              ? Array.from({ length: settings.visibleMonths }, (_, index) => (
                  <PlaceholderMonth key={index} single={settings.visibleMonths === 1} />
                ))
              : months.map((month, index) => renderMonth(month, index)),
        },
        props
      ),
    },
  });
}

/** `Calendar.Month` takes a `div`'s props, Base UI's `render` and the month it shows. */
export type CalendarMonthProps = useRender.ComponentProps<"div"> & {
  /** The month, as `Calendar.Months` passes it. */
  value: Temporal.PlainYearMonth;
};

/** One visible month: its heading and day grid. */
export function CalendarMonth({
  value,
  className,
  render,
  children,
  ...props
}: CalendarMonthProps): ReactElement {
  // The one id the month's name carries and its grid points at. `MonthHeading` writes it on its
  // own label span, never on the heading element, so a consumer's id on the heading, passed
  // directly or on its `render` element, cannot move it, and the server writes both ends alike.
  const headingId = useId();
  const context = useMemo((): CalendarMonthContextValue => ({ month: value, headingId }), [value, headingId]);
  const element = useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "calendar-month",
      ...mergeProps<"div">({ className: cn(styles.month(), className), children }, props),
    },
  });
  return <CalendarMonthContext value={context}>{element}</CalendarMonthContext>;
}

/** `Calendar.MonthHeading` takes a `div`'s props plus Base UI's `render`. */
export type CalendarMonthHeadingProps = useRender.ComponentProps<"div">;

/**
 * The month's name, such as "October 2026", which names its grid. A one-month calendar shows the
 * same words in `VisibleRangeHeading`, so hide this one visually there with `className="sr-only"`
 * rather than leaving it out. The name sits in a span whose id the `Month` owns and the grid
 * points at, so an `id` on the heading, passed directly or on its `render` element, stays the
 * heading's own and the grid keeps its name. Children replace the name inside that span.
 */
export function CalendarMonthHeading({
  className,
  render,
  children,
  ...props
}: CalendarMonthHeadingProps): ReactElement {
  const { settings } = useCalendarRootContext("Calendar.MonthHeading");
  const { month, headingId } = useCalendarMonthContext("Calendar.MonthHeading");
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "calendar-month-heading",
      ...mergeProps<"div">(
        {
          className: cn(styles.monthHeading(), className),
          children: <span id={headingId}>{children ?? formatMonth(settings.locale, month)}</span>,
        },
        props
      ),
    },
  });
}

/** `Calendar.DayGrid` takes a `table`'s props plus Base UI's `render`. */
export type CalendarDayGridProps = useRender.ComponentProps<"table">;

/**
 * One month's days, a `grid`. Its name is the calendar's own name and the month, "Delivery,
 * October 2026" for a Root named "Delivery", as React Aria names its grids; a Root named by
 * `aria-labelledby` names the grid by that element and the `MonthHeading`.
 */
export function CalendarDayGrid({ className, render, ...props }: CalendarDayGridProps): ReactElement {
  const { settings, actions, selection } = useCalendarRootContext("Calendar.DayGrid");
  const { month, headingId } = useCalendarMonthContext("Calendar.DayGrid");
  const own: ComponentProps<"table"> = {
    onBlur(event) {
      actions.blurTo(event.target, event.relatedTarget);
    },
  };
  if (settings.ariaLabel === undefined) {
    own["aria-labelledby"] = [settings.ariaLabelledBy, headingId].filter(Boolean).join(" ");
  } else {
    own["aria-label"] = `${settings.ariaLabel}, ${formatMonth(settings.locale, month)}`;
  }
  if (settings.disabled) {
    own["aria-disabled"] = true;
  }
  if (settings.readOnly) {
    own["aria-readonly"] = true;
  }
  if (selection.multiselectable) {
    own["aria-multiselectable"] = true;
  }
  return useRender({
    defaultTagName: "table",
    render,
    props: {
      "data-slot": "calendar-day-grid",
      ...mergeProps<"table">({ role: "grid", ...own, className: cn(styles.dayGrid(), className) }, props),
    },
  });
}

/** `Calendar.DayGridHeader` takes a `thead`'s props plus Base UI's `render`. */
export type CalendarDayGridHeaderProps = useRender.ComponentProps<"thead">;

/**
 * The weekday names above the days. Hidden from assistive technology, since every day's name
 * already says its weekday.
 */
export function CalendarDayGridHeader({
  className,
  render,
  children,
  ...props
}: CalendarDayGridHeaderProps): ReactElement {
  return useRender({
    defaultTagName: "thead",
    render,
    props: {
      "data-slot": "calendar-day-grid-header",
      ...mergeProps<"thead">(
        {
          "aria-hidden": true,
          className: cn(styles.dayGridHeader(), className),
          children: children ?? <CalendarDayGridHeaderRow />,
        },
        props
      ),
    },
  });
}

/** `Calendar.DayGridHeaderRow` takes a `tr`'s props, Base UI's `render` and a function of each weekday. */
export type CalendarDayGridHeaderRowProps = Omit<useRender.ComponentProps<"tr">, "children"> & {
  /**
   * Renders one weekday's header cell from a day on it. Defaults to `Calendar.DayGridHeaderCell`.
   */
  children?: (day: Temporal.PlainDate, index: number) => ReactNode;
};

/** The weekday names in the locale's week order, from `firstDayOfWeek`. */
export function CalendarDayGridHeaderRow({
  className,
  render,
  children,
  ...props
}: CalendarDayGridHeaderRowProps): ReactElement {
  const { settings } = useCalendarRootContext("Calendar.DayGridHeaderRow");
  const { month } = useCalendarMonthContext("Calendar.DayGridHeaderRow");
  const days = useMemo(() => monthWeeks(month, settings.firstDay)[0] ?? [], [month, settings.firstDay]);
  const renderDay =
    children ?? ((day: Temporal.PlainDate) => <CalendarDayGridHeaderCell key={day.dayOfWeek} value={day} />);
  return useRender({
    defaultTagName: "tr",
    render,
    props: {
      "data-slot": "calendar-day-grid-header-row",
      ...mergeProps<"tr">(
        {
          className: cn(styles.dayGridHeaderRow(), className),
          children: days.map((day, index) => renderDay(day, index)),
        },
        props
      ),
    },
  });
}

/** `Calendar.DayGridHeaderCell` takes a `th`'s props, Base UI's `render` and a day on its weekday. */
export type CalendarDayGridHeaderCellProps = useRender.ComponentProps<"th"> & {
  /** A day on the weekday the cell names. */
  value: Temporal.PlainDate;
};

/**
 * A weekday's column label: the locale's short name where it fits a column ("Mon"), its narrow
 * form otherwise. Children replace the label.
 */
export function CalendarDayGridHeaderCell({
  value,
  className,
  render,
  children,
  ...props
}: CalendarDayGridHeaderCellProps): ReactElement {
  const { settings } = useCalendarRootContext("Calendar.DayGridHeaderCell");
  return useRender({
    defaultTagName: "th",
    render,
    props: {
      "data-slot": "calendar-day-grid-header-cell",
      ...mergeProps<"th">(
        {
          scope: "col",
          abbr: formatWeekdayName(settings.locale, value),
          className: cn(styles.dayGridHeaderCell(), className),
          children: children ?? formatWeekday(settings.locale, value),
        },
        props
      ),
    },
  });
}

/** `Calendar.DayGridBody` takes a `tbody`'s props, Base UI's `render` and a function of each week. */
export type CalendarDayGridBodyProps = Omit<useRender.ComponentProps<"tbody">, "children"> & {
  /**
   * Renders one week from its first day, normally a `Calendar.DayGridRow` keyed by
   * `week.toString()`. Defaults to that row with its default cells.
   */
  children?: (week: Temporal.PlainDate, index: number) => ReactNode;
};

/** The month's weeks, four to six of them, each starting on `firstDayOfWeek`. */
export function CalendarDayGridBody({
  className,
  render,
  children,
  ...props
}: CalendarDayGridBodyProps): ReactElement {
  const { settings } = useCalendarRootContext("Calendar.DayGridBody");
  const { month } = useCalendarMonthContext("Calendar.DayGridBody");
  const weeks = useMemo(
    () => monthWeeks(month, settings.firstDay).flatMap((week) => week.slice(0, 1)),
    [month, settings.firstDay]
  );
  const renderWeek =
    children ?? ((week: Temporal.PlainDate) => <CalendarDayGridRow key={week.toString()} value={week} />);
  return useRender({
    defaultTagName: "tbody",
    render,
    props: {
      "data-slot": "calendar-day-grid-body",
      ...mergeProps<"tbody">(
        {
          className: cn(styles.dayGridBody(), className),
          children: weeks.map((week, index) => renderWeek(week, index)),
        },
        props
      ),
    },
  });
}

/** `Calendar.DayGridRow` takes a `tr`'s props, Base UI's `render`, its week and a function of each day. */
export type CalendarDayGridRowProps = Omit<useRender.ComponentProps<"tr">, "children"> & {
  /** The week's first day, as `Calendar.DayGridBody` passes it. */
  value: Temporal.PlainDate;
  /**
   * Renders one day, normally a `Calendar.DayGridCell` keyed by `day.toString()` around a
   * `Calendar.DayButton`. Defaults to exactly that.
   */
  children?: (day: Temporal.PlainDate, index: number) => ReactNode;
};

/** One week's seven days. */
export function CalendarDayGridRow({
  value,
  className,
  render,
  children,
  ...props
}: CalendarDayGridRowProps): ReactElement {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => value.add({ days: index })), [value]);
  const renderDay =
    children ??
    ((day: Temporal.PlainDate) => (
      <CalendarDayGridCell key={day.toString()} value={day}>
        <CalendarDayButton />
      </CalendarDayGridCell>
    ));
  return useRender({
    defaultTagName: "tr",
    render,
    props: {
      "data-slot": "calendar-day-grid-row",
      ...mergeProps<"tr">(
        {
          className: cn(styles.dayGridRow(), className),
          children: days.map((day, index) => renderDay(day, index)),
        },
        props
      ),
    },
  });
}

/** `Calendar.DayGridCell` takes a `td`'s props, Base UI's `render`, which receives the day's flags, and its day. */
export type CalendarDayGridCellProps = useRender.ComponentProps<"td", CalendarDayFlagState> & {
  /** The day, as `Calendar.DayGridRow` passes it. */
  value: Temporal.PlainDate;
};

/**
 * One day's `gridcell`. It carries `aria-selected` when the selection owner's flags for the day hold
 * `selected`, and `aria-disabled` for a day the user cannot select. Each flag that holds is also a
 * bare attribute, so a range's band can be painted across cells: `data-selected`,
 * `data-selection-start`, `data-selection-end`, `data-in-range`, `data-highlighted` and
 * `data-invalid`. A disabled day holds no flags. It works out the day's standing and flags once and
 * shares them with its `DayButton`.
 */
export function CalendarDayGridCell({
  value,
  className,
  render,
  children,
  ...props
}: CalendarDayGridCellProps): ReactElement {
  const { settings, selection } = useCalendarRootContext("Calendar.DayGridCell");
  const { month } = useCalendarMonthContext("Calendar.DayGridCell");
  const iso = value.toString();
  const outsideMonth = value.month !== month.month || value.year !== month.year;
  const { disabled, unavailable } = dayStatus(value, outsideMonth, settings);
  const ownerFlags = selection.useDayFlags(value, iso);
  const flags = useMemo(() => dayFlagState(disabled ? NO_DAY_FLAGS : ownerFlags), [disabled, ownerFlags]);
  const context = useMemo(
    (): CalendarDayContextValue => ({ date: value, iso, outsideMonth, disabled, unavailable, flags }),
    [value, iso, outsideMonth, disabled, unavailable, flags]
  );
  // The flags also reach the cell, each as a bare `data-<flag>` through the button's mapping, so a
  // range's band can be painted across cells.
  const own: ComponentProps<"td"> = { role: "gridcell", children };
  if (flags.selected) {
    own["aria-selected"] = true;
  }
  if (disabled || unavailable) {
    own["aria-disabled"] = true;
  }
  const element = useRender({
    defaultTagName: "td",
    render,
    state: flags,
    stateAttributesMapping: DAY_FLAG_STATE_ATTRIBUTES,
    props: {
      "data-slot": "calendar-day-grid-cell",
      ...mergeProps<"td">({ ...own, className: cn(styles.dayGridCell(), className) }, props),
    },
  });
  return <CalendarDayContext value={context}>{element}</CalendarDayContext>;
}

/**
 * The state a day button shares with its `render` callback and writes as data attributes, each
 * that holds as a bare attribute: the selection owner's flags as `data-selected`,
 * `data-selection-start`, `data-selection-end`, `data-in-range`, `data-highlighted` and
 * `data-invalid`, then `data-disabled`, `data-unavailable`, `data-current` and
 * `data-outside-month`. A disabled day holds no flags.
 */
export type CalendarDayButtonState = CalendarDayFlagState & {
  /** Whether the day cannot take focus: out of bounds, in a neighbouring month, or the calendar is disabled. */
  readonly disabled: boolean;
  /** Whether `isDateUnavailable` refuses the day: focusable, never selectable. */
  readonly unavailable: boolean;
  /** Whether the day is today. Always `false` in a server render. */
  readonly current: boolean;
  /** Whether the day belongs to a neighbouring month. Such a day is invisible and inert. */
  readonly outsideMonth: boolean;
};

/** `Calendar.DayButton` takes a `button`'s props plus Base UI's `render`, which receives the day's state. */
export type CalendarDayButtonProps = useRender.ComponentProps<"button", CalendarDayButtonState>;

// The flags write `data-<flag>` through the shared mapping; of the rest, the single-word fields
// take Base UI's default, a bare `data-<field>`, and `outsideMonth` names its own.
const DAY_STATE_ATTRIBUTES = {
  ...DAY_FLAG_STATE_ATTRIBUTES,
  outsideMonth: (value: boolean) => (value ? { "data-outside-month": "" } : null),
} satisfies Partial<Record<keyof CalendarDayButtonState, (value: boolean) => Record<string, string> | null>>;

/**
 * One day's button. Its name is the full date as React Aria writes it, "Monday, October 12, 2026",
 * with "Today, " before it on today, " selected" after it on the selected day, and ", First
 * available date" or ", Last available date" on the bounds. Children replace the day number.
 *
 * Keyboard: Arrow Left and Right step a day in the writing direction, Arrow Up and Down a week,
 * Home and End go to the month's first and last day, Page Up and Page Down a month, with Shift a
 * year. Focus stays inside the bounds and moves between visible months without paging; past them
 * the view pages. Enter and Space select, once however long they are held. Any other modifier, and
 * Shift with any other key, is left to the browser.
 *
 * Only a day the user may select is selected: one that is not disabled, not unavailable, in a
 * calendar that is not read-only.
 */
export function CalendarDayButton({
  className,
  render,
  children,
  ...props
}: CalendarDayButtonProps): ReactElement {
  const { store, settings, actions, selection } = useCalendarRootContext("Calendar.DayButton");
  const { date, iso, outsideMonth, disabled, unavailable, flags } =
    useCalendarDayContext("Calendar.DayButton");
  const strings = useLocalizedStrings(calendarStrings);
  const tabbable = useCalendarSelector(store, (state) => !outsideMonth && state.focused?.toString() === iso);
  const requested = useCalendarSelector(
    store,
    (state) => !outsideMonth && state.focusRequest && state.focused?.toString() === iso
  );
  const current = useCalendarSelector(store, (state) => state.today?.toString() === iso);
  const { selected, invalid } = flags;
  const prefix = selection.useDayNamePrefix(date, iso);
  // Only a day the user may select reaches the owner's `select`.
  const selectable = !disabled && !unavailable && !settings.readOnly;
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (requested && !disabled) {
      ref.current?.focus();
    }
  }, [requested, disabled]);

  const { locale, bounds } = settings;
  let name = formatDayName(locale, date);
  if (prefix !== "" && !disabled) {
    name = `${prefix}, ${name}`;
  }
  if (current) {
    name = strings.format(selected ? "todayDateSelected" : "todayDate", { date: name });
  } else if (selected) {
    name = strings.format("dateSelected", { date: name });
  }
  if (bounds.min?.equals(date) === true) {
    name = `${name}, ${strings.format("minimumDate")}`;
  } else if (bounds.max?.equals(date) === true) {
    name = `${name}, ${strings.format("maximumDate")}`;
  }

  const state = useMemo(
    (): CalendarDayButtonState => ({ ...flags, disabled, unavailable, current, outsideMonth }),
    [flags, disabled, unavailable, current, outsideMonth]
  );

  const own: ComponentProps<"button"> = {
    type: "button",
    "aria-label": name,
    disabled,
    tabIndex: tabbable && !disabled ? 0 : -1,
    children: children ?? formatDayNumber(locale, date),
    onFocus() {
      actions.focusDay(date);
    },
    onPointerEnter(event) {
      if (!disabled) {
        selection.hover(date, event.nativeEvent);
      }
    },
    onClick(event) {
      if (selectable) {
        selection.select(date, "day-press", event.nativeEvent, event.currentTarget);
      }
    },
    onKeyDown(event) {
      // A key with Alt, Control or Meta is a browser or system shortcut, such as Alt+Arrow Left
      // for Back; the grid leaves it alone, as React Aria matches its shortcuts' exact modifiers.
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        // Selecting on keydown, and stopping the button's own click, reports the gesture as
        // "keyboard" rather than as a press. A held key selects once: its repeats may land on
        // another day once the first selection moved focus, as React Aria's usePress guards.
        event.preventDefault();
        if (selectable && !event.repeat) {
          selection.select(date, "keyboard", event.nativeEvent, event.currentTarget);
        }
        return;
      }
      const button = event.currentTarget;
      const move = focusMoveForKey(event.key, event.shiftKey, () => {
        // The button's own window, so a calendar in a frame reads its own direction (Base UI #4412).
        const view = button.ownerDocument.defaultView;
        return view?.getComputedStyle(button).direction === "rtl" ? "rtl" : "ltr";
      });
      if (move !== undefined) {
        event.preventDefault();
        actions.move(move, event.nativeEvent, event.currentTarget);
      }
    },
    onKeyUp(event) {
      // Space activates a button on keyup; keydown already selected.
      if (event.key === " ") {
        event.preventDefault();
      }
    },
  };
  if (disabled || unavailable) {
    own["aria-disabled"] = true;
  }
  if (invalid) {
    own["aria-invalid"] = true;
  }
  const { dayDescriptionId } = selection;
  if (dayDescriptionId !== undefined && tabbable && selectable) {
    own["aria-describedby"] = dayDescriptionId;
  }
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    state,
    stateAttributesMapping: DAY_STATE_ATTRIBUTES,
    props: {
      "data-slot": "calendar-day-button",
      ...mergeProps<"button">({ ...own, className: cn(styles.day(), className) }, props),
    },
  });
}
