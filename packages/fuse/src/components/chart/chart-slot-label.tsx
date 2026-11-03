"use client";

import { use, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { slotTickLabel } from "./chart-axis";
import { useAxisFormat, useAxisTicks } from "./chart-axis-format";
import { useChartRoot, usePlotLayout } from "./chart-context";
import { ChartCrosshairContext } from "./chart-crosshair";
import { clientScale, writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { useChartFrame } from "./chart-plot";
import { springTiming } from "./chart-spring";
import { sameShallow, useSteady } from "./chart-steady";
import type { ChartLayerProps, XFormat } from "./chart-types";
import { CHART_SPRINGS } from "./layout/motion";
import { alongLength, centreOf } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";

/**
 * Props for `Chart.SlotLabel`, a closed part.
 *
 * @beta
 */
export type ChartSlotLabelProps = ChartLayerProps & {
  /**
   * The label format. The `format` of the chart's `Chart.XAxis` is the default, so the pill prints
   * what the ticks print, and without one the interval's tick preset or the category itself.
   */
  format?: XFormat;
};

/** Above this many labels the pill prints one label, written at once, as bklit's compact ticker. */
const ROLLING_LABELS = 60;

/** A run of letters or digits, or a run of anything else, so `30. sep.` rolls `30` and `sep` apart. */
const PART = /[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu;

/**
 * The rolling form of a run of labels. Each part of a label keeps a stack of the part's
 * consecutive distinct values, and `at[label][part]` is the value's place in its stack, so a part
 * that keeps its value from one label to the next keeps its place.
 */
type Rolling = {
  readonly stacks: readonly (readonly string[])[];
  readonly at: readonly (readonly number[])[];
};

function rollingOf(labels: readonly string[]): Rolling {
  const split = labels.map((label) => label.match(PART) ?? []);
  const count = Math.max(0, ...split.map((parts) => parts.length));
  const stacks = Array.from({ length: count }, (): string[] => []);
  const at = split.map((parts) =>
    stacks.map((stack, part) => {
      const value = parts[part] ?? "";
      if (stack.at(-1) !== value) stack.push(value);
      return stack.length - 1;
    })
  );
  return { stacks, at };
}

/**
 * What a paint reads once per layout and font load: the width of each stack value and of the
 * widest label, the pill's padding and its box across the axis, and the tick labels it can cover, each with its box. Boxes
 * are in CSS pixels from the part's top left corner, which is the plot's left edge.
 */
type Measured = {
  readonly widths: readonly (readonly number[])[];
  readonly full: number;
  readonly padding: number;
  readonly top: number;
  readonly bottom: number;
  readonly ticks: readonly { readonly node: Element; readonly box: DOMRect }[];
};

/**
 * The active slot's label as a pill on the x axis. Write it inside a `Chart.Crosshair`. It rides
 * along the axis to the active slot and prints the slot in the axis's format, and the tick labels
 * under it fade out until it moves on. Each part of the label, such as a day or a month, rolls to
 * its new value on a stack of its values, so a part that keeps its value stays still, and the pill
 * glides and resizes on a spring. Above 60 labels it prints one label, written at once. Root moves
 * it by writing styles, so a pointer move renders nothing in React. It is plot output, hidden from
 * screen readers, which hear the slot from the focused option. The server renders none of it, and
 * neither does a horizontal chart, whose axis prints every category.
 *
 * @beta
 */
export function ChartSlotLabel({ format, className, style }: ChartSlotLabelProps): ReactElement {
  const context = useChartRoot("Chart.SlotLabel");
  const layout = usePlotLayout("Chart.SlotLabel");
  const drawn = useChartFrame("Chart.SlotLabel", layout);
  const inside = use(ChartCrosshairContext);
  // Its own format wins, and the x axis's is the default.
  const axisFormat = useAxisFormat(context.axis);
  // A change of the axis's tick nodes renders the label again, so it measures the new ones.
  useAxisTicks(context.axis);
  const steadyFormat = useSteady(format, sameShallow) ?? axisFormat;
  const { locale, xScale, orientation } = context;
  const { domain, window } = context.model;
  const first = window?.first;
  const last = window?.last;
  const shows = inside && drawn !== null && orientation === "vertical";
  // The window's size picks the mode before anything formats. Only a rolling label formats its
  // window, and only once it shows, so the server and a compact label format nothing up front.
  const compact = first !== undefined && last !== undefined && last - first + 1 > ROLLING_LABELS;
  const labels = useMemo(
    () =>
      !shows || compact || first === undefined || last === undefined
        ? []
        : Array.from({ length: last - first + 1 }, (_, index) =>
            slotTickLabel({ domain, locale }, first + index, steadyFormat)
          ),
    [shows, compact, domain, first, last, locale, steadyFormat]
  );
  const rolling = useMemo(() => (compact ? null : rollingOf(labels)), [compact, labels]);
  // A compact label formats the active slot alone, and again only when the slot or what it
  // formats with changes.
  const labelInputs = useMemo(
    () => ({ domain, locale, format: steadyFormat }),
    [domain, locale, steadyFormat]
  );
  const lastLabel = useRef<{ readonly inputs: object; readonly slot: number; readonly text: string } | null>(
    null
  );
  const root = useRef<HTMLDivElement>(null);
  const measured = useRef<Measured | null>(null);
  // The compact pill's text width in layout pixels, which its resize observer reports.
  const compactWidth = useRef(0);
  // Where the pill shows, so a compact pill that resizes places itself again; null while hidden.
  const placedAt = useRef<number | null>(null);
  // Measures again in the task after the next frame, once a measurement found no layout scale.
  const retry = useRef<() => void>(() => undefined);
  const deferred = useRef<() => void>(() => undefined);
  const retrying = useRef(false);
  const place = (
    node: HTMLElement,
    known: Measured,
    frame: PlotFrame,
    position: number,
    width: number
  ): void => {
    // The pill keeps inside the plot's length, as the tick labels keep inside the axis.
    const half = width / 2 + known.padding;
    const length = alongLength(frame);
    const centre = Math.min(Math.max(centreOf(frame, position, xScale), half), Math.max(half, length - half));
    const rider = node.firstElementChild;
    if (rider instanceof HTMLElement) writeStyle(rider, "translate", `${String(centre)}px 0`);
    for (const { node: tick, box } of known.ticks) {
      const covered =
        box.left < centre + half &&
        centre - half < box.right &&
        box.top < known.bottom &&
        known.top < box.bottom;
      writeAttribute(tick, "data-covered", covered ? "" : null);
    }
  };
  // Repaints the label as a commit, after a font load or a deferred measurement.
  const repaint = useChartFollower("Chart.SlotLabel", (active, cause) => {
    const node = root.current;
    const known = measured.current;
    if (node !== null && known === null && active !== null && shows) retry.current();
    if (node === null || known === null || drawn === null || window === null || active === null) {
      // Nothing active, or nothing measured yet: the pill hides and every tick it covered fades back.
      placedAt.current = null;
      if (node !== null) writeAttribute(node, "data-shown", null);
      for (const { node: tick } of known?.ticks ?? []) writeAttribute(tick, "data-covered", null);
      return;
    }
    const position = active.slot - window.first;
    // A pill that shows, a commit and reduced motion place everything at once.
    writeAttribute(node, "data-snap", placedAt.current !== null && cause === "step" ? null : "");
    writeAttribute(node, "data-shown", "");
    placedAt.current = position;
    if (compact) {
      // The pill's text changes here, and its resize observer reports the new width before the
      // frame paints, so this paint places it at the width it had.
      const item = node.querySelector('[data-part="stack"] > span');
      const cached = lastLabel.current;
      const label =
        cached?.inputs === labelInputs && cached.slot === active.slot
          ? cached.text
          : slotTickLabel(labelInputs, active.slot, labelInputs.format);
      lastLabel.current = { inputs: labelInputs, slot: active.slot, text: label };
      if (item !== null && item.textContent !== label) item.textContent = label;
      place(node, known, drawn.frame, position, compactWidth.current);
      return;
    }
    place(node, known, drawn.frame, position, writeParts(node, rolling, known, position));
  });
  // Reading boxes in the task after a frame renders forces no layout, so a deferred measurement
  // waits for it. It runs the measurement of the latest render when it comes, so a format or
  // model that changed meanwhile is the one it measures.
  useLayoutEffect(() => {
    deferred.current = () => {
      const node = root.current;
      if (node === null || !node.isConnected) return;
      measured.current = measureLabel(node, rolling);
      if (measured.current !== null) repaint();
    };
    retry.current = () => {
      if (retrying.current) return;
      retrying.current = true;
      requestAnimationFrame(() => {
        setTimeout(() => {
          retrying.current = false;
          deferred.current();
        }, 0);
      });
    };
  });
  useLayoutEffect(() => {
    const node = root.current;
    if (!shows || node === null) return;
    // A web font that loads later, or any style that resizes a measured value or tick, changes the
    // widths and boxes, and the active label draws again with them.
    const remeasure = (): void => {
      measured.current = measureLabel(node, rolling);
      repaint();
    };
    measured.current = measureLabel(node, rolling);
    const fonts = node.ownerDocument.fonts;
    fonts.addEventListener("loadingdone", remeasure);
    // The observer reports sizes after layout and before paint, so it reads nothing on a step. Its
    // first report only confirms the sizes just measured.
    let confirmed = false;
    const resized = new ResizeObserver(() => {
      if (confirmed) remeasure();
      confirmed = true;
    });
    for (const item of node.querySelectorAll('[data-part="stack"] > span')) resized.observe(item);
    for (const { node: tick } of measured.current?.ticks ?? []) resized.observe(tick);
    return () => {
      resized.disconnect();
      fonts.removeEventListener("loadingdone", remeasure);
      for (const { node: tick } of measured.current?.ticks ?? []) writeAttribute(tick, "data-covered", null);
      measured.current = null;
    };
  });
  // A compact pill takes its text's width in its own typography. Its observer reads that width in
  // layout pixels after layout, never on a step, and places the pill again at the active slot.
  useLayoutEffect(() => {
    const pill = compact && shows ? root.current?.querySelector('[data-part="part"]') : null;
    if (pill === null || pill === undefined) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentBoxSize[0]?.inlineSize;
      if (width === undefined) return;
      compactWidth.current = width;
      const node = root.current;
      const known = measured.current;
      const position = placedAt.current;
      if (node !== null && known !== null && drawn !== null && position !== null)
        place(node, known, drawn.frame, position, width);
    });
    observer.observe(pill);
    return () => observer.disconnect();
  });
  if (!shows) return <></>;
  const { duration, easing } = springTiming(CHART_SPRINGS.ticker);
  const stacks = rolling?.stacks ?? [[""]];
  return (
    <div
      ref={root}
      data-slot="chart-slot-label"
      data-compact={compact ? "" : undefined}
      aria-hidden="true"
      className={className}
      style={{ "--_spring-duration": `${String(duration)}ms`, "--_spring-easing": easing, ...style }}>
      <span data-part="rider">
        {compact ? null : <span data-part="pill" />}
        {stacks.map((stack, part) => (
          <span key={part} data-part="part">
            <span data-part="stack">
              {stack.map((value, place) => (
                <span key={place}>{value}</span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Write each part's place and its stack's offset for a label, and the pill's width, and return the
 * label's width.
 */
function writeParts(node: HTMLElement, rolling: Rolling | null, known: Measured, position: number): number {
  const at = rolling?.at[position] ?? [];
  const widths = at.map((place, part) => known.widths[part]?.[place] ?? 0);
  const width = widths.reduce((sum, part) => sum + part, 0);
  let offset = -width / 2;
  node.querySelectorAll<HTMLElement>('[data-part="part"]').forEach((part, index) => {
    writeStyle(part, "translate", `${String(offset)}px 0`);
    offset += widths[index] ?? 0;
    const stack = part.firstElementChild;
    const count = rolling?.stacks[index]?.length ?? 1;
    if (stack instanceof HTMLElement)
      writeStyle(stack, "translate", `0 ${String((-100 * (at[index] ?? 0)) / count)}%`);
  });
  const pill = node.querySelector<HTMLElement>('[data-part="pill"]');
  if (pill !== null)
    writeStyle(pill, "clip-path", `inset(0 ${String((known.full - width) / 2)}px round 9999px)`);
  return width;
}

/**
 * Read the widths, the pill's padding and box and the tick boxes once, for every paint until the
 * next layout, all in the layout pixels of the label's own box, whose left edge is the plot's.
 */
function measureLabel(node: HTMLElement, rolling: Rolling | null): Measured | null {
  const origin = node.getBoundingClientRect();
  // The label's box spans the plot's width, so its scale along x is the plot's. The scale along y
  // comes from the pill, which spans one line.
  const pill =
    node.querySelector<HTMLElement>('[data-part="pill"]') ??
    node.querySelector<HTMLElement>('[data-part="part"]');
  const scale = { x: clientScale(node).x, y: pill === null ? 1 : clientScale(pill).y };
  // A box drawn at no size, as under scale(0), says nothing about layout pixels, so nothing is kept
  // and a later paint measures again.
  if (!(scale.x > 0 && Number.isFinite(scale.x) && scale.y > 0 && Number.isFinite(scale.y))) return null;
  const parts = [...node.querySelectorAll('[data-part="part"]')];
  const widths = parts.map((part) =>
    [...part.querySelectorAll('[data-part="stack"] > span')].map(
      (item) => item.getBoundingClientRect().width / scale.x
    )
  );
  // The pill spans the widest label, which the paints clip to the active one.
  const full = Math.max(
    0,
    ...(rolling?.at ?? []).map((places) =>
      places.reduce((sum, place, part) => sum + (widths[part]?.[place] ?? 0), 0)
    )
  );
  writeStyle(node, "--_full", `${String(full)}px`);
  // The pill, or the one part that is the compact pill, pads the label on both sides.
  const box = pill?.getBoundingClientRect() ?? origin;
  const padding = pill === null ? 0 : Number.parseFloat(getComputedStyle(pill).paddingLeft) || 0;
  const local = (at: DOMRect): DOMRect =>
    new DOMRect(
      (at.left - origin.left) / scale.x,
      (at.top - origin.top) / scale.y,
      at.width / scale.x,
      at.height / scale.y
    );
  const frame = node.closest('[data-slot="chart-frame"]');
  const ticks = [...(frame?.querySelectorAll('[data-slot="chart-x-tick"]') ?? [])].flatMap((tick) => {
    const at = tick.getBoundingClientRect();
    return at.width === 0 ? [] : [{ node: tick, box: local(at) }];
  });
  const pillBox = local(box);
  return { widths, full, padding, top: pillBox.top, bottom: pillBox.bottom, ticks };
}

Object.assign(ChartSlotLabel, { displayName: "Chart.SlotLabel" });
