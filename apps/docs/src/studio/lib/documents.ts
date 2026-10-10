import type { Density, ThemeVariant } from "@elmeragroup/fuse/theme";

import type { SectionId } from "./tokens";

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
  /**
   * Pins the artboard to one variant of the base theme. The variant owns `--radius-step`, so
   * the artboard wears every token edit but that one.
   */
  readonly variant?: ThemeVariant;
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

const RUNG_BOARD_WIDTH = 560;
const RUNG_COLUMN = RUNG_BOARD_WIDTH + 120;

/** The Shape page: the radius rungs in each variant, the concentric lab and Fuse's own shells. */
export const CORNER_PAGE_ARTBOARDS: readonly ArtboardSpec[] = [
  {
    id: "shape-rungs-internal",
    name: "Radius rungs · Internal",
    x: 0,
    y: 0,
    width: RUNG_BOARD_WIDTH,
    scheme: "light",
    density: "dense",
    variant: "internal",
  },
  {
    id: "shape-rungs-external",
    name: "Radius rungs · External",
    x: RUNG_COLUMN,
    y: 0,
    width: RUNG_BOARD_WIDTH,
    scheme: "light",
    density: "comfortable",
    variant: "external",
  },
  {
    id: "shape-shells",
    name: "Shells in Fuse",
    x: 2 * RUNG_COLUMN,
    y: 0,
    width: 640,
    scheme: "light",
    density: "comfortable",
  },
  {
    id: "shape-concentric-lab",
    name: "Concentric lab",
    x: 0,
    y: 760,
    width: RUNG_COLUMN + RUNG_BOARD_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
];

const PAIR_BOARD_WIDTH = 640;
const PAIR_COLUMN = PAIR_BOARD_WIDTH + 120;
const GAP = 160;
const PAIRS_HEIGHT = 860;
const CHARTS_HEIGHT = 460;
const SIDEBAR_HEIGHT = 610;
const SYNTAX_HEIGHT = 400;

/** A light artboard and its dark twin beside it, as the Color page shows every color board. */
function schemePair(id: string, name: string, x: number, y: number): ArtboardSpec[] {
  return (["light", "dark"] as const).map((scheme, index) => ({
    id: `${id}-${scheme}`,
    name: `${name} · ${scheme === "light" ? "Light" : "Dark"}`,
    x: x + index * PAIR_COLUMN,
    y,
    width: PAIR_BOARD_WIDTH,
    scheme,
    density: "comfortable",
  }));
}

const DETAIL_X = 2 * PAIR_COLUMN;
const SIDEBAR_Y = CHARTS_HEIGHT + GAP;
const SYNTAX_Y = SIDEBAR_Y + SIDEBAR_HEIGHT + GAP;

/**
 * The Color page, in two column pairs, each light beside dark: the role pairs above the status
 * roles, and the charts, sidebar and syntax colors stacked beside them, with the primitives,
 * which hold one value in every theme, below those. The rows follow the boards' laid-out heights.
 */
export const COLOR_PAGE_ARTBOARDS: readonly ArtboardSpec[] = [
  ...schemePair("color-pairs", "Role pairs", 0, 0),
  ...schemePair("color-status", "Status", 0, PAIRS_HEIGHT + GAP),
  ...schemePair("color-charts", "Charts", DETAIL_X, 0),
  ...schemePair("color-sidebar", "Sidebar", DETAIL_X, SIDEBAR_Y),
  ...schemePair("color-syntax", "Syntax", DETAIL_X, SYNTAX_Y),
  {
    id: "color-primitives",
    name: "Primitives",
    x: DETAIL_X,
    y: SYNTAX_Y + SYNTAX_HEIGHT + GAP,
    width: PAIR_BOARD_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
];

/** The token sections that hold colors, in the inspector's order. */
const COLOR_SECTIONS: readonly SectionId[] = [
  "surfaces",
  "actions",
  "status",
  "lines",
  "variant",
  "sidebar",
  "charts",
  "syntax",
];

const TYPE_BOARD_WIDTH = 640;
const TYPE_COLUMN = TYPE_BOARD_WIDTH + 120;
const TYPE_ROW = 960;

/**
 * The Type page: the specimen, the control and label type pairs dense against comfortable, and
 * a line in every font stack the font knobs offer.
 */
export const TYPE_PAGE_ARTBOARDS: readonly ArtboardSpec[] = [
  {
    id: "type-specimen",
    name: "Specimen",
    x: 0,
    y: 0,
    width: TYPE_BOARD_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
  {
    id: "type-pairs-dense",
    name: "Type pairs · Dense",
    x: TYPE_COLUMN,
    y: 0,
    width: TYPE_BOARD_WIDTH,
    scheme: "light",
    density: "dense",
  },
  {
    id: "type-pairs-comfortable",
    name: "Type pairs · Comfortable",
    x: 2 * TYPE_COLUMN,
    y: 0,
    width: TYPE_BOARD_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
  {
    id: "type-stacks",
    name: "Font stacks",
    x: 0,
    y: TYPE_ROW,
    width: TYPE_BOARD_WIDTH,
    scheme: "light",
    density: "comfortable",
  },
];

const SCREEN_WIDTH = 760;
const TABLE_SCREEN_WIDTH = 960;
const SCREEN_COLUMN = SCREEN_WIDTH + 120;
const SCREEN_ROW = 1080;

/**
 * The Screens page: four whole product screens. Each pins a variant, so one page shows the base
 * brand's external and internal looks side by side, and the inspector switches it.
 */
export const SCREENS_PAGE_ARTBOARDS: readonly ArtboardSpec[] = [
  {
    id: "screen-self-service",
    name: "Customer self-service",
    x: 0,
    y: 0,
    width: SCREEN_WIDTH,
    scheme: "light",
    density: "comfortable",
    variant: "external",
  },
  {
    id: "screen-admin-table",
    name: "Internal admin table",
    x: SCREEN_COLUMN,
    y: 0,
    width: TABLE_SCREEN_WIDTH,
    scheme: "light",
    density: "dense",
    variant: "internal",
  },
  {
    id: "screen-checkout",
    name: "Checkout form",
    x: 0,
    y: SCREEN_ROW,
    width: SCREEN_WIDTH,
    scheme: "light",
    density: "comfortable",
    variant: "external",
  },
  {
    id: "screen-settings",
    name: "Settings dialog",
    x: SCREEN_COLUMN,
    y: SCREEN_ROW,
    width: TABLE_SCREEN_WIDTH,
    scheme: "light",
    density: "comfortable",
    variant: "internal",
  },
];

/** One studio page's document: its artboards and what the page adds to the editor. */
type StudioPageDocument = {
  readonly href: string;
  readonly artboards: readonly ArtboardSpec[];
  /** The token sections the inspector stacks first, in order, opening the first on this page. */
  readonly leadSections?: readonly SectionId[];
  /** The page offers the corner X-ray overlay. */
  readonly cornerXray?: boolean;
};

/** Each studio page's document. The Layers list, the canvas and the inspector read it. */
const STUDIO_DOCUMENTS: readonly StudioPageDocument[] = [
  { href: "/studio", artboards: OVERVIEW_ARTBOARDS },
  { href: "/studio/density", artboards: DENSITY_ARTBOARDS },
  { href: "/studio/shape", artboards: CORNER_PAGE_ARTBOARDS, leadSections: ["shape"], cornerXray: true },
  { href: "/studio/color", artboards: COLOR_PAGE_ARTBOARDS, leadSections: COLOR_SECTIONS },
  { href: "/studio/type", artboards: TYPE_PAGE_ARTBOARDS, leadSections: ["typography"] },
  { href: "/studio/screens", artboards: SCREENS_PAGE_ARTBOARDS },
];

const NO_ARTBOARDS: readonly ArtboardSpec[] = [];

function documentAt(pathname: string): StudioPageDocument | undefined {
  return STUDIO_DOCUMENTS.find((document) => document.href === pathname);
}

/** The artboards of the studio page at `pathname`, none for a path the studio does not serve. */
export function artboardsFor(pathname: string): readonly ArtboardSpec[] {
  return documentAt(pathname)?.artboards ?? NO_ARTBOARDS;
}

const NO_SECTIONS: readonly SectionId[] = [];

/** The token sections the page at `pathname` leads its inspector with, in order. */
export function leadSectionsFor(pathname: string): readonly SectionId[] {
  return documentAt(pathname)?.leadSections ?? NO_SECTIONS;
}

const PAGE_PINS: ReadonlyMap<string, readonly ThemeVariant[]> = new Map(
  STUDIO_DOCUMENTS.map(({ href, artboards }) => [
    href,
    artboards.flatMap(({ variant }) => (variant === undefined ? [] : [variant])),
  ])
);

const NO_PINS: readonly ThemeVariant[] = [];

/** The variants the artboards of the page at `pathname` pin, the same array for each call. */
export function pinsFor(pathname: string): readonly ThemeVariant[] {
  return PAGE_PINS.get(pathname) ?? NO_PINS;
}

/** Whether the page at `pathname` offers the corner X-ray. */
export function hasCornerXray(pathname: string): boolean {
  return documentAt(pathname)?.cornerXray === true;
}
