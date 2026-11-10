"use client";

/**
 * The cartesian pick: the slot and the nearest series under a client point, by arithmetic over the
 * plot box. Root's surface picks with it, and Root's readout hands it to the tooltip, so a pointer
 * over the popup picks as the plot does.
 */
import type { ChartRootContextValue } from "./chart-context";
import { useRootFrame } from "./chart-plot";
import type { PointerSlot } from "./chart-readout-port";
import { bandScale, nearestIndex, pointScale } from "./layout/band-scale";
import { invertValue, linearScale } from "./layout/linear-scale";
import { nearestSeries } from "./layout/nearest-series";
import { slotRun } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";

/** The layout under the pointer: its config keys, its value domain and its plot's client span. */
type PickedLayout = {
  readonly keys: readonly string[];
  readonly domain: readonly [number, number];
  /** The plot's client span across the value axis, its top or left edge and its length. */
  readonly start: number;
  readonly length: number;
};

/**
 * The layout a pointer's value-axis position falls in: the Panel whose plot holds it, or the
 * nearest Panel when it lies in a gap or an axis row, and the default layout without Panels.
 */
function layoutUnder(context: ChartRootContextValue, box: DOMRect, clientY: number): PickedLayout {
  const { model, orientation, panels, domains } = context;
  const whole: PickedLayout = {
    keys: model.series.map(({ key }) => key),
    domain: model.y.domain,
    start: orientation === "vertical" ? box.top : box.left,
    length: orientation === "vertical" ? box.height : box.width,
  };
  let best: PickedLayout | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const { layout, plot } of panels) {
    const rect = plot()?.getBoundingClientRect();
    if (rect === undefined) continue;
    const gap = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    if (gap >= distance) continue;
    distance = gap;
    const first = layout.keys[0];
    best = {
      keys: layout.keys,
      domain: (first === undefined ? undefined : domains.get(first)) ?? [0, 1],
      start: rect.top,
      length: rect.height,
    };
  }
  return best ?? whole;
}

/**
 * The slot and the nearest series under a client point, picked by arithmetic over the plot box.
 * The surface and the tooltip popup both read it, so a pointer over the popup picks as the plot
 * does. With Panels the pointer's y picks the Panel under it, and the nearest series comes from
 * that Panel's series alone, as CONTRACT section 9.5 says.
 *
 * @param context - The Root.
 * @param frame - Root's measured frame, whose slot bands a band slot is picked from, or null before
 *   Root measures, when the bands divide the whole plot.
 * @param box - The plot surface's client box.
 * @param clientX - The pointer's client x.
 * @param clientY - The pointer's client y.
 * @returns The slot and the nearest series.
 */
export function pointerSlot(
  context: ChartRootContextValue,
  frame: PlotFrame | null,
  box: DOMRect,
  clientX: number,
  clientY: number
): PointerSlot {
  const { model, orientation } = context;
  const window = model.window ?? { first: 0, last: 0 };
  const count = window.last - window.first + 1;
  const along =
    orientation === "vertical"
      ? (clientX - box.left) / Math.max(1, box.width)
      : (clientY - box.top) / Math.max(1, box.height);
  // Band slots lie in the run the frame's slot bands take, which leaves its leftover at both ends.
  const scale =
    context.xScale === "point"
      ? pointScale({ count, range: [0, 1] })
      : bandScale({ count, range: frame === null ? [0, 1] : slotRun(frame) });
  const slot = window.first + nearestIndex(scale, Math.min(Math.max(along, 0), 1));
  const layout = layoutUnder(context, box, clientY);
  const across =
    orientation === "vertical"
      ? 1 - (clientY - layout.start) / Math.max(1, layout.length)
      : (clientX - layout.start) / Math.max(1, layout.length);
  const value = invertValue(linearScale(layout.domain, [0, 1]), across);
  const members = model.series.filter(({ key }) => layout.keys.includes(key));
  const drawn = members.map(({ extents, readings }) => {
    const extent = extents[slot];
    if (!extent || readings[slot]?.kind !== "reading") return null;
    return extent[0] < 0 && extent[1] <= 0 ? extent[0] : extent[1];
  });
  const near = members[nearestSeries(drawn, value)]?.seriesIndex;
  return { slot, near: near ?? null };
}

/**
 * The cartesian pick under a client point, against the plot surface's client box and Root's
 * measured frame.
 *
 * @param context - The Root.
 * @param part - The calling part's display name.
 * @returns The pick, null before the surface mounts.
 */
export function useCartesianPick(
  context: ChartRootContextValue,
  part: string
): (clientX: number, clientY: number) => PointerSlot | null {
  const drawn = useRootFrame(part);
  return (clientX, clientY) => {
    const surface = document.getElementById(`${context.id}-surface`);
    return surface === null
      ? null
      : pointerSlot(context, drawn?.frame ?? null, surface.getBoundingClientRect(), clientX, clientY);
  };
}
