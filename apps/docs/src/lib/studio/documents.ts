import type { Density } from "@elmeragroup/fuse/theme";

/** The scheme one artboard renders in, whatever the visitor's preference or the chrome's. */
export type ArtboardScheme = "light" | "dark";

/** One artboard on a studio page's canvas, placed in world units. Its height follows its content. */
export type ArtboardSpec = {
  /** Unique across the studio, so per-artboard settings survive a page switch. */
  readonly id: string;
  /** The name the label above the artboard and the Layers list show. */
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** The scheme and density it opens with; the inspector changes both. */
  readonly scheme: ArtboardScheme;
  readonly density: Density;
};

const COMPONENT_BOARD_WIDTH = 560;
const COLUMN = COMPONENT_BOARD_WIDTH + 120;
const ROW = 1240;

/** The Overview page: the components in four scheme × density pairs, and the theme at a glance. */
export const OVERVIEW_ARTBOARDS: readonly ArtboardSpec[] = [
  {
    id: "components-light-comfortable",
    name: "Components · Light · Comfortable",
    x: 0,
    y: 0,
    width: COMPONENT_BOARD_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
  {
    id: "components-dark-comfortable",
    name: "Components · Dark · Comfortable",
    x: COLUMN,
    y: 0,
    width: COMPONENT_BOARD_WIDTH,
    scheme: "dark",
    density: "comfortable",
  },
  {
    id: "components-light-dense",
    name: "Components · Light · Dense",
    x: 0,
    y: ROW,
    width: COMPONENT_BOARD_WIDTH,
    scheme: "light",
    density: "dense",
  },
  {
    id: "components-dark-dense",
    name: "Components · Dark · Dense",
    x: COLUMN,
    y: ROW,
    width: COMPONENT_BOARD_WIDTH,
    scheme: "dark",
    density: "dense",
  },
  {
    id: "theme-at-a-glance",
    name: "Theme at a glance",
    x: 2 * COLUMN,
    y: 0,
    width: 640,
    scheme: "light",
    density: "comfortable",
  },
];

const TWIN_WIDTH = 560;
const TWIN_COLUMN = TWIN_WIDTH + 120;
const LADDER_WIDTH = 640;
const LADDER_X = 2 * TWIN_COLUMN;

/**
 * The Density page: one composition as dense and comfortable twins, top-aligned, then the
 * control size ladder at both densities. {@link DENSITY_TWINS} pairs the twins.
 */
export const DENSITY_ARTBOARDS: readonly ArtboardSpec[] = [
  {
    id: "density-twin-dense",
    name: "Twin · Dense",
    x: 0,
    y: 0,
    width: TWIN_WIDTH,
    scheme: "light",
    density: "dense",
  },
  {
    id: "density-twin-comfortable",
    name: "Twin · Comfortable",
    x: TWIN_COLUMN,
    y: 0,
    width: TWIN_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
  {
    id: "density-ladder-dense",
    name: "Control sizes · Dense",
    x: LADDER_X,
    y: 0,
    width: LADDER_WIDTH,
    scheme: "light",
    density: "dense",
  },
  {
    id: "density-ladder-comfortable",
    name: "Control sizes · Comfortable",
    x: LADDER_X + LADDER_WIDTH + 120,
    y: 0,
    width: LADDER_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
];

/** The Density page's twin artboards: the same composition, so a part in one has its twin. */
export const DENSITY_TWINS = ["density-twin-dense", "density-twin-comfortable"] as const;

/** Each studio page's artboards. The Layers list and the canvas both read it. */
const STUDIO_DOCUMENTS = [
  { href: "/studio", artboards: OVERVIEW_ARTBOARDS },
  { href: "/studio/density", artboards: DENSITY_ARTBOARDS },
] as const;

const NO_ARTBOARDS: readonly ArtboardSpec[] = [];

/** The artboards of the studio page at `pathname`, none for a path the studio does not serve. */
export function artboardsFor(pathname: string): readonly ArtboardSpec[] {
  return STUDIO_DOCUMENTS.find((document) => document.href === pathname)?.artboards ?? NO_ARTBOARDS;
}
