/**
 * How `figma:compare` renders each kit definition's cells: one renderer per definition, which turns
 * a cell into the real Fuse element. The page measures, forces and crops the element's root part,
 * the slot's direct child whose `data-slot` is the definition's `slot`. A renderer sets the states
 * the markup draws, such as disabled or pending, through the element's props. The page forces hover
 * and focus itself.
 *
 * A renderer's element comes from a module that imports the Fuse build, which exists only after
 * `pnpm --filter @elmeragroup/fuse build`. This module lists each renderer's set and the build
 * entry its module imports, so `page-assets.ts` can check the build first, and imports the
 * modules only in {@link loadRenderers}.
 *
 * To compare a new definition, add a module beside this one whose renderings build its element,
 * and list it below with the definition's key and its `dist/` entry.
 */

import type { ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";

import type { Cell } from "../components/component-spec.ts";

/** Renders the cells of one kit definition with the real Fuse component. */
export type CellRenderer = {
  /** The key of the kit definition whose cells it renders, such as `button`. */
  readonly set: string;
  /** The Fuse build output `element` imports, which the run checks for before loading it. */
  readonly entry: `dist/${string}.js`;
  /** The real Fuse element for a parsed cell, with the states the markup draws set by props. */
  readonly element: (cell: Cell) => ReactElement;
};

/** The part of a renderer its own module defines, beside its import of the Fuse build. */
export type CellRendering = Pick<CellRenderer, "element">;

type RendererSource = Pick<CellRenderer, "set" | "entry"> & {
  readonly load: () => Promise<CellRendering>;
};

const SOURCES: readonly RendererSource[] = [
  {
    set: "button",
    entry: "dist/button.js",
    load: async () => (await import("./button-cell.ts")).labelButton,
  },
  {
    set: "icon-button",
    entry: "dist/button.js",
    load: async () => (await import("./button-cell.ts")).iconButton,
  },
];

/** The Fuse build output each renderer imports, with repeats where renderers share one. */
export const RENDERER_ENTRIES: readonly string[] = SOURCES.map((source) => source.entry);

/**
 * Load every renderer. Each one imports the Fuse build, so call this only after
 * `locateFuseBuild` found it.
 *
 * @returns Each renderer, by the key of the definition it renders.
 */
export async function loadRenderers(): Promise<ReadonlyMap<string, CellRenderer>> {
  const renderers = await Promise.all(
    SOURCES.map(async ({ load, ...source }): Promise<CellRenderer> => ({ ...source, ...(await load()) }))
  );
  return new Map(renderers.map((renderer) => [renderer.set, renderer]));
}

/**
 * Render a cell to static HTML. The page needs no hydration: CSS draws every state, and the
 * page forces hover and focus as pseudo classes.
 *
 * @param renderer - The cell's renderer, or the rendering its module defines.
 * @param cell - The parsed cell.
 * @returns The element as an HTML string.
 */
export function renderCellHtml(renderer: CellRendering, cell: Cell): string {
  return renderToStaticMarkup(renderer.element(cell));
}
