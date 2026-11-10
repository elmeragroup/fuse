// Source entry facade for `@elmeragroup/fuse/range-calendar` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe. The parts other than the Root are Calendar's, whose prop and
// state types `@elmeragroup/fuse/calendar` exports.
export { RangeCalendar } from "./components/range-calendar";
export type {
  RangeCalendarCommitBehavior,
  RangeCalendarRootProps,
  RangeCalendarRootState,
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValue,
  RangeCalendarValueChangeReason,
} from "./components/range-calendar/range-calendar";
