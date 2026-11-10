import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `rangeCalendar.*` rows, copied from React Aria's
 * `@react-aria/calendar` strings.
 */
export const svSE = {
  selectedDateDescription: (vars: Variables) => `Valt datum: ${String(vars?.date)}`,
  selectedRangeDescription: (vars: Variables) => `Valt intervall: ${String(vars?.dateRange)}`,
  dateRange: (vars: Variables) => `${String(vars?.startDate)} till ${String(vars?.endDate)}`,
  startRangeSelectionPrompt: "Klicka för att välja datumintervall",
  finishRangeSelectionPrompt: "Klicka för att avsluta val av datumintervall",
};
