"use client";

/**
 * A gauge's ruler: ticks along the sweep, a label at each major tick, and every tick the reading has
 * passed brightened, from the offset the Root's loop shows, so the ticks brighten as the fill
 * sweeps past them.
 */
import { useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { useGaugeContext } from "./chart-gauge-context";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { formatUnitless } from "./format/value-format";
import { lightReached, useGaugePainter } from "./gauge-chart-painter";
import type { GaugeDrawing } from "./gauge-chart-painter";
import { GAUGE_RADII, gaugeAngle, reached, rulerSpacing, rulerTicks } from "./layout/gauge";
import type { RulerTick } from "./layout/gauge";
import { polarPoint, viewBoxOf } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { pathNumber } from "./layout/rounding";

/**
 * Props for `GaugeChart.Ruler`, a closed part.
 *
 * @beta
 */
export type GaugeChartRulerProps = ChartLayerProps & {
  /**
   * Where the ruler sits. "inside" draws it inside the track, and "outside" at the rim, where the
   * dial makes room for it and its labels.
   */
  variant?: "inside" | "outside";
  /**
   * The intervals between `min` and `max`, a whole number of 1 or more. By default the domain's
   * round step for about five majors, each split by the step's leading digit, so 0 to 5 kWh takes
   * 25, a tick each 0.2 kWh.
   */
  ticks?: number;
  /** How many intervals one major tick spans, a whole number of 1 or more. Set it with `ticks`. */
  majorEvery?: number;
  /** The labels' number format, without its unit. Root's `valueFormat` by default. */
  format?: ValueFormat;
};

/** Where an inside ruler's labels sit, inside its major ticks and a gap. */
const INSIDE_LABEL = GAUGE_RADII.rulerInside - GAUGE_RADII.majorTick - 0.03;

/** What the ruler lays out from: the sweep and its ticks. */
type RulerLayout = { readonly sweep: Sweep; readonly marks: readonly RulerTick[] };

/** The ruler's drawing: every tick and label the offset has passed brightened. */
function rulerDrawing(layer: HTMLDivElement, { marks }: RulerLayout): GaugeDrawing {
  const reachable = [...layer.querySelectorAll("[data-tick]")].map((node) => ({
    node,
    offset: marks[Number(node.getAttribute("data-tick"))]?.offset ?? Number.POSITIVE_INFINITY,
  }));
  return {
    paint: (offset) => {
      lightReached(reachable, "data-passed", offset);
    },
  };
}

/**
 * The ruler: a tick each interval from `min` to `max`, a longer one and a label at each major, and
 * each tick and label the fill has passed in the foreground role, the rest muted. Labels print the
 * number alone in Root's locale, since the centre names the unit. "inside" hangs the ticks in from
 * inside the track; "outside" stands them at the rim, outside a `Zone` band, with the labels past
 * them.
 *
 * @beta
 */
export function GaugeChartRuler({
  variant = "inside",
  ticks,
  majorEvery,
  format,
  className,
  style,
}: GaugeChartRulerProps): ReactElement {
  const gauge = useGaugeContext("GaugeChart.Ruler");
  const { model } = gauge;
  const { domain, sweep, box } = model.geometry;
  const spacing = useMemo(() => {
    const fallback = rulerSpacing(domain);
    return { ticks: ticks ?? fallback.ticks, majorEvery: majorEvery ?? fallback.majorEvery };
  }, [domain, ticks, majorEvery]);
  const layout = useMemo(
    (): RulerLayout => ({ sweep, marks: rulerTicks(domain, sweep, spacing) }),
    [domain, sweep, spacing]
  );
  const { marks } = layout;
  const labelFormat = format ?? model.format;
  const layer = useRef<HTMLDivElement>(null);
  const firstRest = useGaugePainter(gauge, layer, layout, rulerDrawing);
  const outside = variant === "outside";
  // The ticks stand in from the rim outside, and hang in from inside the track inside.
  const top = outside ? 1 : GAUGE_RADII.rulerInside;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  return (
    <div
      ref={layer}
      data-slot="gauge-chart-ruler"
      data-variant={variant}
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={{
        "--_box-l": box.left,
        "--_box-t": box.top,
        "--_box-w": width,
        "--_box-h": height,
        ...style,
      }}>
      <svg viewBox={viewBoxOf(box)} focusable="false">
        <g data-part="gauge-dial">
          {marks.map((mark, index) => {
            const angle = gaugeAngle(sweep, mark.offset);
            const length = mark.major ? GAUGE_RADII.majorTick : GAUGE_RADII.minorTick;
            const from = polarPoint(angle, top);
            const to = polarPoint(angle, top - length);
            return (
              <line
                key={index}
                data-slot="gauge-chart-tick"
                data-tick={index}
                data-major={mark.major ? "" : undefined}
                data-passed={reached(mark.offset, firstRest) ? "" : undefined}
                x1={pathNumber(from.x)}
                y1={pathNumber(from.y)}
                x2={pathNumber(to.x)}
                y2={pathNumber(to.y)}
              />
            );
          })}
        </g>
      </svg>
      {marks.map((mark, index) => {
        if (!mark.major) return null;
        const angle = gaugeAngle(sweep, mark.offset);
        const at = polarPoint(angle, outside ? 1 : INSIDE_LABEL);
        // The label reads away from its anchor: outward past the rim, inward inside the track.
        const away = polarPoint(angle, outside ? 1 : -1);
        return (
          <span
            key={index}
            data-slot="gauge-chart-ruler-label"
            data-tick={index}
            data-passed={reached(mark.offset, firstRest) ? "" : undefined}
            style={{
              "--_x": pathNumber(at.x),
              "--_y": pathNumber(at.y),
              "--_dx": pathNumber(away.x),
              "--_dy": pathNumber(away.y),
            }}>
            {formatUnitless(model.locale, mark.value, labelFormat).text}
          </span>
        );
      })}
    </div>
  );
}

Object.assign(GaugeChartRuler, { displayName: "GaugeChart.Ruler" });
