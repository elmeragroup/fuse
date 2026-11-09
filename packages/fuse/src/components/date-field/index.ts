/**
 * Server-visible namespace for `DateInput`.
 * Every part is a client module; this file has no directive, so a server component can read
 * each part instead of dotting into a client reference.
 */
import { DateInputRoot, DateInputSegment } from "./date-input";

export const DateInput = {
  Root: DateInputRoot,
  Segment: DateInputSegment,
};

export { DateField } from "./date-field";
