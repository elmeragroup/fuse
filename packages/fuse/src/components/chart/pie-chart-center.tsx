"use client";

/**
 * The text in a pie's or radial chart's hole (CONTRACT section 8.13). The Center lays its parts in
 * the square inscribed in the hole, and a CenterLabel is a text line among them. The numbers are
 * parts of their own, in `pie-chart-center-value`, so a route that names none ships no digit roll.
 * The Center is plot output, hidden from readers, who read the same numbers from the options.
 * Every part that follows the active item reads it here, through `useActiveIndex`, so it renders
 * when the active item changes and never on a pointer move within one, and inside a closing tooltip
 * it keeps the item the popup held.
 */
import type { ReactElement, ReactNode } from "react";

import { useActiveIndex } from "./chart-active-point";
import { useCentreFit } from "./chart-centre-fit";
import { centreOf, pieDrawingOf, radialDrawingOf, usePolarContext } from "./chart-polar-context";
import type { CentreModel } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `PieChart.Center`, a closed part.
 *
 * @beta
 */
export type PieChartCenterProps = ChartLayerProps & {
  /** The centre's content, such as `CenterValue` over a `CenterLabel`. */
  children?: ReactNode;
};

/**
 * Props for `PieChart.CenterLabel`, a closed part.
 *
 * @beta
 */
export type PieChartCenterLabelProps = ChartLayerProps & {
  /** The label text, such as "av" between the value and the maximum. */
  children?: ReactNode;
};

/**
 * Props for `PieChart.CenterName`, a closed part.
 *
 * @beta
 */
export type PieChartCenterNameProps = ChartLayerProps & {
  /** The text with nothing active, such as "Total" under the total. */
  children?: ReactNode;
};

/** The centre's numbers, null under a family with no centre, and the active item. */
type CentreItem = { readonly centre: CentreModel | null; readonly active: number | null };

/**
 * The centre's numbers and the active slice's or ring's index, or null while nothing is active. Inside
 * a closing tooltip the index is the one the popup held.
 *
 * @param part - The part, which a misplaced use names.
 * @returns The centre and the active index.
 */
export function useCentreItem(part: string): CentreItem {
  const { model, kernel } = usePolarContext(part, ["pie", "radial"]);
  const centre = centreOf(model);
  // The centre follows the store wherever it sits, over every item, and a closing tooltip's held one.
  const active = useActiveIndex(
    { store: kernel.store, window: model.count > 0 ? { first: 0, last: model.count - 1 } : null },
    true
  );
  return { centre, active };
}

/**
 * The text in the hole of a donut or a gauge: its parts sit in the square inscribed in the hole,
 * centred on the dial and kept to the sweep's box, so a semicircle's sits above its flat edge.
 * Every part prints the active slice, or with nothing active the pie's own number. Its text never
 * shrinks below 12 px: when the lines overflow the square it drops every line but the value, and
 * then the value.
 *
 * @beta
 */
export function PieChartCenter({ children, className, style }: PieChartCenterProps): ReactElement {
  const { model, box } = usePolarContext("PieChart.Center", ["pie", "radial"]);
  const fitted = useCentreFit();
  const hole = pieDrawingOf(model)?.innerRadius ?? radialDrawingOf(model)?.innerRadius;
  if (hole === undefined) return <></>;
  // A pie with no hole lays its centre in the square inscribed in half the radius. The square
  // keeps to the sweep's box, so a semicircle's centre sits above its flat edge.
  const half = (Math.SQRT2 * (hole > 0 ? hole : 0.5)) / 2;
  const left = Math.max(-half, box.left);
  const right = Math.min(half, box.right);
  const top = Math.max(-half, box.top);
  const bottom = Math.min(half, box.bottom);
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const percent = (value: number, of: number): string => `${((value / of) * 100).toFixed(3)}%`;
  return (
    <div
      data-slot="pie-chart-center"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      <div
        ref={fitted}
        data-part="hole"
        style={{
          "--_left": percent(left - box.left, width),
          "--_top": percent(top - box.top, height),
          "--_width": percent(right - left, width),
          "--_height": percent(bottom - top, height),
        }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A text line in the centre, such as the word between the value and the maximum. Its text stays
 * the same whatever is active, and it may hold the centre's numbers, as in "av" before a
 * `CenterMax`. A line that names the active item is a `CenterName`.
 *
 * @beta
 */
export function PieChartCenterLabel({ children, className, style }: PieChartCenterLabelProps): ReactElement {
  usePolarContext("PieChart.CenterLabel", ["pie", "radial"]);
  return (
    <span data-slot="pie-chart-center-label" className={className} style={style}>
      {children}
    </span>
  );
}

/**
 * A text line in the centre that names the active slice or ring by its config label, and prints its
 * children with nothing active, as `CenterValue` prints the active item's value and, with nothing
 * active, the total. So "Total" under the total reads "Grid rent" under that slice's value. It
 * renders when the active item changes, never on a pointer move within one, and it is a text line
 * as a `CenterLabel` is: the same size and colour, and left out of a hole narrower than 4rem or one
 * whose fit keeps only the value.
 *
 * @beta
 */
export function PieChartCenterName({ children, className, style }: PieChartCenterNameProps): ReactElement {
  const { centre, active } = useCentreItem("PieChart.CenterName");
  const name = centre === null || active === null ? null : centre.label(active);
  return (
    <span data-slot="pie-chart-center-name" className={className} style={style}>
      {name ?? children}
    </span>
  );
}

Object.assign(PieChartCenter, { displayName: "PieChart.Center" });
Object.assign(PieChartCenterLabel, { displayName: "PieChart.CenterLabel" });
Object.assign(PieChartCenterName, { displayName: "PieChart.CenterName" });
