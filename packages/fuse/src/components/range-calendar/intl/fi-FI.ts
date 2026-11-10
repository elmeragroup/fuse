import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `rangeCalendar.*` rows, copied from React Aria's
 * `@react-aria/calendar` strings.
 */
export const fiFI = {
  selectedDateDescription: (vars: Variables) => `Valittu päivämäärä: ${String(vars?.date)}`,
  selectedRangeDescription: (vars: Variables) => `Valittu aikaväli: ${String(vars?.dateRange)}`,
  dateRange: (vars: Variables) => `${String(vars?.startDate)} \u2013 ${String(vars?.endDate)}`,
  startRangeSelectionPrompt: "Aloita päivämääräalueen valinta napsauttamalla tätä.",
  finishRangeSelectionPrompt: "Lopeta päivämääräalueen valinta napsauttamalla tätä.",
};
