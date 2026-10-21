import type { Variables } from "@internationalized/string";

/** Default localized copy for the data table filter. No row picks a noun form by a count. */
export const enUS = {
  /** The Bar's default name. */
  filters: "Filters",
  /** The Trigger's label. */
  filter: "Filter",
  /** The add menu's name. */
  addFilter: "Add filter",
  /** The add menu's search name. */
  searchFields: "Search fields",
  searchFieldsPlaceholder: "Filter by…",
  noFields: "No matching fields.",
  /** Said by a menu row whose field already has a filter. */
  filtered: "Has a filter",
  /** The quick-search group's label. */
  valuesGroup: "Values",
  searchValues: (vars: Variables) => `Search ${String(vars?.field)}`,
  noValues: "No matching values.",
  /** Under a list that shows only its first matches. */
  narrowHint: "Type to narrow the list",
  /** The in-place editor's Back button in the add menu. */
  back: "Back to fields",
  chip: (vars: Variables) => `${String(vars?.field)} filter`,
  operatorLabel: (vars: Variables) => `${String(vars?.field)} operator`,
  removeFilter: (vars: Variables) => `Remove ${String(vars?.field)} filter`,
  clearFilters: "Clear filters",
  /** After the shown labels. The count arrives already formatted. */
  moreValues: (vars: Variables) => `+${String(vars?.count)}`,
  quoted: (vars: Variables) => `“${String(vars?.text)}”`,
  textPlaceholder: "Type to filter",
  /** After the Enter key cap in the text editor. */
  closeHint: "to close",
  minimum: "Minimum",
  maximum: "Maximum",
  invalidRange: "The minimum is above the maximum.",
  from: "From",
  to: "To",
  /** The date presets' group name. */
  datePresets: "Quick ranges",
  today: "Today",
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  thisMonth: "This month",
  thisYear: "This year",
  "option.is": "is",
  "option.isNot": "is not",
  "option.isAnyOf": "is any of",
  "option.isNoneOf": "is none of",
  "multiOption.includes": "includes",
  "multiOption.excludes": "excludes",
  "multiOption.includesAnyOf": "includes any of",
  "multiOption.includesAllOf": "includes all of",
  "multiOption.excludesAnyOf": "excludes any of",
  "multiOption.excludesAllOf": "excludes all of",
  "text.contains": "contains",
  "text.doesNotContain": "does not contain",
  "text.startsWith": "starts with",
  "text.doesNotStartWith": "does not start with",
  "number.is": "is",
  "number.isNot": "is not",
  "number.isGreaterThan": "is greater than",
  "number.isGreaterThanOrEqual": "is at least",
  "number.isLessThan": "is less than",
  "number.isLessThanOrEqual": "is at most",
  "number.isBetween": "is between",
  "number.isNotBetween": "is not between",
  "date.is": "is",
  "date.isNot": "is not",
  "date.isBefore": "is before",
  "date.isOnOrAfter": "is on or after",
  "date.isAfter": "is after",
  "date.isOnOrBefore": "is on or before",
  "date.isBetween": "is between",
  "date.isNotBetween": "is not between",
};
