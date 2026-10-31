"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { Empty } from "../empty/empty";
import { useChartRoot } from "./chart-context";
import { usePendingOr } from "./chart-pending-root";
import type { ChartDomProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";

/**
 * Props for `Chart.Empty`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartEmptyProps = ChartDomProps<"div">;

/**
 * Fuse Empty in the plot cell, shown when no slot holds a reading, which covers no rows and rows
 * whose every value is missing. The part is the plot cell's `div`, and Fuse Empty inside it keeps
 * its own slots and spacing. Its default children are the dictionary's "Ingen data for perioden".
 * While any slot holds a reading it renders nothing.
 *
 * @beta
 */
export function ChartEmpty(props: ChartEmptyProps): ReactElement {
  return usePendingOr(props, ChartEmptyBody);
}

function ChartEmptyBody({ render, className, children, ...props }: ChartEmptyProps): ReactElement {
  const context = useChartRoot("Chart.Empty");
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

Object.assign(ChartEmpty, { displayName: "Chart.Empty" });
