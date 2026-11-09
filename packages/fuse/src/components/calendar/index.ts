/**
 * Server-visible namespace for `Calendar`.
 * Every part is a client module; this file has no directive, so a server component can read
 * each part instead of dotting into a client reference.
 */
import { CalendarRoot } from "./calendar";
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
} from "./calendar-parts";

export const Calendar = {
  Root: CalendarRoot,
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
