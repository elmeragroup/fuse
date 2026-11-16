/**
 * The kit's parity ledger: one row for each public Fuse component, keyed by its folder under
 * `packages/fuse/src/components`, that says how the Figma kit covers it. `test/kit-parity.test.ts`
 * checks the rows against the components `@elmeragroup/fuse` exports and the sets the kit builds.
 *
 * The module imports nothing, so reading the ledger loads neither the kit nor the Fuse build.
 */

/** Set keys as the kit names them, such as `icon-button`, at least one. */
type SetKeys = readonly [string, ...string[]];

/** How the kit covers one public component. `kind` picks exactly one form. */
export type KitParityRow =
  /** The kit draws the component in these sets, with every variant and axis it exposes. */
  | { readonly kind: "sets"; readonly sets: SetKeys }
  /**
   * The kit draws the component in these sets, and `missing` names a set, variant or axis of the
   * component they still lack, which the open GitHub issue `issue` tracks.
   */
  | { readonly kind: "partial"; readonly sets: SetKeys; readonly missing: string; readonly issue: number }
  /** The kit has no set for the component yet. The open GitHub issue `issue` tracks it. */
  | { readonly kind: "issue"; readonly issue: number }
  /**
   * Designers draw the component from instances of these sets as the kit draws them, so it takes no
   * set of its own.
   */
  | { readonly kind: "composed"; readonly from: SetKeys }
  /** The component takes no set, for `reason`. */
  | { readonly kind: "excluded"; readonly reason: string };

/** The open issue that tracks the component sets, variants and axes the kit does not draw yet. */
const MISSING_SETS = 524;

/** The open issue that tracks the native Calendar and RangeCalendar day set. */
const CALENDAR_DAY = 677;

/** The open issue whose Figma kit item tracks Skeleton reveal frames. */
const SKELETON_REVEAL = 535;

/** The reason every chart component stays out of the kit. */
const CHARTS = "The owner excluded charts from the kit for now.";

/** The reason a typography component stays out of the kit. */
const TEXT_STYLE = "Figma text styles draw it, not a component set.";

/**
 * Every public Fuse component, keyed by its folder name, and how the kit covers it. A new public
 * component takes one row here.
 */
export const KIT_PARITY = {
  accordion: {
    kind: "partial",
    sets: ["accordion-item"],
    missing: "The `infodropdown` variant, and `hasIndicator={false}`.",
    issue: MISSING_SETS,
  },
  "action-bar": { kind: "issue", issue: MISSING_SETS },
  alert: { kind: "sets", sets: ["alert"] },
  "alert-dialog": {
    kind: "partial",
    sets: ["alert-dialog-content", "alert-dialog-open"],
    missing: "Every content size other than `md`.",
    issue: MISSING_SETS,
  },
  "aspect-ratio": { kind: "issue", issue: MISSING_SETS },
  attachment: { kind: "issue", issue: MISSING_SETS },
  // The Combobox sets do not draw it: its popup is as wide as the whole field box, not the input
  // plus 28px, its rows keep no room for a check, and no Input group form holds an input with no
  // addon.
  autocomplete: { kind: "issue", issue: MISSING_SETS },
  "autocomplete-field": { kind: "issue", issue: MISSING_SETS },
  avatar: { kind: "sets", sets: ["avatar", "avatar-group"] },
  badge: { kind: "sets", sets: ["badge"] },
  breadcrumb: {
    kind: "sets",
    sets: [
      "breadcrumb-link",
      "breadcrumb-page",
      "breadcrumb-ellipsis",
      "breadcrumb-separator",
      "breadcrumb-trail",
    ],
  },
  button: {
    kind: "partial",
    sets: ["button", "icon-button"],
    missing: "The `icon-inline` size.",
    issue: MISSING_SETS,
  },
  // The Button sets leave out the corners a Button takes inside a group.
  "button-group": { kind: "issue", issue: MISSING_SETS },
  calendar: { kind: "issue", issue: CALENDAR_DAY },
  card: { kind: "issue", issue: MISSING_SETS },
  carousel: { kind: "issue", issue: MISSING_SETS },
  chart: { kind: "excluded", reason: CHARTS },
  checkbox: { kind: "partial", sets: ["checkbox"], missing: "The invalid focus ring.", issue: MISSING_SETS },
  "checkbox-card": { kind: "issue", issue: MISSING_SETS },
  code: { kind: "issue", issue: MISSING_SETS },
  collapsible: { kind: "excluded", reason: "It has no styles beyond its height transition." },
  combobox: {
    kind: "partial",
    sets: ["combobox-item", "combobox-empty", "combobox-popup", "combobox-open"],
    missing: "The popup search field, chips, and the small input size.",
    issue: MISSING_SETS,
  },
  "combobox-field": {
    kind: "composed",
    from: ["label", "input-group", "combobox-popup", "combobox-item", "field-description", "field-error"],
  },
  command: { kind: "sets", sets: ["command-item", "command-list", "command-palette", "command-dialog-open"] },
  "command-virtual": { kind: "excluded", reason: "It draws Command's look, which Command's sets hold." },
  "confirm-button": {
    kind: "partial",
    sets: ["confirm-button"],
    missing: "The icon sizes, `icon-inline` included.",
    issue: MISSING_SETS,
  },
  "data-table": { kind: "excluded", reason: "It is an example composition, not a set." },
  "data-table-filter": { kind: "issue", issue: MISSING_SETS },
  "date-field": { kind: "issue", issue: MISSING_SETS },
  "date-picker": { kind: "issue", issue: MISSING_SETS },
  "date-range-picker": { kind: "issue", issue: MISSING_SETS },
  "description-list": { kind: "issue", issue: MISSING_SETS },
  dialog: {
    kind: "partial",
    sets: ["dialog-content", "dialog-open"],
    missing: "Every content size other than `md`.",
    issue: MISSING_SETS,
  },
  "dropdown-menu": {
    kind: "partial",
    sets: [
      "dropdown-menu-item",
      "dropdown-menu-checkbox-item",
      "dropdown-menu-radio-item",
      "dropdown-menu-sub-trigger",
      "dropdown-menu-popup",
      "dropdown-menu-sub-content",
      "dropdown-menu-open",
    ],
    missing: "The submenu form.",
    issue: MISSING_SETS,
  },
  emoji: { kind: "excluded", reason: "It belongs to the icon library." },
  empty: {
    kind: "partial",
    sets: ["empty"],
    missing: "The default illustration media.",
    issue: MISSING_SETS,
  },
  field: {
    kind: "partial",
    sets: ["label", "field-description", "field-error", "field-legend", "field-title"],
    missing: "Root orientation, and the card label composition.",
    issue: MISSING_SETS,
  },
  "file-trigger": { kind: "excluded", reason: "It renders a Button, which the Button sets draw." },
  "file-upload": { kind: "sets", sets: ["file-upload-dropzone"] },
  form: { kind: "excluded", reason: "It adds behavior only." },
  frame: { kind: "issue", issue: MISSING_SETS },
  heading: { kind: "excluded", reason: TEXT_STYLE },
  input: {
    kind: "partial",
    sets: ["input"],
    missing: "The `sm` size axis, and the invalid focus ring.",
    issue: MISSING_SETS,
  },
  "input-group": {
    kind: "partial",
    sets: ["input-group"],
    missing:
      "The `sm` size axis, block addons, a textarea, a kbd, and the trigger and clear buttons together.",
    issue: MISSING_SETS,
  },
  item: {
    kind: "partial",
    sets: ["item", "item-link"],
    missing: "The header, the footer, and grouped rows.",
    issue: MISSING_SETS,
  },
  kbd: { kind: "sets", sets: ["kbd", "kbd-group"] },
  link: { kind: "partial", sets: ["link"], missing: "`weight` and `truncate`.", issue: MISSING_SETS },
  "list-detail": { kind: "issue", issue: MISSING_SETS },
  loader: { kind: "sets", sets: ["loader"] },
  meter: { kind: "sets", sets: ["meter"] },
  "navigation-menu": {
    kind: "partial",
    sets: [
      "navigation-menu-bar-trigger",
      "navigation-menu-vertical-trigger",
      "navigation-menu-bar-link",
      "navigation-menu-row-link",
      "navigation-menu-popup",
    ],
    missing: "The indicator.",
    issue: MISSING_SETS,
  },
  "number-field": {
    kind: "partial",
    sets: ["number-field-stepper", "number-field"],
    missing: "The invalid focus ring.",
    issue: MISSING_SETS,
  },
  pagination: {
    kind: "sets",
    sets: ["pagination-link", "pagination-edge", "pagination-ellipsis", "pagination-row"],
  },
  // No Input group form holds the country trigger, and the Combobox popup leaves out the search
  // field the country list opens with.
  "phone-number-field": { kind: "issue", issue: MISSING_SETS },
  popover: {
    kind: "partial",
    sets: ["popover-content", "popover-open"],
    missing: "The `showArrow` arrow.",
    issue: MISSING_SETS,
  },
  // The Button sets leave out the `icon-inline` size, and the Popover sets leave out the arrow.
  "popover-info-button": { kind: "issue", issue: MISSING_SETS },
  "radio-group": {
    kind: "partial",
    sets: ["radio-icon-button", "radio", "radio-row", "radio-group"],
    missing: "`RadioItemGroup`, and the invalid focus ring.",
    issue: MISSING_SETS,
  },
  "range-calendar": { kind: "issue", issue: CALENDAR_DAY },
  "scroll-area": { kind: "issue", issue: MISSING_SETS },
  // No Input group form holds the leading search icon and the trailing clear button together.
  "search-field": { kind: "issue", issue: MISSING_SETS },
  select: {
    kind: "partial",
    sets: [
      "select-trigger",
      "menu-group-label",
      "menu-separator",
      "select-item",
      "select-popup",
      "select-open",
    ],
    missing: "A popup width other than 144px.",
    issue: MISSING_SETS,
  },
  "select-field": { kind: "partial", sets: ["select-field"], missing: '`size="sm"`.', issue: MISSING_SETS },
  "selection-item": { kind: "issue", issue: MISSING_SETS },
  separator: { kind: "sets", sets: ["separator"] },
  sheet: { kind: "issue", issue: MISSING_SETS },
  show: { kind: "excluded", reason: "It renders its children only." },
  sidebar: {
    kind: "partial",
    sets: [
      "sidebar-menu-button",
      "sidebar-menu-sub-button",
      "sidebar-group-label",
      "sidebar-menu-badge",
      "sidebar-group",
      "sidebar-header",
      "sidebar-footer",
      "sidebar-menu-sub",
      "sidebar-menu-item-with-badge",
      "sidebar",
    ],
    missing: "The app frame, its Workspace group and the floating Sidebar.",
    issue: MISSING_SETS,
  },
  skeleton: {
    kind: "partial",
    sets: ["skeleton"],
    missing: "Skeleton reveal frames.",
    issue: SKELETON_REVEAL,
  },
  slider: { kind: "issue", issue: MISSING_SETS },
  span: { kind: "excluded", reason: TEXT_STYLE },
  switch: { kind: "partial", sets: ["switch"], missing: "The invalid focus ring.", issue: MISSING_SETS },
  table: { kind: "issue", issue: MISSING_SETS },
  tabs: { kind: "issue", issue: MISSING_SETS },
  text: { kind: "excluded", reason: TEXT_STYLE },
  "text-field": {
    kind: "partial",
    sets: ["text-field"],
    missing: "The inline and card variants.",
    issue: MISSING_SETS,
  },
  textarea: {
    kind: "partial",
    sets: ["textarea"],
    missing: "The `sm` size axis, and the invalid focus ring.",
    issue: MISSING_SETS,
  },
  "textarea-field": {
    kind: "partial",
    sets: ["textarea-field"],
    missing: '`size="sm"`.',
    issue: MISSING_SETS,
  },
  "timeline-list": { kind: "issue", issue: MISSING_SETS },
  toast: { kind: "issue", issue: MISSING_SETS },
  toggle: { kind: "sets", sets: ["toggle", "icon-toggle"] },
  "toggle-group": {
    kind: "partial",
    sets: ["toggle-group"],
    missing: "The segmented look.",
    issue: MISSING_SETS,
  },
  toolbar: { kind: "sets", sets: ["toolbar"] },
  tooltip: { kind: "sets", sets: ["tooltip-content", "tooltip-open"] },
} as const satisfies Readonly<Record<string, KitParityRow>>;
