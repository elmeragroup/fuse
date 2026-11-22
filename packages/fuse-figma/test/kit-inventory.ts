/**
 * The kit's pages as a reviewer writes them down: each component page's key and name, the
 * component sets on it in the order the plugin places them, with each set's variant count and the
 * instances each preview places, and the four previews every page holds. The suites that apply the
 * kit end to end and the built-kit suite build their expected page, set, preview and change lists
 * from it. It never reads `KIT` or `buildKit()`, so it stays the oracle those lists check the kit
 * against. A new set takes one row here.
 */

/** A component set as the kit places it on its page. */
type InventorySet = {
  /** The set's key, such as `icon-button`. */
  readonly key: string;
  /** The set's name, such as `Icon button`. */
  readonly name: string;
  /** How many variants the set holds. */
  readonly variants: number;
  /** How many of the set's instances each preview on its page places. */
  readonly previewed: number;
};

/** A component page and the sets on it. */
export type InventoryPage = {
  /** The page's slug, which names it in its key, `page/<slug>`, and in its previews' keys. */
  readonly slug: string;
  readonly name: string;
  /**
   * The route of the page's docs page under `/components/`, where it differs from the slug, as
   * Radio's is `radio-group`.
   */
  readonly docs?: string;
  readonly sets: readonly InventorySet[];
};

/** Every component page of the kit, in the order the plugin creates them. */
export const KIT_PAGES: readonly InventoryPage[] = [
  {
    slug: "button",
    name: "Button",
    sets: [
      // 7 variants in 5 states, 7 at each of 3 other sizes, and 7 with each of 2 icons.
      { key: "button", name: "Button", variants: 420, previewed: 70 },
      // 7 variants in 5 states, and 7 at each of 4 other sizes.
      { key: "icon-button", name: "Icon button", variants: 175, previewed: 63 },
      // 2 variants in 4 states, armed off and on but never armed while disabled, and 2 at each of 3
      // other sizes.
      { key: "confirm-button", name: "Confirm button", variants: 56, previewed: 20 },
    ],
  },
  {
    slug: "toggle",
    name: "Toggle",
    sets: [
      // 2 variants at 4 sizes in 4 states, off and on, with 3 icon placements, alone or as one of a
      // segmented group's 3 items: 768. The previews place the free-standing ones: 2 in 4 states off
      // and on, 2 at each of 3 other sizes, and 2 with each of 2 icons.
      { key: "toggle", name: "Toggle", variants: 768, previewed: 26 },
      // The same without the icons.
      { key: "icon-toggle", name: "Icon toggle", variants: 64, previewed: 22 },
      // The spaced group at 2 variants and 4 sizes.
      { key: "toggle-group", name: "Toggle group", variants: 8, previewed: 8 },
      // The segmented group at 2 variants and 4 sizes.
      { key: "segmented-toggle-group", name: "Segmented toggle group", variants: 8, previewed: 8 },
    ],
  },
  // 19 variants at 3 sizes.
  { slug: "badge", name: "Badge", sets: [{ key: "badge", name: "Badge", variants: 57, previewed: 57 }] },
  {
    slug: "kbd",
    name: "Kbd",
    sets: [
      // The text cap and the icon cap.
      { key: "kbd", name: "Kbd", variants: 2, previewed: 2 },
      // The docs Combination demo's Ctrl and K.
      { key: "kbd-group", name: "Kbd group", variants: 1, previewed: 1 },
    ],
  },
  {
    slug: "radio",
    name: "Radio",
    docs: "radio-group",
    sets: [
      // 5 sizes, off and on, in 6 states.
      { key: "radio-icon-button", name: "Radio icon button", variants: 60, previewed: 60 },
      // Off and on, in 5 states.
      { key: "radio", name: "Radio", variants: 10, previewed: 10 },
      // The labelled row, hugging and filling, off and on, in 4 states.
      { key: "radio-row", name: "Radio row", variants: 16, previewed: 16 },
      // The labelled group, vertical and horizontal, at rest, disabled and invalid.
      { key: "radio-group", name: "Radio group", variants: 6, previewed: 6 },
    ],
  },
  // Unchecked, checked and indeterminate, in 5 states.
  {
    slug: "checkbox",
    name: "Checkbox",
    sets: [{ key: "checkbox", name: "Checkbox", variants: 15, previewed: 15 }],
  },
  // 2 sizes, off and on, in 5 states.
  { slug: "switch", name: "Switch", sets: [{ key: "switch", name: "Switch", variants: 20, previewed: 20 }] },
  // Horizontal and vertical.
  {
    slug: "separator",
    name: "Separator",
    sets: [{ key: "separator", name: "Separator", variants: 2, previewed: 2 }],
  },
  // A line and a circle.
  {
    slug: "skeleton",
    name: "Skeleton",
    sets: [{ key: "skeleton", name: "Skeleton", variants: 2, previewed: 2 }],
  },
  // 5 sizes.
  { slug: "loader", name: "Loader", sets: [{ key: "loader", name: "Loader", variants: 5, previewed: 5 }] },
  {
    slug: "field",
    name: "Field",
    sets: [
      // Rest and disabled.
      { key: "label", name: "Label", variants: 2, previewed: 2 },
      // At rest alone, the same in every state of its Field.
      { key: "field-description", name: "Field description", variants: 1, previewed: 1 },
      // In an invalid Field alone.
      { key: "field-error", name: "Field error", variants: 1, previewed: 1 },
      // The legend and label variants.
      { key: "field-legend", name: "Field legend", variants: 2, previewed: 2 },
      // Rest and disabled.
      { key: "field-title", name: "Field title", variants: 2, previewed: 2 },
    ],
  },
  // Placeholder and value in 5 states.
  {
    slug: "input",
    name: "Input",
    sets: [
      // Placeholder and value in 6 states.
      { key: "input", name: "Input", variants: 12, previewed: 12 },
      // Combobox's caret and clear forms, Command's search form and Combobox's open caret form, in 4 states.
      { key: "input-group", name: "Input group", variants: 16, previewed: 16 },
      // The labelled input, placeholder and value in 5 states.
      { key: "text-field", name: "Text field", variants: 10, previewed: 10 },
    ],
  },
  {
    slug: "textarea",
    name: "Textarea",
    sets: [
      // Placeholder and value in 6 states.
      { key: "textarea", name: "Textarea", variants: 12, previewed: 12 },
      // The labelled textarea in 5 states, and one with its Counter on.
      { key: "textarea-field", name: "Textarea field", variants: 5, previewed: 6 },
    ],
  },
  // The fallback and the image at 4 sizes.
  {
    slug: "avatar",
    name: "Avatar",
    sets: [
      // The initials and the picture, at 4 sizes.
      { key: "avatar", name: "Avatar", variants: 8, previewed: 8 },
      // The docs Group demo's three avatars.
      { key: "avatar-group", name: "Avatar group", variants: 1, previewed: 1 },
    ],
  },
  // 4 modes at 4 levels.
  { slug: "meter", name: "Meter", sets: [{ key: "meter", name: "Meter", variants: 16, previewed: 16 }] },
  {
    slug: "pagination",
    name: "Pagination",
    sets: [
      // Eight sizes, current off and on, in 3 states.
      { key: "pagination-link", name: "Pagination link", variants: 48, previewed: 48 },
      // Four label sizes, previous and next, in 3 states.
      { key: "pagination-edge", name: "Pagination edge", variants: 24, previewed: 24 },
      // The md square alone.
      { key: "pagination-ellipsis", name: "Pagination ellipsis", variants: 1, previewed: 1 },
      // The docs Basic demo's previous, pages 1 to 3 and next.
      { key: "pagination-row", name: "Pagination row", variants: 1, previewed: 1 },
    ],
  },
  {
    slug: "breadcrumb",
    name: "Breadcrumb",
    sets: [
      // Rest, hover and focus.
      { key: "breadcrumb-link", name: "Breadcrumb link", variants: 3, previewed: 3 },
      // The current page alone.
      { key: "breadcrumb-page", name: "Breadcrumb page", variants: 1, previewed: 1 },
      // The 20px box alone.
      { key: "breadcrumb-ellipsis", name: "Breadcrumb ellipsis", variants: 1, previewed: 1 },
      // The 14px chevron alone.
      { key: "breadcrumb-separator", name: "Breadcrumb separator", variants: 1, previewed: 1 },
      // The docs Basic demo's trail, and one with its Ellipsis on, the Ellipsis demo's.
      { key: "breadcrumb-trail", name: "Breadcrumb trail", variants: 1, previewed: 2 },
    ],
  },
  {
    slug: "select",
    name: "Select",
    sets: [
      // Hugging and filling, 2 sizes in 5 states, holding the placeholder or a value, closed and open.
      { key: "select-trigger", name: "Select trigger", variants: 80, previewed: 80 },
      // The labelled select in 5 states, holding the placeholder or a value.
      { key: "select-field", name: "Select field", variants: 10, previewed: 10 },
      // The plain caption, and Dropdown menu's Medium caption, plain and inset.
      { key: "menu-group-label", name: "Menu group label", variants: 3, previewed: 3 },
      // The hairline between groups.
      { key: "menu-separator", name: "Menu separator", variants: 1, previewed: 1 },
      // Selected off and on, at rest, highlighted and disabled.
      { key: "select-item", name: "Select item", variants: 6, previewed: 6 },
      // The Basic demo's rows, and the Groups demo's groups.
      { key: "select-popup", name: "Select popup", variants: 2, previewed: 2 },
      // Below the trigger, at the default and the small size, under a hugging and a filling trigger.
      { key: "select-open", name: "Select (open)", variants: 4, previewed: 4 },
    ],
  },
  {
    slug: "popover",
    name: "Popover",
    sets: [
      // The Basic demo's header and Fields, without and with the `showArrow` arrow.
      { key: "popover-content", name: "Popover content", variants: 2, previewed: 2 },
      // Below the outline Button trigger.
      { key: "popover-open", name: "Popover (open)", variants: 1, previewed: 1 },
    ],
  },
  {
    slug: "dropdown-menu",
    name: "Dropdown menu",
    sets: [
      // Default and destructive, plain and inset, at rest, highlighted, focused and disabled, then one
      // with its Shortcut off and one with its Icon on.
      { key: "dropdown-menu-item", name: "Dropdown menu item", variants: 16, previewed: 18 },
      // Checked off and on, at rest, highlighted, focused and disabled.
      { key: "dropdown-menu-checkbox-item", name: "Dropdown menu checkbox item", variants: 8, previewed: 8 },
      { key: "dropdown-menu-radio-item", name: "Dropdown menu radio item", variants: 8, previewed: 8 },
      // At rest, highlighted, focused, open and disabled.
      { key: "dropdown-menu-sub-trigger", name: "Dropdown menu sub trigger", variants: 5, previewed: 5 },
      // The Basic, Checkboxes, Radio group, Destructive and Submenu demos' popups.
      { key: "dropdown-menu-popup", name: "Dropdown menu popup", variants: 5, previewed: 5 },
      // The Submenu demo's submenu.
      { key: "dropdown-menu-sub-content", name: "Dropdown menu sub content", variants: 1, previewed: 1 },
      // Below the outline Button trigger, the Basic demo's popup.
      { key: "dropdown-menu-open", name: "Dropdown menu (open)", variants: 1, previewed: 1 },
      // The Submenu demo's popup, its submenu open beside the sub trigger.
      {
        key: "dropdown-menu-submenu-open",
        name: "Dropdown menu submenu (open)",
        variants: 1,
        previewed: 1,
      },
    ],
  },
  {
    slug: "combobox",
    name: "Combobox",
    sets: [
      // Selected off and on, at rest, highlighted and disabled.
      { key: "combobox-item", name: "Combobox item", variants: 6, previewed: 6 },
      // The message while no row matches.
      { key: "combobox-empty", name: "Combobox empty", variants: 1, previewed: 1 },
      // The Basic demo's rows, the Groups demo's groups, and no match.
      { key: "combobox-popup", name: "Combobox popup", variants: 3, previewed: 3 },
      // The input with the Basic demo's popup open below it.
      { key: "combobox-open", name: "Combobox (open)", variants: 1, previewed: 1 },
      // A chip at rest and in a disabled Combobox.
      { key: "combobox-chip", name: "Combobox chip", variants: 2, previewed: 2 },
      // The Multiple demo's chips field at both sizes, at rest, focused, disabled and invalid.
      { key: "combobox-chips", name: "Combobox chips", variants: 8, previewed: 8 },
    ],
  },
  {
    slug: "command",
    name: "Command",
    sets: [
      // No trailing part, a shortcut and a caret, at rest, highlighted and disabled.
      { key: "command-item", name: "Command item", variants: 9, previewed: 9 },
      // The docs Groups demo's list.
      { key: "command-list", name: "Command list", variants: 1, previewed: 1 },
      // The docs Dialog demo's palette, open.
      { key: "command-palette", name: "Command palette", variants: 1, previewed: 1 },
      // The palette over the scrim, near the top of the viewport.
      { key: "command-dialog-open", name: "Command dialog (open)", variants: 1, previewed: 1 },
    ],
  },
  // The default, outline and dashed outline frames, then one each with Media off, Description off and
  // Actions on.
  { slug: "empty", name: "Empty", sets: [{ key: "empty", name: "Empty", variants: 3, previewed: 6 }] },
  // 6 variants at 3 underlines (always, hover and none) and 2 weights (normal and bold), in 3 states
  // (rest, hover and focus): 108 variants.
  { slug: "link", name: "Link", sets: [{ key: "link", name: "Link", variants: 108, previewed: 108 }] },
  {
    slug: "item",
    name: "Item",
    sets: [
      // 3 variants at 3 sizes, without and with a description, with icon and image media, then one with
      // Media off and one with Actions off.
      { key: "item", name: "Item", variants: 36, previewed: 38 },
      // The default and outline link rows in 4 states, and one with Media off.
      { key: "item-link", name: "Item link", variants: 8, previewed: 9 },
    ],
  },
  // 5 tones without and with a description, and one with its Action on.
  { slug: "alert", name: "Alert", sets: [{ key: "alert", name: "Alert", variants: 10, previewed: 11 }] },
  {
    slug: "accordion",
    name: "Accordion",
    // 2 variants at 3 radii, closed and open, in 4 states.
    sets: [{ key: "accordion-item", name: "Accordion item", variants: 48, previewed: 48 }],
  },
  {
    slug: "sidebar",
    name: "Sidebar",
    sets: [
      // 2 variants at 3 sizes, expanded and collapsed, inactive and active, in 4 states.
      { key: "sidebar-menu-button", name: "Sidebar menu button", variants: 96, previewed: 96 },
      // 2 sizes, inactive and active, in 4 states.
      { key: "sidebar-menu-sub-button", name: "Sidebar menu sub button", variants: 16, previewed: 16 },
      // At rest alone.
      { key: "sidebar-group-label", name: "Sidebar group label", variants: 1, previewed: 1 },
      // At rest, beside a hovered menu button and beside an active one.
      { key: "sidebar-menu-badge", name: "Sidebar menu badge", variants: 3, previewed: 3 },
      // Expanded and collapsed, outside and inside a floating surface.
      { key: "sidebar-group", name: "Sidebar group", variants: 4, previewed: 4 },
      // Expanded and collapsed, outside and inside a floating surface.
      { key: "sidebar-header", name: "Sidebar header", variants: 4, previewed: 4 },
      // Expanded and collapsed, outside and inside a floating surface.
      { key: "sidebar-footer", name: "Sidebar footer", variants: 4, previewed: 4 },
      // The rich menu demo's three sub rows.
      { key: "sidebar-menu-sub", name: "Sidebar sub menu", variants: 1, previewed: 1 },
      // Inactive and active.
      {
        key: "sidebar-menu-item-with-badge",
        name: "Sidebar menu item with badge",
        variants: 2,
        previewed: 2,
      },
      // The sidebar, inset and floating variants, expanded and collapsed.
      { key: "sidebar", name: "Sidebar", variants: 6, previewed: 6 },
    ],
  },
  {
    slug: "navigation-menu",
    name: "Navigation menu",
    sets: [
      // 4 states, closed and open.
      { key: "navigation-menu-bar-trigger", name: "Navigation menu bar trigger", variants: 8, previewed: 8 },
      // 4 states, closed and open.
      {
        key: "navigation-menu-vertical-trigger",
        name: "Navigation menu vertical trigger",
        variants: 8,
        previewed: 8,
      },
      // 3 states, inactive and active.
      { key: "navigation-menu-bar-link", name: "Navigation menu bar link", variants: 6, previewed: 6 },
      // 3 states, inactive and active.
      { key: "navigation-menu-row-link", name: "Navigation menu row link", variants: 6, previewed: 6 },
      // The Basic demo's two popups, Customers and Business.
      { key: "navigation-menu-popup", name: "Navigation menu popup", variants: 2, previewed: 2 },
    ],
  },
  {
    slug: "number-field",
    name: "Number field",
    sets: [
      // The increase stepper at rest, hovered, disabled and read-only.
      { key: "number-field-stepper", name: "Number field stepper", variants: 4, previewed: 4 },
      // The labelled field in 6 states, and one with its Denomination on.
      { key: "number-field", name: "Number field", variants: 6, previewed: 7 },
    ],
  },
  {
    slug: "file-upload",
    name: "File upload",
    sets: [
      // The Compact demo's dropzone at rest, hovered, focused, as a drop target and disabled.
      { key: "file-upload-dropzone", name: "File upload dropzone", variants: 5, previewed: 5 },
    ],
  },
  {
    slug: "toolbar",
    name: "Toolbar",
    sets: [
      // The Basic demo's bar, horizontal and vertical.
      { key: "toolbar", name: "Toolbar", variants: 2, previewed: 2 },
    ],
  },
  {
    slug: "tooltip",
    name: "Tooltip",
    sets: [
      // The Basic demo's popup, its arrow on each side.
      { key: "tooltip-content", name: "Tooltip content", variants: 4, previewed: 4 },
      // The popup open on each side of its ghost icon Button trigger.
      { key: "tooltip-open", name: "Tooltip (open)", variants: 4, previewed: 4 },
    ],
  },
  {
    slug: "alert-dialog",
    name: "Alert dialog",
    sets: [
      // The popup: destructive and neutral, at rest and performing the action, at 4 sizes.
      { key: "alert-dialog-content", name: "Alert dialog content", variants: 16, previewed: 16 },
      // The destructive popup over the scrim.
      { key: "alert-dialog-open", name: "Alert dialog (open)", variants: 1, previewed: 1 },
    ],
  },
  {
    slug: "dialog",
    name: "Dialog",
    sets: [
      // The popup: the Basic demo's and the Footer close demo's, at 4 sizes.
      { key: "dialog-content", name: "Dialog content", variants: 8, previewed: 8 },
      // The Basic popup over the scrim.
      { key: "dialog-open", name: "Dialog (open)", variants: 1, previewed: 1 },
    ],
  },
  // The default demo's vertical card at the default and the lg size.
  { slug: "card", name: "Card", sets: [{ key: "card", name: "Card", variants: 2, previewed: 2 }] },
  // The default demo's Frame in its gutter layout: a header, three panels and a footer.
  { slug: "frame", name: "Frame", sets: [{ key: "frame", name: "Frame", variants: 1, previewed: 1 }] },
  // The default demo's bar over two selected rows.
  {
    slug: "action-bar",
    name: "Action bar",
    sets: [{ key: "action-bar", name: "Action bar", variants: 1, previewed: 1 }],
  },
  {
    slug: "sheet",
    name: "Sheet",
    sets: [
      // The "No close button" demo's panel on the right side, and again with the `Close` property on.
      { key: "sheet-content", name: "Sheet content", variants: 1, previewed: 2 },
      // The panel over the scrim, against the right edge.
      { key: "sheet-open", name: "Sheet (open)", variants: 1, previewed: 1 },
    ],
  },
  // One day of the month grid, by where it sits in the selection, its state, whether it is outside and
  // whether it is today, and the default demos' months of Calendar and RangeCalendar around it.
  {
    slug: "calendar",
    name: "Calendar",
    sets: [
      { key: "calendar-day", name: "Calendar day", variants: 76, previewed: 76 },
      { key: "calendar", name: "Calendar", variants: 1, previewed: 1 },
      { key: "range-calendar", name: "Range calendar", variants: 1, previewed: 1 },
    ],
  },
  // The labelled field, empty or filled, in the field box's five states.
  {
    slug: "date-field",
    name: "Date field",
    sets: [{ key: "date-field", name: "Date field", variants: 10, previewed: 10 }],
  },
  // The labelled picker, closed, empty or filled, in the field box's five states.
  {
    slug: "date-picker",
    name: "Date picker",
    sets: [{ key: "date-picker", name: "Date picker", variants: 10, previewed: 10 }],
  },
  // The labelled range picker, closed, empty or holding the range, in the field box's five states.
  {
    slug: "date-range-picker",
    name: "Date range picker",
    sets: [{ key: "date-range-picker", name: "Date range picker", variants: 10, previewed: 10 }],
  },
  {
    slug: "tabs",
    name: "Tabs",
    sets: [
      // The trigger in the list's 2 variants and 5 states.
      { key: "tabs-trigger", name: "Tabs trigger", variants: 10, previewed: 10 },
      // The default demo's list in its 2 variants.
      { key: "tabs-list", name: "Tabs list", variants: 2, previewed: 2 },
      // The default demo's first panel, at rest and focused.
      { key: "tabs-content", name: "Tabs content", variants: 2, previewed: 2 },
    ],
  },
  // The docs default demo's three events, each item's connector and dot drawn by its place, and the
  // links demo's two events, each description ending in an underlined link.
  {
    slug: "timeline-list",
    name: "Timeline list",
    sets: [
      { key: "timeline-list", name: "Timeline list", variants: 1, previewed: 1 },
      { key: "timeline-list-links", name: "Timeline list links", variants: 1, previewed: 1 },
    ],
  },
  // The docs default demo's row, its Checkbox beside its title and description in a two-column grid.
  {
    slug: "selection-item",
    name: "Selection item",
    sets: [{ key: "selection-item", name: "Selection item", variants: 1, previewed: 1 }],
  },
  // Each docs demo's frame, one per ratio, at the demo's width, holding the portrait.
  {
    slug: "aspect-ratio",
    name: "Aspect ratio",
    sets: [{ key: "aspect-ratio", name: "Aspect ratio", variants: 7, previewed: 7 }],
  },
  // The docs default demo's two lines, each token in its highlight color.
  {
    slug: "code",
    name: "Code",
    sets: [{ key: "code", name: "Code", variants: 1, previewed: 1 }],
  },
  // The building blocks of the docs default demo's table: its first head and first cell, its header,
  // body and last body rows, hovered or not and selected or not, and its caption. Then the same table
  // as a Frame's item: its first cell at each column of the body's first, a middle and its last row,
  // its header row of three Table head instances, those three body rows, and its body of two rows.
  // The header row previews once, since selection and hover leave it as it is, and a selected body
  // row previews at rest, since hover leaves its fill as it is.
  {
    slug: "table",
    name: "Table",
    sets: [
      { key: "table-head", name: "Table head", variants: 1, previewed: 1 },
      { key: "table-cell", name: "Table cell", variants: 1, previewed: 1 },
      { key: "table-row", name: "Table row", variants: 12, previewed: 12 },
      { key: "table-caption", name: "Table caption", variants: 1, previewed: 1 },
      { key: "frame-table-cell", name: "Frame table cell", variants: 9, previewed: 9 },
      { key: "frame-table-row", name: "Frame table row", variants: 16, previewed: 10 },
      { key: "frame-table-body", name: "Frame table body", variants: 1, previewed: 1 },
    ],
  },
  // The docs default demo's row at each size, at rest, waiting to upload, failed, uploading and
  // processing.
  {
    slug: "attachment",
    name: "Attachment",
    sets: [{ key: "attachment", name: "Attachment", variants: 15, previewed: 15 }],
  },
  // The docs default demo's first Item, first or after another, with dividers or without, and the
  // demo's list of five Items with dividers or without.
  {
    slug: "description-list",
    name: "Description list",
    sets: [
      { key: "description-list-item", name: "Description list item", variants: 4, previewed: 4 },
      { key: "description-list", name: "Description list", variants: 2, previewed: 2 },
    ],
  },
  // The docs default demo's card, unchecked and checked, at rest, focused and disabled, in each variant.
  {
    slug: "checkbox-card",
    name: "Checkbox card",
    sets: [{ key: "checkbox-card", name: "Checkbox card", variants: 12, previewed: 12 }],
  },
  {
    slug: "list-detail",
    name: "List detail",
    sets: [
      // The docs default demo's detail pane, then the whole demo around it, each with nothing
      // selected and with the first customer.
      { key: "list-detail-pane", name: "List detail pane", variants: 2, previewed: 2 },
      { key: "list-detail", name: "List detail", variants: 2, previewed: 2 },
      // The overlay layout's Sheet with the first customer, and that Sheet over its scrim.
      { key: "list-detail-sheet", name: "List detail sheet", variants: 1, previewed: 1 },
      { key: "list-detail-open", name: "List detail (open)", variants: 1, previewed: 1 },
    ],
  },
  // The default demo's filter bar at rest, its Trigger beside the empty chip strip.
  {
    slug: "data-table-filter",
    name: "Data table filter",
    sets: [{ key: "data-table-filter-bar", name: "Data table filter bar", variants: 2, previewed: 2 }],
  },
  // The Beacon demo's tip: its title beside Close, its description and Done. The default demo's step
  // card at its first step: progress beside Close, title, description, Skip, Back and Next.
  {
    slug: "tour",
    name: "Tour",
    sets: [
      { key: "tour-popup", name: "Tour popup", variants: 1, previewed: 1 },
      { key: "tour-step", name: "Tour step", variants: 1, previewed: 1 },
    ],
  },
  // The default demo's toast in each of its six statuses.
  {
    slug: "toast",
    name: "Toast",
    sets: [{ key: "toast", name: "Toast", variants: 6, previewed: 6 }],
  },
];

/** The four Fjordkraft private themes each component page previews, in frame order. */
const PREVIEW_THEMES = [
  { key: "neutral-fkas-private-light", name: "Fjordkraft neutral private, light" },
  { key: "neutral-fkas-private-dark", name: "Fjordkraft neutral private, dark" },
  { key: "branded-fkas-private-light", name: "Fjordkraft branded private, light" },
  { key: "branded-fkas-private-dark", name: "Fjordkraft branded private, dark" },
] as const;

/**
 * A component page's key.
 *
 * @param page - The page.
 * @returns The key, such as `page/button`.
 */
export function pageKey(page: InventoryPage): string {
  return `page/${page.slug}`;
}

/**
 * The component page with a slug.
 *
 * @param slug - The page's slug, such as `badge`.
 * @returns The page.
 * @throws When no page has the slug.
 */
export function inventoryPage(slug: string): InventoryPage {
  const page = KIT_PAGES.find((candidate) => candidate.slug === slug);
  if (page === undefined) {
    throw new Error(`the kit inventory has no page ${slug}`);
  }
  return page;
}

/**
 * The previews on a component page, in frame order.
 *
 * @param page - The page.
 * @returns Each preview's key, such as `preview/button/neutral-fkas-private-light`, and name, such
 *   as `Button / Fjordkraft neutral private, light`.
 */
export function previewsOn(page: InventoryPage): readonly { readonly key: string; readonly name: string }[] {
  return PREVIEW_THEMES.map((theme) => ({
    key: `preview/${page.slug}/${theme.key}`,
    name: `${page.name} / ${theme.name}`,
  }));
}

/**
 * How many instances each preview on a page places, over all its sets.
 *
 * @param page - The page.
 * @returns The instance count.
 */
export function previewedOn(page: InventoryPage): number {
  return page.sets.reduce((sum, set) => sum + set.previewed, 0);
}
