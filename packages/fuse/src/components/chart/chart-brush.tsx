"use client";

import type { ReactElement, ReactNode } from "react";

import { useChartRoot } from "./chart-context";
import type { ChartLayerProps, XFormat } from "./chart-types";
import { ChartCompositionError } from "./layout/errors";
import { isLinearScale } from "./layout/slot-scale";

/**
 * Props for `Chart.Brush`, a closed part.
 *
 * @beta
 */
export type ChartBrushProps = ChartLayerProps & {
  /** The group's name. Defaults to the dictionary's "Periode". */
  "aria-label"?: string;
  /** The start thumb's name, joined to the group name. Defaults to the dictionary's "fra". */
  startLabel?: string;
  /** The end thumb's name, joined to the group name. Defaults to the dictionary's "til". */
  endLabel?: string;
  /** The pan window's name. Defaults to the dictionary's "Flytt periode". */
  windowLabel?: string;
  /** The smallest window, in slots. Defaults to `2`. */
  minSpan?: number;
  /**
   * The thumbs' value text format. Defaults to Root's label preset. For intervals finer than a
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
 * value text. It windows a time or category axis, slot by slot.
 *
 * @throws A `ChartCompositionError` of rule `brush-needs-slot-axis` under `xScale="linear"`, whose
 *   rows are numbers rather than slots of one step. A brush over a linear axis is open work, tracked
 *   in #703.
 * @beta
 */
export function ChartBrush(_props: ChartBrushProps): ReactElement {
  const { xScale } = useChartRoot("Chart.Brush");
  if (isLinearScale(xScale)) {
    throw new ChartCompositionError(
      "Chart.Brush",
      "brush-needs-slot-axis",
      'draws under xScale="linear", which a brush cannot window yet. Leave the brush out, or pass xRange on Chart.Root to show part of the x domain.'
    );
  }
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
