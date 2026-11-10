// Source entry facade for `@elmeragroup/fuse/date-field` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe. The part classes stay module-private.
export { DateField, DateInput } from "./components/date-field";
export type { DateFieldProps } from "./components/date-field/date-field";
export type {
  DateInputRootProps,
  DateInputRootState,
  DateInputSegmentData,
  DateInputSegmentProps,
  DateInputSegmentState,
  DateInputSegmentType,
  DateInputValue,
} from "./components/date-field/date-input";
export type {
  DateInputValueChangeEventDetails,
  DateInputValueChangeReason,
} from "./components/date-field/date-input-change-details";
export type { DateInputValidationError } from "./components/date-field/date-input-validation";
