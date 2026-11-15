// Source entry facade for `@elmeragroup/fuse/calendar`. It is a pure re-export file with explicit named
// re-exports only, and has no `export *`, local declarations or directives. The exports and barrel generators
// discover this file, so never hand-edit `package.json#exports` or `src/index.ts`. There is no public recipe.
// The part classes stay module-private.
export { Calendar } from "./components/calendar";
export type {
  CalendarRootProps,
  CalendarRootState,
  CalendarRootValueChangeEventDetails,
} from "./components/calendar/calendar";
export type {
  CalendarChangeEventDetails,
  CalendarValidationError,
  CalendarValueChangeEventDetails,
  CalendarValueChangeReason,
} from "./components/calendar/calendar-change-details";
export type { CalendarDayFlagState } from "./components/calendar/calendar-context";
export type { CalendarPageBehavior } from "./components/calendar/calendar-dates";
export type { CalendarFirstDayOfWeek } from "./components/calendar/calendar-input";
export type {
  CalendarDayButtonProps,
  CalendarDayButtonState,
  CalendarDayGridBodyProps,
  CalendarDayGridCellProps,
  CalendarDayGridHeaderCellProps,
  CalendarDayGridHeaderProps,
  CalendarDayGridHeaderRowProps,
  CalendarDayGridProps,
  CalendarDayGridRowProps,
  CalendarDecrementMonthProps,
  CalendarHeaderProps,
  CalendarIncrementMonthProps,
  CalendarMonthHeadingProps,
  CalendarMonthProps,
  CalendarMonthsProps,
  CalendarVisibleRangeHeadingProps,
} from "./components/calendar/calendar-parts";
export type {
  CalendarVisibleRangeChangeEventDetails,
  CalendarVisibleRangeChangeHandler,
  CalendarVisibleRangeChangeReason,
} from "./components/calendar/use-calendar-navigation";
