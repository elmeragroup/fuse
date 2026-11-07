"use client";

/**
 * The radar's RadiusAxis: the ring values beside the first spoke, or the opposite one when the
 * series leave that more room, each shown only where it clears its neighbours, the series and the
 * spoke labels. The first paint draws it at rest (D18), and only a chart nothing painted before
 * fades its labels in as the entrance starts.
 */
import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { RadarDrawing } from "./chart-polar-context";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { labelBound } from "./layout/label-bound";
import { polarPoint } from "./layout/polar-angle";
import { radarRadius, spokeAngle } from "./layout/radar";
import { fitRingLabels, ringAnchor } from "./layout/ring-labels";
import type { MarkCover } from "./layout/ring-labels";
import { percent, spokeLabelFit } from "./radar-chart-dial";

/**
 * Props for `RadarChart.RadiusAxis`, a closed part.
 *
 * @beta
 */
export type RadarChartRadiusAxisProps = ChartLayerProps & {
  /** The tick label format. The first series' `format` is the default. */
  format?: ValueFormat;
};

/** How near a series' edge or vertex a point counts as covered, in CSS pixels: half the stroke and a dot. */
const EDGE_REACH = 4;

/** Whether a radar's series at rest cover a point: within reach of any polygon edge or vertex. */
function radarCover(radar: RadarDrawing): MarkCover {
  const radius = radarRadius(radar.domain, 1);
  return (x, y, dial) =>
    radar.series.some((series) => {
      const points = series.values.map((value, index) =>
        value === null ? null : polarPoint(spokeAngle(index, radar.count), radius(value))
      );
      return points.some((point, index) => {
        if (point === null) return false;
        const next = points[(index + 1) % points.length] ?? null;
        const ax = point.x * dial;
        const ay = point.y * dial;
        if (next === null) return Math.hypot(x - ax, y - ay) <= EDGE_REACH;
        return segmentDistance(x, y, ax, ay, next.x * dial, next.y * dial) <= EDGE_REACH;
      });
    });
}

/** A point's distance from a segment. */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/**
 * The ring values beside the first spoke, each on its ring, 0 among them when the domain spans it,
 * or beside the opposite spoke when the series leave that more room. A value shows only at the
 * widths where it clears its neighbours, the series' edges and dots, and the spoke labels the
 * AngleAxis shows, so a crowded radar shows fewer values, or none.
 *
 * @beta
 */
export function RadarChartRadiusAxis({ format, className, style }: RadarChartRadiusAxisProps): ReactElement {
  const { model, box } = usePolarContext("RadarChart.RadiusAxis", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.RadiusAxis");
  const { locale } = useLocale();
  const radius = radarRadius(radar.domain, 1);
  // Values stay clear of the spoke labels the axis shows past the rim, of the series' edges and
  // dots, and off the centre, along whichever of 12 and 6 o'clock leaves them more room. Each width
  // is the label's bound, the widest any common sans draws it, since the page picks the font.
  const spokes = spokeLabelFit(radar);
  const values = radar.ticks.map((tick) => ({
    radius: radius(tick),
    width: labelBound(formatValue(locale, tick, format ?? radar.format, "tick").text),
  }));
  const clearance = {
    inner: 0,
    angles: radar.labels.map((label, index) => ({
      angle: spokeAngle(index, radar.count),
      width: labelBound(label.text),
      shownAt: spokes[index] ?? "none",
    })),
    marks: radarCover(radar),
  };
  const anchor = ringAnchor(values, clearance);
  const shown = fitRingLabels(values, { ...clearance, anchor });
  return (
    <div
      data-slot="radar-chart-radius-axis"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {radar.ticks.map((tick, index) => {
        const [left, top] = percent(box, 0, anchor === 180 ? radius(tick) : -radius(tick));
        const min = shown[index] ?? "none";
        return (
          <span
            key={tick}
            data-slot="radar-chart-radius-label"
            data-min={min === "none" ? undefined : min}
            data-hidden={min === "none" ? "" : undefined}
            style={{ "--_x": left, "--_y": top, "--chart-slot": index }}>
            {formatValue(locale, tick, format ?? radar.format, "tick").text}
          </span>
        );
      })}
    </div>
  );
}

Object.assign(RadarChartRadiusAxis, { displayName: "RadarChart.RadiusAxis" });
