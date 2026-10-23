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
  // The text cap and the icon cap.
  { slug: "kbd", name: "Kbd", sets: [{ key: "kbd", name: "Kbd", variants: 2, previewed: 2 }] },
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
  { slug: "input", name: "Input", sets: [{ key: "input", name: "Input", variants: 10, previewed: 10 }] },
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
    ],
  },
  {
    slug: "select",
    name: "Select",
    // 2 sizes in 4 states, holding the placeholder or a value, closed and open.
    sets: [{ key: "select-trigger", name: "Select trigger", variants: 32, previewed: 32 }],
  },
  // The default, outline and dashed outline frames.
  { slug: "empty", name: "Empty", sets: [{ key: "empty", name: "Empty", variants: 3, previewed: 3 }] },
  // Selected off and on, in 5 states.
  {
    slug: "calendar",
    name: "Calendar",
    sets: [{ key: "calendar-day", name: "Calendar day", variants: 10, previewed: 10 }],
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
