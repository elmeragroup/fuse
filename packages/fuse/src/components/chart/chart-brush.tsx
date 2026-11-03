"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartLayerProps, XFormat } from "./chart-types";

/**
 * Props for `Chart.Brush`, a closed part.
 *
 * @beta
 */
export type ChartBrushProps = ChartLayerProps & {
  /** The group's name. The dictionary's "Periode" is the default. */
  "aria-label"?: string;
  /** Joined to the group name for the start thumb. The dictionary's "fra" is the default. */
  startLabel?: string;
  /** Joined to the group name for the end thumb. The dictionary's "til" is the default. */
  endLabel?: string;
  /** The pan window's name. The dictionary's "Flytt periode" is the default. */
  windowLabel?: string;
  /** The smallest window, in slots. `2` by default. */
  minSpan?: number;
  /**
   * The thumbs' value text format. Root's label preset is the default. For intervals finer than a
   * day, the `date` preset's spoken form leads the slot's spoken label. The year appears when the
   * domain spans more than one calendar year in Root's zone.
   */
  format?: XFormat;
  /** A `BrushPreview` with the marks to draw in the brush track. */
  children?: ReactNode;
};

/**
 * Props for `Chart.BrushPreview`, a closed part.
 *
 * @beta
 */
export type ChartBrushPreviewProps = ChartLayerProps & {
  /** The marks to draw over the whole domain. */
  children?: ReactNode;
};

/**
 * Two thumbs and a pan window that edit Root's `xRange`, as three native range inputs with spoken
 * value text.
 *
 * @beta
 */
export function ChartBrush(_props: ChartBrushProps): ReactElement {
  return <></>;
}

/**
 * The marks drawn small over the whole domain inside the brush track. The preview is its own
 * layout. Its x spans the full domain, and its y domain covers every config key over the full data
 * under the default layout's zero rule, whatever the window or the Panels.
 *
 * @beta
 */
export function ChartBrushPreview(_props: ChartBrushPreviewProps): ReactElement {
  return <></>;
}

Object.assign(ChartBrush, { displayName: "Chart.Brush" });
Object.assign(ChartBrushPreview, { displayName: "Chart.BrushPreview" });
