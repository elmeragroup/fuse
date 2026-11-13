import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `rangeCalendar.*` rows: the description that names a range's
 * ends, and the prompt the focused day describes itself with. The rows copy React Aria's
 * `@react-aria/calendar` strings, so a screen reader hears the words React Aria's range calendar
 * uses.
 */
export const enUS = {
  selectedDateDescription: (vars: Variables) => `Selected Date: ${String(vars?.date)}`,
  selectedRangeDescription: (vars: Variables) => `Selected Range: ${String(vars?.dateRange)}`,
  dateRange: (vars: Variables) => `${String(vars?.startDate)} to ${String(vars?.endDate)}`,
  startRangeSelectionPrompt: "Click to start selecting date range",
  finishRangeSelectionPrompt: "Click to finish selecting date range",
};
