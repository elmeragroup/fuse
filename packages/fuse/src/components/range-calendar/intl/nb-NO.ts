import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `rangeCalendar.*` rows, copied from React Aria's
 * `@react-aria/calendar` strings.
 */
export const nbNO = {
  selectedDateDescription: (vars: Variables) => `Valgt dato: ${String(vars?.date)}`,
  selectedRangeDescription: (vars: Variables) => `Valgt område: ${String(vars?.dateRange)}`,
  dateRange: (vars: Variables) => `${String(vars?.startDate)} til ${String(vars?.endDate)}`,
  startRangeSelectionPrompt: "Klikk for å starte valg av datoområde",
  finishRangeSelectionPrompt: "Klikk for å fullføre valg av datoområde",
};
