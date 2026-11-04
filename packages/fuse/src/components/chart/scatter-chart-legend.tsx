"use client";

import { useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import type { ChartDomProps } from "./chart-types";
import { assertScatterKey, scatterPaint, useScatterRoot } from "./scatter-chart-context";
import { scatterSeriesLabel } from "./scatter-chart-text";

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

/** The server and a hydrating legend read no registered mark, so they draw a dot. */
function noMark(): string {
  return "points default";
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
  assertScatterKey("ScatterChart.LegendItem", context.config, dataKey);
  const { marks } = context;
  const look = useSyncExternalStore(
    marks.subscribe,
    () => {
      const mark = marks.of(dataKey);
      return mark === undefined ? noMark() : `${mark.kind} ${mark.variant}`;
    },
    noMark
  );
  const [kind, variant] = look.split(" ");
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
              <span
                data-slot="chart-swatch"
                data-variant={kind === "line" ? "line" : "circle"}
                data-look={variant === "default" ? undefined : variant}
                aria-hidden="true"
                style={{ "--chart-swatch-paint": scatterPaint(context.config, dataKey) }}
              />
              <span data-slot="chart-series-label">{scatterSeriesLabel(context, dataKey).text}</span>
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
