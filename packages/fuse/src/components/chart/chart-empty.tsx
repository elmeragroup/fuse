"use client";

import type { ReactElement } from "react";

import { ChartEmptyBody } from "./chart-empty-body";
import { useChartReadout } from "./chart-readout";
import type { ChartDomProps } from "./chart-types";

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
  const { locale, empty } = useChartReadout("Chart.Empty");
  return <ChartEmptyBody locale={locale} empty={empty} {...props} />;
}

Object.assign(ChartEmpty, { displayName: "Chart.Empty" });
