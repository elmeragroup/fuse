"use client";

import type { ReactElement } from "react";

import {
  CalendarGrid as AriaCalendarGrid,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarHeaderCell,
  useLocale,
} from "react-aria-components";

import { calendarVariants } from "../../styles/calendar";
import { weekdayStyle } from "./weekday-style";

/** Props for the locale-aware weekday grid both calendar composites render. */
export type LocaleCalendarGridProps = {
  /** Classes for RAC's grid, normally the calendar recipe's `body` slot. */
  className?: string;
  /** The grid body element — `CalendarGridBody` and its cell renderer. */
  children: ReactElement;
};

/**
 * Weekday column-header row. Reused by Calendar and RangeCalendar; the locale-aware grid
 * renders it, so it stays beside the grid rather than in either composite.
 */
export function CalendarGridHeader(): ReactElement {
  const { headerCell } = calendarVariants();
  return (
    <AriaCalendarGridHeader>
      {(day) => <CalendarHeaderCell className={headerCell()}>{day}</CalendarHeaderCell>}
    </AriaCalendarGridHeader>
  );
}

/**
 * The weekday grid of both calendar composites, owning the locale wiring its siblings
 * would otherwise each repeat: reads the active locale, selects the short or narrow
 * weekday label style from it, and renders the shared `CalendarGridHeader`. Reused by
 * RangeCalendar.
 */
export function LocaleCalendarGrid({ className, children }: LocaleCalendarGridProps): ReactElement {
  const { locale } = useLocale();

  return (
    <AriaCalendarGrid className={className} weekdayStyle={weekdayStyle(locale)}>
      <CalendarGridHeader />
      {children}
    </AriaCalendarGrid>
  );
}

CalendarGridHeader.displayName = "CalendarGridHeader";
LocaleCalendarGrid.displayName = "LocaleCalendarGrid";
