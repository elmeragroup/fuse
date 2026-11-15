// This file is the source entry for `@elmeragroup/fuse/range-calendar`. It contains only explicit named
// re-exports, with no `export *`, local declarations or directives. The exports and barrel generators read
// this file, so change `package.json#exports` and `src/index.ts` only through them. It exports no public
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
