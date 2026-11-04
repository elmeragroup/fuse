"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocale } from "../../intl/locale-context";
import { Empty } from "../empty/empty";
import { Loader } from "../loader/loader";
import { Skeleton } from "../skeleton/skeleton";
import type { ChartDomProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { useScatterRoot } from "./scatter-chart-context";

/**
 * Props for `ScatterChart.Empty`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ScatterChartEmptyProps = ChartDomProps<"div">;

/**
 * Props for `ScatterChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type ScatterChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * The placeholder's dots, as shares of the plot from the left and from the top. The list is fixed,
 * so the server and the client agree, and it falls from the top left like a typical signature.
 */
const SKELETON_DOTS = [
  [0.06, 0.18],
  [0.12, 0.3],
  [0.2, 0.22],
  [0.27, 0.41],
  [0.35, 0.35],
  [0.42, 0.52],
  [0.5, 0.46],
  [0.57, 0.6],
  [0.64, 0.55],
  [0.72, 0.7],
  [0.8, 0.64],
  [0.88, 0.8],
  [0.94, 0.74],
] as const;

/**
 * Fuse Empty in the plot cell, shown when the chart has no point. Its default children are the
 * dictionary's "Ingen data for perioden". While any point draws it renders nothing.
 *
 * @beta
 */
export function ScatterChartEmpty({
  render,
  className,
  children,
  ...props
}: ScatterChartEmptyProps): ReactElement {
  const context = useScatterRoot("ScatterChart.Empty");
  const element = useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "chart-empty",
      ...mergeProps<"div">(
        {
          className,
          children: (
            <Empty.Root>
              {children ?? <Empty.Description>{CHART_STRINGS[context.locale].noData}</Empty.Description>}
            </Empty.Root>
          ),
        },
        props
      ),
    },
  });
  return context.model.empty ? element : <></>;
}

/**
 * A loading placeholder that renders in place of Root, for example as a Suspense fallback. Its dots
 * are Fuse Skeleton shapes that readers skip, and one Fuse Loader names the wait.
 *
 * @beta
 */
export function ScatterChartSkeleton({
  label,
  className,
  style,
  ...props
}: ScatterChartSkeletonProps): ReactElement {
  const { locale } = useLocale();
  return (
    <div data-slot="chart-skeleton" data-variant="points" className={className} style={style} {...props}>
      {SKELETON_DOTS.map(([left, top], index) => (
        <Skeleton
          // The dots never reorder, so the position is their identity.
          key={index}
          data-slot="chart-skeleton-mark"
          style={{ "--chart-skeleton-x": left, "--chart-skeleton-y": top }}
        />
      ))}
      <Loader aria-label={label ?? CHART_STRINGS[locale].loading} />
    </div>
  );
}

Object.assign(ScatterChartEmpty, { displayName: "ScatterChart.Empty" });
Object.assign(ScatterChartSkeleton, { displayName: "ScatterChart.Skeleton" });
