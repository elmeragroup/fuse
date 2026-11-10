"use client";

import { useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import type { ChartDomProps } from "./chart-types";
import { seriesLabel } from "./format/series-label";
import { assertKnownKey } from "./layout/errors";
import { scatterPaint, useScatterRoot } from "./scatter-chart-context";
import type { ScatterMark } from "./scatter-chart-context";

/**
 * Props for `ScatterChart.Legend`, a `ul` with Base UI's `render`.
 *
 * @beta
 */
export type ScatterChartLegendProps = ChartDomProps<"ul"> & {
  /** Where the legend sits around the plot. "bottom" by default. */
  side?: "top" | "bottom" | "start" | "end";
};

/**
 * Props for `ScatterChart.LegendItem`, an `li` with Base UI's `render`.
 *
 * @beta
 */
export type ScatterChartLegendItemProps = ChartDomProps<"li"> & {
  /** The series of this item. An unknown key throws `unknown-key`. */
  dataKey: string;
};

/**
 * A static list of the series, "bottom" by default. Without children, one LegendItem per config
 * key. The list is visible text, so screen readers read it, and its swatches are decoration.
 *
 * @beta
 */
export function ScatterChartLegend({
  side = "bottom",
  render,
  className,
  children,
  ...props
}: ScatterChartLegendProps): ReactElement {
  const context = useScatterRoot("ScatterChart.Legend");
  const items =
    children ?? Object.keys(context.config).map((key) => <ScatterChartLegendItem key={key} dataKey={key} />);
  return useRender({
    defaultTagName: "ul",
    render,
    props: {
      "data-slot": "chart-legend",
      "data-side": side,
      ...mergeProps<"ul">({ className, children: items }, props),
    },
  });
}

/**
 * A series' swatch in its paint, as decoration: a dot for points, or a short line for a series a
 * Line draws alone, in the quiet, dashed or flowing look its mark draws in.
 *
 * @param props - The paint, the kind of mark the series draws and its look.
 */
export function SeriesSwatch({
  paint,
  kind = "points",
  look = "default",
}: {
  readonly paint: string;
  readonly kind?: ScatterMark["kind"] | undefined;
  readonly look?: ScatterMark["variant"] | undefined;
}): ReactElement {
  return (
    <span
      data-slot="chart-swatch"
      data-variant={kind === "line" ? "line" : "circle"}
      data-look={look === "default" ? undefined : look}
      aria-hidden="true"
      style={{ "--chart-swatch-paint": paint }}
    />
  );
}

/** The server and a hydrating legend read no registered mark, so they draw a dot. */
function noMark(): undefined {
  return undefined;
}

/**
 * One legend entry: a swatch in the look the series draws in, a dot for points and a short line
 * for a line, then the series' label. The swatch follows the parts that draw the series once they
 * mount, so the server draws a dot.
 *
 * @beta
 */
export function ScatterChartLegendItem({
  dataKey,
  render,
  className,
  children,
  ...props
}: ScatterChartLegendItemProps): ReactElement {
  const context = useScatterRoot("ScatterChart.LegendItem");
  assertKnownKey("ScatterChart.LegendItem", context.config, dataKey);
  const { marks } = context;
  // A registration keeps its mark object, so the snapshot changes only when the drawn mark does.
  const mark = useSyncExternalStore(marks.subscribe, () => marks.of(dataKey), noMark);
  const index = context.model.series.findIndex((series) => series.key === dataKey);
  return useRender({
    defaultTagName: "li",
    render,
    props: {
      "data-slot": "chart-legend-item",
      "data-series": index,
      ...mergeProps<"li">(
        {
          className,
          children: children ?? (
            <>
              <SeriesSwatch
                paint={scatterPaint(context.config, dataKey)}
                kind={mark?.kind}
                look={mark?.variant}
              />
              <span data-slot="chart-series-label">{seriesLabel(context, dataKey).text}</span>
            </>
          ),
        },
        props
      ),
    },
  });
}

Object.assign(ScatterChartLegend, { displayName: "ScatterChart.Legend" });
Object.assign(ScatterChartLegendItem, { displayName: "ScatterChart.LegendItem" });
