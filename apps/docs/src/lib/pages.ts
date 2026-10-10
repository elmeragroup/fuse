/**
 * The non-component half of the site inventory.
 *
 * Component pages are generated from the library and never listed here. These are the
 * two hand-authored groups — Overview and Handbook — and each entry carries the
 * one-line description that the generated `llms.txt` index publishes and the page
 * itself uses as its metadata description. The description lives next to the route so
 * the index has exactly one source and cannot drift from the nav.
 */

/** The two authored SideNav groups. Components is generated, so it is not a member. */
export type StaticNavGroup = "overview" | "handbook";

export type StaticPage = {
  /** Site-relative route. The app directory layout is derived from this. */
  href: string;
  /** SideNav label. */
  label: string;
  /** One-line description, for `llms.txt` and the page's own metadata. */
  description: string;
  group: StaticNavGroup;
};

/** The docs overview. Reachable from the wordmark, indexed by `llms.txt`, not in a nav group. */
export const HOME_PAGE = {
  href: "/docs",
  label: "Fuse",
  description: "Overview of the Fuse docs site: what the library is and how the docs are generated.",
} as const;

/** Every authored Overview and Handbook page, in nav order. */
export const STATIC_PAGES: readonly StaticPage[] = [
  {
    href: "/quick-start",
    label: "Quick start",
    description:
      "Install the library, mount the providers, and the expected app page scaffold — landmarks, skip link and lang.",
    group: "overview",
  },
  {
    href: "/accessibility",
    label: "Accessibility",
    description:
      "The WCAG 2.2 AA design target, the library/app responsibility split, and the accepted deviations.",
    group: "overview",
  },
  {
    href: "/releases",
    label: "Releases",
    description: "How the package is versioned and released, and what counts as a breaking change.",
    group: "overview",
  },
  {
    href: "/about",
    label: "About",
    description: "What Fuse is, who it is for, and the decisions that shape it.",
    group: "overview",
  },
  {
    href: "/handbook/theming",
    label: "Theming",
    description:
      "The three theme axes, how the cascade resolves them, and when to reach for ThemeScope instead of the document provider.",
    group: "handbook",
  },
  {
    href: "/handbook/theme-matrix",
    label: "Theme matrix",
    description: "All 24 legal brand × segment × variant permutations rendered side by side.",
    group: "handbook",
  },
  {
    href: "/handbook/tokens",
    label: "Tokens",
    description:
      "The token reference and the measured bundle size of every published entry against its ceiling.",
    group: "handbook",
  },
  {
    href: "/handbook/brands-and-segments",
    label: "Brands & segments",
    description:
      "The seven brand codes, the two segments, the pinned brands, and the four permutations that are illegal.",
    group: "handbook",
  },
  {
    href: "/handbook/icons",
    label: "Icons",
    description: "The icon system: per-icon exports, sizing, stroke weight and accessible naming.",
    group: "handbook",
  },
  {
    href: "/handbook/localization",
    label: "Localization",
    description:
      "The string-dictionary mechanism, the supported-locale union, override precedence, and a language-switcher recipe.",
    group: "handbook",
  },
  {
    href: "/handbook/llms-txt",
    label: "llms.txt",
    description:
      "The AI-docs surface: the generated llms.txt index and the per-component markdown endpoints.",
    group: "handbook",
  },
];

export function staticPagesIn(group: StaticNavGroup): readonly StaticPage[] {
  return STATIC_PAGES.filter((page) => page.group === group);
}

/** The static page at `href`; throws when the manifest has none, so a stale route fails the build. */
export function requireStaticPage(href: string): StaticPage {
  const page = STATIC_PAGES.find((candidate) => candidate.href === href);
  if (page === undefined) {
    throw new Error(`${href} is not in the docs page manifest (src/lib/pages.ts)`);
  }
  return page;
}

/**
 * A page of the theme studio, the canvas editor under `/studio`. Studio pages live in their own
 * `(studio)` route group, outside the SideNav, and each one is a destination in the ⌘K palette,
 * `llms.txt` and the studio's own Pages list.
 */
export type StudioPage = {
  /** Site-relative route under `/studio`. */
  href: string;
  /** The name the studio's Pages list shows. */
  label: string;
  /** The page title, for search, `llms.txt`, the metadata title and the card. */
  title: string;
  /** One-line description, for `llms.txt`, search and the page's own metadata. */
  description: string;
};

/** Every studio page, in the Pages list's order. A page joins this list when its route ships. */
export const STUDIO_PAGES: readonly StudioPage[] = [
  {
    href: "/studio",
    label: "Overview",
    title: "Theme studio",
    description:
      "A canvas of live Fuse components in every scheme and density, with the base theme's colours, radii and control sizes at a glance.",
  },
  {
    href: "/studio/density",
    label: "Density",
    title: "Theme studio · Density",
    description:
      "The same Fuse screen dense and comfortable side by side, with every density metric to tune and overlays that show which parts read it.",
  },
  {
    href: "/studio/shape",
    label: "Shape",
    title: "Theme studio · Shape",
    description:
      "The radius rungs and concentric inner corners of the base theme, drawn live on real Fuse parts with the numbers on top.",
  },
  {
    href: "/studio/color",
    label: "Color",
    title: "Theme studio · Color",
    description:
      "The base theme's color system in light and dark: role pairs with live contrast, status, charts, sidebar, syntax and the primitives.",
  },
  {
    href: "/studio/type",
    label: "Type",
    title: "Theme studio · Type",
    description:
      "The base theme's font stacks and type pairs: a heading and body specimen, and the control and label sizes dense against comfortable.",
  },
];

/** The studio page at `href`; throws when the manifest has none, so a stale route fails the build. */
export function requireStudioPage(href: string): StudioPage {
  const page = STUDIO_PAGES.find((candidate) => candidate.href === href);
  if (page === undefined) {
    throw new Error(`${href} is not in the studio page manifest (src/lib/pages.ts)`);
  }
  return page;
}

/** The route prefix every component docs page lives under. */
export const COMPONENTS_PREFIX = "/components/";

/**
 * The route of a component's docs page. It lives here rather than in `nav.ts`, which imports the
 * whole component-page manifest, so client modules can build the link without shipping it.
 */
export function componentHref(slug: string): string {
  return `${COMPONENTS_PREFIX}${slug}`;
}
