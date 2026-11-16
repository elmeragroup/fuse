/**
 * Gzip size ceilings for the packed package, checked by `size-limit.ts`.
 *
 * Each row records a measurement, and the ceiling follows from it by one rule: the measured
 * bytes × 1.05, rounded up, with at least 512 bytes of headroom so a small entry can still take a
 * small fix. To raise a ceiling, re-measure and record the new number; CONTRIBUTING.md, “Raise a
 * size ceiling”, says when that is legitimate.
 */

/** The date the `MEASURED_GZIP` rows were last measured together. */
export const BUDGETS_MEASURED_ON = "2026-11-12";

/** The share of a measurement a ceiling allows on top of it. */
const HEADROOM_RATIO = 0.05;
/** The fewest bytes of headroom any ceiling allows. */
const MIN_HEADROOM_BYTES = 512;

/**
 * The ceiling for a recorded measurement.
 *
 * @param measuredBytes - The row's recorded gzip bytes.
 * @returns The largest gzip size the row may measure and still pass.
 */
export function ceilingFor(measuredBytes: number): number {
  return Math.max(Math.ceil(measuredBytes * (1 + HEADROOM_RATIO)), measuredBytes + MIN_HEADROOM_BYTES);
}

/**
 * Recorded gzip bytes per measured row, keyed by the names `size-limit` prints. `size-limit`
 * fails on a measured row with no record here and on a record it no longer measures.
 */
export const MEASURED_GZIP = {
  ".": 344699,
  theme: 6491,
  illustrations: 11092,
  flags: 1456,
  "temporal-polyfill": 19489,
  accordion: 31926,
  alert: 33120,
  "alert-dialog": 52107,
  avatar: 13228,
  badge: 16006,
  breadcrumb: 25991,
  button: 28360,
  "button-group": 17846,
  card: 25156,
  chart: 216970,
  checkbox: 42071,
  "checkbox-card": 32567,
  code: 13210,
  collapsible: 28233,
  combobox: 79841,
  "confirm-button": 28962,
  "data-table": 104552,
  "description-list": 11327,
  dialog: 49535,
  "dropdown-menu": 72617,
  emoji: 2483,
  empty: 22008,
  field: 32271,
  frame: 13573,
  heading: 17654,
  input: 27209,
  "input-group": 32752,
  item: 25693,
  "list-detail": 62608,
  loader: 18251,
  meter: 28273,
  "number-field": 43948,
  pagination: 26423,
  "phone-number-field": 125545,
  popover: 58315,
  "popover-info-button": 58581,
  "radio-group": 45895,
  "scroll-area": 28991,
  "search-field": 42644,
  select: 67676,
  "selection-item": 29261,
  separator: 10752,
  sheet: 61252,
  show: 162,
  sidebar: 87811,
  skeleton: 21897,
  span: 17600,
  switch: 27774,
  table: 12861,
  tabs: 27195,
  text: 17596,
  "text-field": 37191,
  textarea: 22747,
  "textarea-field": 36043,
  "timeline-list": 24268,
  toast: 45978,
  toggle: 26800,
  "toggle-group": 30613,
  tooltip: 52109,
  "action-bar": 37520,
  carousel: 39491,
  "autocomplete-field": 81136,
  "combobox-field": 80534,
  autocomplete: 77615,
  "file-upload": 29418,
  attachment: 35482,
  "aspect-ratio": 21392,
  "data-table-filter": 160995,
  toolbar: 29816,
  command: 72859,
  "command-virtual": 10925,
  kbd: 21466,
  "select-field": 73096,
  slider: 45242,
  form: 2646,
  "navigation-menu": 60490,
  link: 23861,
  calendar: 39114,
  "range-calendar": 41621,
  "date-field": 48519,
  "date-picker": 99349,
  "date-range-picker": 101096,
  "file-trigger": 35491,
  "react-aria/calendar": 63976,
  "react-aria/date-field": 73138,
  "react-aria/date-picker": 109984,
  "react-aria/date-range-picker": 111588,
  "react-aria/focusable": 5308,
  "react-aria/range-calendar": 65420,
  "react-aria/ui-providers": 2095,
  "Button from the root barrel": 28320,
  "Check from icons": 895,
  "Chart from chart": 154068,
  "PieChart from chart": 113364,
  "RadialChart from chart": 109848,
  "RadarChart from chart": 114002,
  "ClockChart from chart": 132319,
  "ScatterChart from chart": 87815,
  "Sparkline from chart": 12336,
  "styles/fuse.css": 9717,
  "styles.css": 39799,
  "themes.css": 6643,
  "chart.css": 24878,
} as const satisfies Readonly<Record<string, number>>;
