"use client";

import type { ReactElement } from "react";

import type { ChartDomProps } from "./chart-types";

/**
 * Props for `Chart.Empty`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartEmptyProps = ChartDomProps<"div">;

/**
 * Fuse Empty in the plot cell, shown when no slot holds a reading. Its default children are the
 * dictionary's "Ingen data for perioden".
 *
 * @beta
 */
export function ChartEmpty(_props: ChartEmptyProps): ReactElement {
  return <></>;
}

Object.assign(ChartEmpty, { displayName: "Chart.Empty" });
