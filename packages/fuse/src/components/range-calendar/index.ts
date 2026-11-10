/**
 * Server-visible namespace for `RangeCalendar`.
 * Every part is a client module; this file has no directive, so a server component can read
 * each part instead of dotting into a client reference. Every part but the Root is Calendar's own:
 * the parts read whichever calendar Root encloses them.
 */
import {
  CalendarDayButton,
  CalendarDayGrid,
  CalendarDayGridBody,
  CalendarDayGridCell,
  CalendarDayGridHeader,
  CalendarDayGridHeaderCell,
  CalendarDayGridHeaderRow,
  CalendarDayGridRow,
  CalendarDecrementMonth,
  CalendarHeader,
  CalendarIncrementMonth,
  CalendarMonth,
  CalendarMonthHeading,
  CalendarMonths,
  CalendarVisibleRangeHeading,
} from "../calendar/calendar-parts";
import { RangeCalendarRoot } from "./range-calendar";

export const RangeCalendar = {
  Root: RangeCalendarRoot,
  Header: CalendarHeader,
  DecrementMonth: CalendarDecrementMonth,
  IncrementMonth: CalendarIncrementMonth,
  VisibleRangeHeading: CalendarVisibleRangeHeading,
  Months: CalendarMonths,
  Month: CalendarMonth,
  MonthHeading: CalendarMonthHeading,
  DayGrid: CalendarDayGrid,
  DayGridHeader: CalendarDayGridHeader,
  DayGridHeaderRow: CalendarDayGridHeaderRow,
  DayGridHeaderCell: CalendarDayGridHeaderCell,
  DayGridBody: CalendarDayGridBody,
  DayGridRow: CalendarDayGridRow,
  DayGridCell: CalendarDayGridCell,
  DayButton: CalendarDayButton,
};
