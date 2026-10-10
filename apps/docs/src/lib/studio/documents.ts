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

/** One studio page's document: its artboards and what the page adds to the editor. */
type StudioPageDocument = {
  readonly href: string;
  readonly artboards: readonly ArtboardSpec[];
  /** The token section the inspector stacks first and opens on this page. */
  readonly leadSection?: SectionId;
  /** The page offers the corner X-ray overlay. */
  readonly cornerXray?: boolean;
};

/** Each studio page's document. The Layers list, the canvas and the inspector read it. */
const STUDIO_DOCUMENTS: readonly StudioPageDocument[] = [
  { href: "/studio", artboards: OVERVIEW_ARTBOARDS },
  { href: "/studio/density", artboards: DENSITY_ARTBOARDS },
  { href: "/studio/shape", artboards: CORNER_PAGE_ARTBOARDS, leadSection: "shape", cornerXray: true },
];

const NO_ARTBOARDS: readonly ArtboardSpec[] = [];

function documentAt(pathname: string): StudioPageDocument | undefined {
  return STUDIO_DOCUMENTS.find((document) => document.href === pathname);
}

/** The artboards of the studio page at `pathname`, none for a path the studio does not serve. */
export function artboardsFor(pathname: string): readonly ArtboardSpec[] {
  return documentAt(pathname)?.artboards ?? NO_ARTBOARDS;
}

/** The token section the page at `pathname` leads its inspector with, if it names one. */
export function leadSectionFor(pathname: string): SectionId | undefined {
  return documentAt(pathname)?.leadSection;
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
