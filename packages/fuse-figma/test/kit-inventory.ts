/**
 * The kit's pages as a reviewer writes them down: each component page's key and name, the
 * component sets on it in the order the plugin places them, with each set's variant count and the
 * instances each preview places, and the four previews every page holds. The suites that apply the
 * kit end to end and the built-kit suite build their expected page, set, preview and change lists
 * from it. It never reads `KIT` or `buildKit()`, so it stays the oracle those lists check the kit
 * against. A new set takes one row here.
 */

/** A component set as the kit places it on its page. */
export type InventorySet = {
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
      // 7 variants in 5 states, and 7 at each of 3 other sizes.
      { key: "icon-button", name: "Icon button", variants: 140, previewed: 56 },
      // 2 variants in 4 states, armed off and on, and 2 at each of 3 other sizes.
      { key: "confirm-button", name: "Confirm button", variants: 64, previewed: 22 },
    ],
  },
  {
    slug: "toggle",
    name: "Toggle",
    sets: [
      // 2 variants in 4 states off and on, 2 at each of 3 other sizes, and 2 with each of 2 icons.
      { key: "toggle", name: "Toggle", variants: 192, previewed: 26 },
      // The same without the icons.
      { key: "icon-toggle", name: "Icon toggle", variants: 64, previewed: 22 },
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
    sets: [
      // 5 sizes, off and on, in 5 states.
      { key: "radio-icon-button", name: "Radio icon button", variants: 50, previewed: 50 },
      // Off and on, in 4 states.
      { key: "radio", name: "Radio", variants: 8, previewed: 8 },
    ],
  },
  // Off, on and mixed, in 4 states.
  {
    slug: "checkbox",
    name: "Checkbox",
    sets: [{ key: "checkbox", name: "Checkbox", variants: 12, previewed: 12 }],
  },
  // 2 sizes, off and on, in 4 states.
  { slug: "switch", name: "Switch", sets: [{ key: "switch", name: "Switch", variants: 16, previewed: 16 }] },
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
      { key: "input", name: "Input", variants: 10, previewed: 10 },
      // Combobox's caret and clear forms and Command's search form, in 4 states.
      { key: "input-group", name: "Input group", variants: 12, previewed: 12 },
    ],
  },
  // Placeholder and value in 5 states.
  {
    slug: "textarea",
    name: "Textarea",
    sets: [{ key: "textarea", name: "Textarea", variants: 10, previewed: 10 }],
  },
  // The fallback and the image at 4 sizes.
  { slug: "avatar", name: "Avatar", sets: [{ key: "avatar", name: "Avatar", variants: 8, previewed: 8 }] },
  // 4 modes at 4 levels.
  { slug: "meter", name: "Meter", sets: [{ key: "meter", name: "Meter", variants: 16, previewed: 16 }] },
  {
    slug: "pagination",
    name: "Pagination",
    sets: [
      // Current off and on, in 3 states.
      { key: "pagination-link", name: "Pagination link", variants: 6, previewed: 6 },
      // Previous and next, in 3 states.
      { key: "pagination-edge", name: "Pagination edge", variants: 6, previewed: 6 },
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
      // The docs Basic demo's trail, and the Ellipsis demo's.
      { key: "breadcrumb-trail", name: "Breadcrumb trail", variants: 2, previewed: 2 },
    ],
  },
  {
    slug: "select",
    name: "Select",
    sets: [
      // 2 sizes in 4 states, holding the placeholder or a value, closed and open.
      { key: "select-trigger", name: "Select trigger", variants: 32, previewed: 32 },
      // The plain caption, and Dropdown menu's Medium caption, plain and inset.
      { key: "menu-group-label", name: "Menu group label", variants: 3, previewed: 3 },
      // The hairline between groups.
      { key: "menu-separator", name: "Menu separator", variants: 1, previewed: 1 },
      // Selected off and on, at rest, highlighted and disabled.
      { key: "select-item", name: "Select item", variants: 6, previewed: 6 },
      // The Basic demo's rows, and the Groups demo's groups.
      { key: "select-popup", name: "Select popup", variants: 2, previewed: 2 },
      // Below the trigger, at the default and the small size.
      { key: "select-open", name: "Select (open)", variants: 2, previewed: 2 },
    ],
  },
  {
    slug: "popover",
    name: "Popover",
    sets: [
      // The Basic demo's header and Fields.
      { key: "popover-content", name: "Popover content", variants: 1, previewed: 1 },
      // Below the outline Button trigger.
      { key: "popover-open", name: "Popover (open)", variants: 1, previewed: 1 },
    ],
  },
  {
    slug: "dropdown-menu",
    name: "Dropdown menu",
    sets: [
      // Default and destructive, plain and inset, at rest, highlighted, focused and disabled.
      { key: "dropdown-menu-item", name: "Dropdown menu item", variants: 16, previewed: 16 },
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
    ],
  },
  // The default, outline and dashed outline frames.
  { slug: "empty", name: "Empty", sets: [{ key: "empty", name: "Empty", variants: 3, previewed: 3 }] },
  // Selected off and on, in 5 states.
  {
    slug: "calendar",
    name: "Calendar",
    sets: [{ key: "calendar-day", name: "Calendar day", variants: 10, previewed: 10 }],
  },
  // 6 variants at 2 weights, in 4 states.
  { slug: "link", name: "Link", sets: [{ key: "link", name: "Link", variants: 48, previewed: 48 }] },
  {
    slug: "item",
    name: "Item",
    sets: [
      // 3 variants at 3 sizes, without and with a description, with icon and image media.
      { key: "item", name: "Item", variants: 36, previewed: 36 },
      // The default and outline link rows in 4 states.
      { key: "item-link", name: "Item link", variants: 8, previewed: 8 },
    ],
  },
  // 5 tones without and with a description.
  { slug: "alert", name: "Alert", sets: [{ key: "alert", name: "Alert", variants: 10, previewed: 10 }] },
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
    ],
  },
];

/** The page that holds the icon library alone, after the component pages. */
export const ICONS_PAGE = { key: "page/icons", name: "Icons" } as const;

/** The four Fjordkraft private themes each component page previews, in frame order. */
const PREVIEW_THEMES = [
  { key: "internal-fkas-private-light", name: "Fjordkraft internal private, light" },
  { key: "internal-fkas-private-dark", name: "Fjordkraft internal private, dark" },
  { key: "external-fkas-private-light", name: "Fjordkraft external private, light" },
  { key: "external-fkas-private-dark", name: "Fjordkraft external private, dark" },
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
 * @returns Each preview's key, such as `preview/button/internal-fkas-private-light`, and name, such
 *   as `Button / Fjordkraft internal private, light`.
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
