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

/** The open issue that lists the kit's gaps the 2026-11-20 Figma issue run left for later. */
const NICE_TO_HAVE = 922;

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
    missing: "The `infodropdown` variant (#846), and `hasIndicator={false}`.",
    issue: NICE_TO_HAVE,
  },
  "action-bar": {
    kind: "partial",
    sets: ["action-bar"],
    missing:
      "The bar in a container narrower than 28rem, whose buttons show their icons alone, and `ActionBar.Count` with text of its own.",
    issue: NICE_TO_HAVE,
  },
  alert: { kind: "sets", sets: ["alert"] },
  "alert-dialog": {
    kind: "partial",
    sets: ["alert-dialog-content", "alert-dialog-open"],
    missing: "The content sizes from `2xl` to `10xl`.",
    issue: NICE_TO_HAVE,
  },
  "aspect-ratio": { kind: "sets", sets: ["aspect-ratio"] },
  attachment: {
    kind: "partial",
    sets: ["attachment"],
    missing:
      "The vertical tile, the `uploading` and `processing` states (#857), image media, `Attachment.AspectRatio`, `Attachment.Trigger` and `Attachment.Group`.",
    issue: NICE_TO_HAVE,
  },
  // The Combobox sets do not draw it: its rows keep no room for a check, and no Input group form
  // holds an input with no addon.
  autocomplete: { kind: "issue", issue: NICE_TO_HAVE },
  "autocomplete-field": { kind: "issue", issue: NICE_TO_HAVE },
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
  button: { kind: "sets", sets: ["button", "icon-button"] },
  // The Button sets leave out the corners a Button takes inside a group.
  "button-group": { kind: "issue", issue: 917 },
  calendar: {
    kind: "partial",
    sets: ["calendar", "calendar-day"],
    missing:
      "The card's fill clipped inside a translucent border; more than one month, a month of four or six weeks, and a disabled calendar; and a day both unavailable and focused or hovered.",
    issue: CALENDAR_DAY,
  },
  // The horizontal card is a known limit. Its parts grow from different bases, so on one line the
  // content stays 64px wider than the footer, which neither a Figma row's equal fills nor a grid's
  // FLEX shares keep. `card-kit.ts` gives the full reason.
  card: {
    kind: "partial",
    sets: ["card"],
    missing:
      '`direction="horizontal"`, `Card.Action`, `Card.Tag`, `Card.Section`, `Card.SectionButton`, a title `icon`, the title and description `size`s, and a card without its header, description or footer.',
    issue: NICE_TO_HAVE,
  },
  carousel: { kind: "issue", issue: NICE_TO_HAVE },
  chart: { kind: "excluded", reason: CHARTS },
  checkbox: {
    kind: "partial",
    sets: ["checkbox"],
    missing: "`CheckboxGroup` and `CheckboxItemGroup`, vertical and horizontal.",
    issue: NICE_TO_HAVE,
  },
  "checkbox-card": {
    kind: "partial",
    sets: ["checkbox-card"],
    missing: "The `tags` badges, `children` below the description and `rightContent` at the card's end.",
    issue: NICE_TO_HAVE,
  },
  code: {
    kind: "partial",
    sets: ["code"],
    missing:
      "Other source text: the set draws the default demo's two lines with each token's color, and Figma does not color text a designer types in.",
    issue: NICE_TO_HAVE,
  },
  collapsible: { kind: "excluded", reason: "It has no styles beyond its height transition." },
  combobox: {
    kind: "partial",
    sets: ["combobox-item", "combobox-empty", "combobox-popup", "combobox-open"],
    missing: "The popup search field, chips (#918), the small input size, and the read-only fill.",
    issue: NICE_TO_HAVE,
  },
  "combobox-field": {
    kind: "partial",
    sets: ["label", "input-group", "combobox-popup", "combobox-item", "field-description", "field-error"],
    missing: "The read-only fill, and the input with neither button.",
    issue: NICE_TO_HAVE,
  },
  command: {
    kind: "partial",
    sets: ["command-item", "command-list", "command-palette", "command-dialog-open"],
    missing: "The `Command.Empty` message, `Command.Status`, and `Command.Back` on a nested page.",
    issue: NICE_TO_HAVE,
  },
  "command-virtual": { kind: "excluded", reason: "It draws Command's look, which Command's sets hold." },
  "confirm-button": {
    kind: "partial",
    sets: ["confirm-button"],
    missing: "The icon sizes, `icon-inline` included.",
    issue: NICE_TO_HAVE,
  },
  "data-table": { kind: "excluded", reason: "It is an example composition, not a set." },
  "data-table-filter": {
    kind: "partial",
    sets: ["data-table-filter-bar"],
    missing: "A ghost chip, the bar narrower than 36rem, the add menu and the value popover.",
    issue: NICE_TO_HAVE,
  },
  "date-field": {
    kind: "partial",
    sets: ["date-field"],
    missing: "The `sm` size, and the time segments of a date and time, its hour cycles and its time zone.",
    issue: NICE_TO_HAVE,
  },
  "date-picker": {
    kind: "partial",
    sets: ["date-picker"],
    missing: "The calendar popup; the `sm` size, the trigger at the start, and a date and time.",
    issue: NICE_TO_HAVE,
  },
  "date-range-picker": {
    kind: "partial",
    sets: ["date-range-picker"],
    missing:
      "The calendar popup and its presets; the `sm` size, a range of dates and times, and the shorter box a narrower picker gets below 24rem.",
    issue: NICE_TO_HAVE,
  },
  "description-list": {
    kind: "partial",
    sets: ["description-list-item", "description-list"],
    missing:
      "The inline layout, the stacked layout below `sm`, and a details word wider than its column, which CSS widens the column for in every Item where the kit breaks the word.",
    issue: NICE_TO_HAVE,
  },
  dialog: {
    kind: "partial",
    sets: ["dialog-content", "dialog-open"],
    missing: "The content sizes from `2xl` to `10xl`.",
    issue: NICE_TO_HAVE,
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
    issue: 849,
  },
  emoji: { kind: "excluded", reason: "It belongs to the icon library." },
  empty: {
    kind: "partial",
    sets: ["empty"],
    missing: "The default illustration media.",
    issue: NICE_TO_HAVE,
  },
  field: {
    kind: "partial",
    sets: ["label", "field-description", "field-error", "field-legend", "field-title"],
    missing: "Root orientation, and the card label composition.",
    issue: NICE_TO_HAVE,
  },
  "file-trigger": { kind: "excluded", reason: "It renders a Button, which the Button sets draw." },
  "file-upload": { kind: "sets", sets: ["file-upload-dropzone"] },
  form: { kind: "excluded", reason: "It adds behavior only." },
  // A build of the docs default demo at `layout="gutter"` leaves rows unmapped that no paint order
  // settles. The panels' corners are `max(0px, radius-xl - 1px - surface-pad-sm)`, and their
  // highlight's 1px less, and `fuse-variable-set.ts` syncs no formula variable for either. The build
  // reads the panels' `shadow-[shadow:0_var(--frame-shadow-y,1px)_…]/5` as
  // `0 1px 2px 0  oklab(0% 0 0 / .05)`, which no Figma field reads. And the root and the panels clip
  // their fill at the border, whose `--border` is translucent in the neutral dark theme, as Sheet
  // content's is.
  frame: { kind: "issue", issue: 853 },
  heading: { kind: "excluded", reason: TEXT_STYLE },
  input: {
    kind: "partial",
    sets: ["input"],
    missing: "The `sm` size axis.",
    issue: NICE_TO_HAVE,
  },
  "input-group": {
    kind: "partial",
    sets: ["input-group"],
    missing:
      "The `sm` size axis, the read-only fill, block addons, a textarea, a kbd, and the trigger and clear buttons together.",
    issue: NICE_TO_HAVE,
  },
  item: {
    kind: "partial",
    sets: ["item", "item-link"],
    missing: "The header, the footer, and grouped rows.",
    issue: NICE_TO_HAVE,
  },
  kbd: { kind: "sets", sets: ["kbd", "kbd-group"] },
  link: { kind: "partial", sets: ["link"], missing: "`truncate`.", issue: NICE_TO_HAVE },
  "list-detail": {
    kind: "partial",
    sets: ["list-detail-pane", "list-detail", "list-detail-sheet", "list-detail-open"],
    missing: "The overlay Sheet's corner close (`showCloseButton`) and its sizes other than md.",
    issue: NICE_TO_HAVE,
  },
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
    issue: NICE_TO_HAVE,
  },
  "number-field": {
    kind: "partial",
    sets: ["number-field-stepper", "number-field"],
    missing: "The `sm` size axis.",
    issue: NICE_TO_HAVE,
  },
  pagination: {
    kind: "partial",
    sets: ["pagination-link", "pagination-edge", "pagination-ellipsis", "pagination-row"],
    missing: "The link and the edge at `icon-inline`, and the edge at the square sizes.",
    issue: NICE_TO_HAVE,
  },
  // No Input group form holds the country trigger, and the Combobox popup leaves out the search
  // field the country list opens with.
  "phone-number-field": { kind: "issue", issue: NICE_TO_HAVE },
  popover: {
    kind: "partial",
    sets: ["popover-content", "popover-open"],
    missing: "The `showArrow` arrow.",
    issue: 844,
  },
  // The Popover sets leave out the arrow (#844).
  "popover-info-button": { kind: "issue", issue: NICE_TO_HAVE },
  "radio-group": {
    kind: "partial",
    sets: ["radio-icon-button", "radio", "radio-row", "radio-group"],
    missing: "`RadioItemGroup`.",
    issue: NICE_TO_HAVE,
  },
  "range-calendar": {
    kind: "partial",
    sets: ["range-calendar", "calendar-day"],
    missing:
      "The card's fill clipped inside a translucent border; more than one month, a month of four or six weeks, and a disabled calendar; a day both unavailable and focused or hovered; and the band a hovered day draws while the user picks a range's end.",
    issue: CALENDAR_DAY,
  },
  "scroll-area": { kind: "issue", issue: NICE_TO_HAVE },
  // No Input group form holds the leading search icon and the trailing clear button together.
  "search-field": { kind: "issue", issue: NICE_TO_HAVE },
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
    missing: "A popup wider than 144px under a trigger that hugs its text.",
    issue: NICE_TO_HAVE,
  },
  "select-field": {
    kind: "partial",
    sets: ["select-field"],
    missing: '`size="sm"`.',
    issue: NICE_TO_HAVE,
  },
  "selection-item": {
    kind: "partial",
    sets: ["selection-item"],
    missing:
      "A checked, disabled or hovered row, the control at the end, sub-sections, and rows stacked in a group.",
    issue: NICE_TO_HAVE,
  },
  separator: { kind: "sets", sets: ["separator"] },
  sheet: {
    kind: "partial",
    sets: ["sheet-content", "sheet-open"],
    missing:
      "`Sheet.Body` of the default demo, the `left`, `top` and `bottom` sides, and the sizes other than md.",
    issue: NICE_TO_HAVE,
  },
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
    missing: "The app frame, its Workspace group and the floating Sidebar (#847).",
    issue: NICE_TO_HAVE,
  },
  skeleton: {
    kind: "partial",
    sets: ["skeleton"],
    missing: "Skeleton reveal frames.",
    issue: SKELETON_REVEAL,
  },
  slider: { kind: "issue", issue: NICE_TO_HAVE },
  span: { kind: "excluded", reason: TEXT_STYLE },
  switch: { kind: "sets", sets: ["switch"] },
  table: {
    kind: "partial",
    sets: ["table-head", "table-cell", "table-row", "table-caption"],
    missing:
      "Column widths: each cell hugs its text, as a table no wider than its content lays it out, and a wider table shares the rest among its columns by their content (CSS 2.1 §17.5.2.2), which no auto layout draws, so the designer sets them. Also the footer, a framed table (#853), and VerticalTable's fixed-layout equal columns and collapsed borders, which the kit has not attempted.",
    issue: NICE_TO_HAVE,
  },
  tabs: {
    kind: "partial",
    sets: ["tabs-trigger", "tabs-list", "tabs-content"],
    missing:
      "The vertical orientation, triggers with icons, and an active trigger hovered or focused, since the trigger's one `state` axis holds active beside them.",
    issue: NICE_TO_HAVE,
  },
  text: { kind: "excluded", reason: TEXT_STYLE },
  "text-field": {
    kind: "partial",
    sets: ["text-field"],
    missing:
      "The `sm` size axis and the card variant. The inline variant stays out as a known limit, because Chromium sizes its input from the `size` attribute and the font's character widths, which differ by platform, so no density variable can hold its width.",
    issue: NICE_TO_HAVE,
  },
  textarea: {
    kind: "partial",
    sets: ["textarea"],
    missing: "The `sm` size axis.",
    issue: NICE_TO_HAVE,
  },
  "textarea-field": {
    kind: "partial",
    sets: ["textarea-field"],
    missing: '`size="sm"`.',
    issue: NICE_TO_HAVE,
  },
  "timeline-list": {
    kind: "partial",
    sets: ["timeline-list"],
    missing:
      "A description that holds a link, as the links demo writes it, and `TimelineList.Title`'s `align`, `size` and `font`.",
    issue: NICE_TO_HAVE,
  },
  toast: {
    kind: "partial",
    sets: ["toast"],
    missing:
      "`Toast.Action`, a stack of several toasts, a toast behind the frontmost one, and the top placements.",
    issue: NICE_TO_HAVE,
  },
  toggle: { kind: "sets", sets: ["toggle", "icon-toggle"] },
  "toggle-group": {
    kind: "partial",
    sets: ["toggle-group"],
    missing: "The segmented look.",
    issue: 848,
  },
  toolbar: { kind: "sets", sets: ["toolbar"] },
  tooltip: {
    kind: "partial",
    sets: ["tooltip-content", "tooltip-open"],
    missing: 'The popup aligned to its trigger\'s start or end, `align="start"` and `align="end"`.',
    issue: NICE_TO_HAVE,
  },
  tour: {
    kind: "partial",
    sets: ["tour-popup", "tour-step"],
    missing:
      "The step card at its last step, `Tour.Spotlight`, `Tour.Ring`, `Tour.Beacon` and the popup open against its step's element.",
    issue: NICE_TO_HAVE,
  },
} as const satisfies Readonly<Record<string, KitParityRow>>;
