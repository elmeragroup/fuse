// Source entry facade for `@elmeragroup/fuse/date-field`. It is a pure re-export file with explicit named
// re-exports only, and has no `export *`, local declarations or directives. The exports and barrel generators
// discover this file, so never hand-edit `package.json#exports` or `src/index.ts`.
// There is no public recipe. The part classes stay module-private.
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
