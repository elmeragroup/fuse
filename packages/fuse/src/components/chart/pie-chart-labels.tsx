"use client";

/**
 * One label per slice (Q10, S12). A label is HTML in the cell, placed in percentages of the
 * sweep's box, so the server's markup holds at any width. An inside label sits at d3's centroid
 * when its slice's role has an on-colour role and its box fits the slice, and every other label
 * sits outside with a leader from the rim, its elbow 8 % past it and a run sideways. Outside labels
 * on one side move apart by their own heights. The server sizes each box from the label width
 * table, and the client places the labels again from their measured boxes whenever the pie or the
 * cell changes, with no React commit. As the slices tween, each label follows the angles its slice
 * draws in that frame, which the pie's frame reports, from the boxes measured last; a label keeps the
 * side, inside or outside, its slice takes at rest, and hides while its slice draws no arc. Outside
 * labels ask the frame for a gutter beside the dial.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import { writeAttribute, writeStyle } from "./chart-dom";
import { ChartLegendShare } from "./chart-legend";
import { pieFrameOf, viewBoxOf } from "./chart-pie-frame";
import { pieDrawingIn, usePolarContext } from "./chart-polar-context";
import type { PieDrawing } from "./chart-polar-context";
import { ChartRowContext } from "./chart-readout";
import { ChartSeriesLabel } from "./chart-series";
import type { ChartLayerProps } from "./chart-types";
import { arcCentroid } from "./layout/arc-path";
import { labelWidth } from "./layout/label-width";
import type { SliceAngles } from "./layout/pie";
import type { SweepBox } from "./layout/polar-angle";
import { insideLabel, outsideLabels } from "./layout/polar-labels";
import type { LabelSize } from "./layout/polar-labels";

/**
 * Props for `PieChart.Labels`, a closed part.
 *
 * @beta
 */
export type PieChartLabelsProps = ChartLayerProps & {
  /** Where each label sits. An inside label on a role with no on-colour role draws outside instead. */
  position?: "inside" | "outside";
  /** A per-slice template. Without children, SeriesLabel and LegendShare. */
  children?: ReactNode;
};

/** A label's line, 12 px on a 16 px line at both densities (CONTRACT section 10). */
const LINE = 16;

/** The leader's run sideways from its elbow, in CSS pixels. */
const RUN = 8;

/** The cell's nominal width before the client measures it: `--chart-polar-size` less the pop's room. */
const NOMINAL_CELL = 184;

/** The colour roles with an on-colour role, which an inside label reads its text colour from. */
const ON_COLOUR = /^chart-(?:[1-8]|other)$/u;

/** Where one slice's label sits, in units of the outer radius from the centre. */
type Placed =
  | { readonly placement: "inside"; readonly x: number; readonly y: number }
  | {
      readonly placement: "outside";
      readonly side: "start" | "end";
      readonly x: number;
      readonly y: number;
      readonly leader: string;
    }
  | null;

/**
 * Place every label: inside where it fits, outside with a leader otherwise.
 *
 * @param pie - The drawing.
 * @param sizes - Each label's box in CSS pixels.
 * @param scale - CSS pixels per unit of the outer radius.
 * @param position - Where the labels ask to sit.
 * @param drawn - Each slice's angles in this frame, where they differ from its rest, as a tween
 *   draws them. A label keeps the side its slice's rest takes and sits where the slice draws.
 * @returns Each slice's placement, null for one that draws no arc.
 */
function placeLabels(
  pie: PieDrawing,
  sizes: readonly LabelSize[],
  scale: number,
  position: "inside" | "outside",
  drawn: readonly (SliceAngles | null)[] = pie.slices.map(({ angles }) => angles)
): readonly Placed[] {
  const unit = (size: LabelSize | undefined): LabelSize =>
    size === undefined ? { width: 0, height: 0 } : { width: size.width / scale, height: size.height / scale };
  const inside = pie.slices.map((slice, index) => {
    const angles = slice.angles;
    if (angles === null || position === "outside") return null;
    return insideLabel(
      {
        innerRadius: pie.innerRadius,
        outerRadius: 1,
        startAngle: angles.start,
        endAngle: angles.end,
        padAngle: angles.pad,
      },
      unit(sizes[index]),
      ON_COLOUR.test(slice.role)
    );
  });
  const outside = pie.slices.flatMap((_, index) => {
    const angles = drawn[index] ?? null;
    if (angles === null || inside[index]?.placement === "inside") return [];
    return [{ index, bisector: (angles.start + angles.end) / 2 }];
  });
  const leaders = outsideLabels(
    outside.map(({ bisector }) => bisector),
    outside.map(({ index }) => unit(sizes[index])),
    { radius: 1, reach: 0.08, run: RUN / scale }
  );
  const placed: Placed[] = pie.slices.map(() => null);
  inside.forEach((label, index) => {
    const angles = drawn[index] ?? null;
    if (label?.placement !== "inside" || angles === null) return;
    const [x, y] = arcCentroid({
      innerRadius: pie.innerRadius,
      outerRadius: 1,
      startAngle: angles.start,
      endAngle: angles.end,
      padAngle: angles.pad,
    });
    placed[index] = { placement: "inside", x, y };
  });
  outside.forEach(({ index }, place) => {
    const leader = leaders[place];
    if (leader === undefined) return;
    const { anchor, elbow, end } = leader;
    placed[index] = {
      placement: "outside",
      side: leader.side,
      x: end.x,
      y: end.y,
      leader: [anchor, elbow, end].map(({ x, y }) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" "),
    };
  });
  return placed;
}

/** A point's place in the cell, as percentages of the sweep's box. */
function percent(box: SweepBox, x: number, y: number): readonly [string, string] {
  const left = ((x - box.left) / (box.right - box.left)) * 100;
  const top = ((y - box.top) / (box.bottom - box.top)) * 100;
  return [`${left.toFixed(3)}%`, `${top.toFixed(3)}%`];
}

/** The text a default label prints, which the server sizes its box from. */
function nominalText(pie: PieDrawing, index: number): string {
  const slice = pie.slices[index];
  const share = pie.share(index, 0);
  return `${slice?.label.text ?? ""} ${share === null ? "" : `${String(share)} %`}`;
}

/**
 * One label per slice. Its children are a template each label renders for its slice's key, and
 * without children each label prints SeriesLabel and LegendShare. An inside label on a slice whose
 * role has no on-colour role, such as a sequential step, draws outside that slice instead, as does
 * one whose box does not fit its slice. Outside labels draw a leader from the rim and take a gutter
 * beside the dial.
 *
 * @beta
 */
export function PieChartLabels({
  position = "inside",
  children,
  className,
  style,
}: PieChartLabelsProps): ReactElement {
  const polar = usePolarContext("PieChart.Labels", ["pie"]);
  const { model, box } = polar;
  const pie = pieDrawingIn(model, "PieChart.Labels");
  const { locale } = useLocale();
  const layer = useRef<HTMLDivElement>(null);
  const width = box.right - box.left;
  // The server places every label from the width table at the cell's nominal size.
  const placed = useMemo(
    () =>
      placeLabels(
        pie,
        pie.slices.map((_, index) => ({ width: labelWidth(nominalText(pie, index)), height: LINE })),
        NOMINAL_CELL / width,
        position
      ),
    [pie, width, position]
  );
  // The pie's frame, which reports the angles each slice draws as it tweens.
  const [frame] = useState(() =>
    pieFrameOf(polar.motion, {
      innerRadius: pie.innerRadius,
      cornerRadius: 0,
      sweep: pie.fill,
      track: pie.track,
    })
  );
  // The client places them again from their measured boxes, as the pie or the cell changes, and
  // from the boxes it measured last as the slices tween, so a frame reads no layout.
  useLayoutEffect(() => {
    const node = layer.current;
    if (node === null) return undefined;
    let sizes: readonly LabelSize[] = [];
    let scale = 0;
    const write = (measured: readonly Placed[], hidden: (index: number) => boolean): void => {
      for (const label of node.querySelectorAll<HTMLElement>('[data-slot="pie-chart-label"]')) {
        const index = Number(label.dataset.index);
        writeAttribute(label, "data-empty", hidden(index) ? "" : null);
        const at = measured[index];
        if (at === null || at === undefined) continue;
        const [left, top] = percent(box, at.x, at.y);
        writeStyle(label, "--_x", left);
        writeStyle(label, "--_y", top);
        writeAttribute(label, "data-placement", at.placement);
        writeAttribute(label, "data-side", at.placement === "outside" ? at.side : null);
      }
      for (const leader of node.querySelectorAll<SVGPolylineElement>('[data-slot="pie-chart-leader"]')) {
        const index = Number(leader.dataset.index);
        const at = measured[index];
        leader.setAttribute("points", at?.placement === "outside" && !hidden(index) ? at.leader : "");
      }
      writeAttribute(node, "data-outside", measured.some((at) => at?.placement === "outside") ? "" : null);
    };
    const place = (): void => {
      scale = node.getBoundingClientRect().width / width;
      if (!(scale > 0)) return;
      const labels = [...node.querySelectorAll<HTMLElement>('[data-slot="pie-chart-label"]')];
      sizes = pie.slices.map((_, index) => {
        const label = labels.find((element) => element.dataset.index === String(index));
        return label === undefined
          ? { width: 0, height: 0 }
          : { width: label.offsetWidth, height: label.offsetHeight };
      });
      write(placeLabels(pie, sizes, scale, position), () => false);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    const leave = frame.listen((angles) => {
      if (!(scale > 0)) return;
      const drawn = pie.slices.map((slice) =>
        angles.has(slice.key) ? (angles.get(slice.key) ?? null) : slice.angles
      );
      write(placeLabels(pie, sizes, scale, position, drawn), (index) => drawn[index] === null);
    });
    return () => {
      observer.disconnect();
      leave();
    };
  }, [pie, box, width, position, locale, frame]);
  return (
    <div
      ref={layer}
      data-slot="pie-chart-labels"
      data-polar-layer=""
      data-polar-mark=""
      data-outside={placed.some((at) => at?.placement === "outside") ? "" : undefined}
      aria-hidden="true"
      className={className}
      style={style}>
      <svg data-part="leaders" viewBox={viewBoxOf(box)} focusable="false">
        {pie.slices.map((slice, index) => {
          const at = placed[index];
          return (
            <polyline
              key={slice.key}
              data-slot="pie-chart-leader"
              data-index={index}
              points={at?.placement === "outside" ? at.leader : ""}
            />
          );
        })}
      </svg>
      {pie.slices.map((slice, index) => {
        const at = placed[index];
        if (at === null || at === undefined) return null;
        const [left, top] = percent(box, at.x, at.y);
        return (
          <ChartRowContext key={slice.key} value={slice.key}>
            <span
              data-slot="pie-chart-label"
              data-index={index}
              data-placement={at.placement}
              data-side={at.placement === "outside" ? at.side : undefined}
              style={{ "--_x": left, "--_y": top, "--_on": `var(--${slice.role}-foreground)` }}>
              {children ?? (
                <>
                  <ChartSeriesLabel /> <ChartLegendShare />
                </>
              )}
            </span>
          </ChartRowContext>
        );
      })}
    </div>
  );
}

Object.assign(PieChartLabels, { displayName: "PieChart.Labels" });
