// Source entry facade for `@elmeragroup/fuse/range-calendar`. It holds explicit named re-exports only, with
// no `export *`, no local declarations and no directives. The exports and barrel generators
// discover this file, so never hand-edit package.json#exports or src/index.ts. It has no public
// recipe. The parts other than the Root are Calendar's, whose prop and state types
// `@elmeragroup/fuse/calendar` exports.
export { RangeCalendar } from "./components/range-calendar";
export type {
  RangeCalendarCommitBehavior,
  RangeCalendarRootProps,
  RangeCalendarRootState,
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValue,
  RangeCalendarValueChangeReason,
} from "./components/range-calendar/range-calendar";
