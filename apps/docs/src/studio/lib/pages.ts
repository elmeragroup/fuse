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
  {
    href: "/studio/screens",
    label: "Screens",
    title: "Theme studio · Screens",
    description:
      "Whole product screens in the base theme's external and internal looks: self-service, an admin table, a checkout form and a settings dialog.",
  },
];

/** The studio page at `href`; throws when the manifest has none, so a stale route fails the build. */
export function requireStudioPage(href: string): StudioPage {
  const page = STUDIO_PAGES.find((candidate) => candidate.href === href);
  if (page === undefined) {
    throw new Error(`${href} is not in the studio page manifest (src/studio/lib/pages.ts)`);
  }
  return page;
}
