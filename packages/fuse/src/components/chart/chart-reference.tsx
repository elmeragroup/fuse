"use client";

import { useId, useLayoutEffect } from "react";
import type { ReactElement } from "react";

import { useChartLayout, useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { useChartStore } from "./chart-store";
import { slotLabel } from "./chart-text";
import type { ChartLayerProps, ChartTone, ChartX, ValueFormat, XFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { formatValue } from "./format/value-format";
import { ChartCompositionError, isChartDevelopment } from "./layout/errors";
import { slotCentre, valueTop } from "./layout/plot-geometry";
import { referenceLabelBottom } from "./layout/reference-labels";
import { stringOf } from "./layout/scalar";
import { slotOf } from "./layout/x-domain";

/**
 * Props for `Chart.ReferenceLine`, a closed part. It takes either `y` with a `ValueFormat` or `x`
 * with an `XFormat`. Without a format, a `y` line prints through the layout's first series' format
 * and an `x` line through the interval's label preset.
 *
 * @beta
 */
export type ChartReferenceLineProps = ChartLayerProps &
  (
    | {
        /** The value the line marks. */
        y: number;
        /** Not on a value line. */
        x?: never;
        /** How `{value}` in `label` prints, a `ValueFormat` on a `y` line and an `XFormat` on an `x` line. */
        format?: ValueFormat;
      }
    | {
        /** The x the line marks. An x string on a time axis throws `x-type-mismatch`. */
        x: ChartX;
        /** Not on an x line. */
        y?: never;
        /** How `{value}` in `label` prints, a `ValueFormat` on a `y` line and an `XFormat` on an `x` line. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the line's value. */
    label?: string;
    /** The line style. "solid" by default. */
    variant?: "solid" | "dashed";
    /** The line's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * Props for `Chart.ReferenceArea`, a closed part. It takes either `y1` and `y2` or `x1` and `x2`.
 *
 * @beta
 */
export type ChartReferenceAreaProps = ChartLayerProps &
  (
    | {
        /** The band's first value. */
        y1: number;
        /** The band's last value. */
        y2: number;
        /** Not on a value band. */
        x1?: never;
        /** Not on a value band. */
        x2?: never;
        /** How `{value}` in `label` prints the range, a `ValueFormat` for `y1` and `y2` and an `XFormat` for `x1` and `x2`. */
        format?: ValueFormat;
      }
    | {
        /** The band's first x. An x string on a time axis throws `x-type-mismatch`. */
        x1: ChartX;
        /** The band's last x. An x string on a time axis throws `x-type-mismatch`. */
        x2: ChartX;
        /** Not on an x band. */
        y1?: never;
        /** Not on an x band. */
        y2?: never;
        /** How `{value}` in `label` prints the range, a `ValueFormat` for `y1` and `y2` and an `XFormat` for `x1` and `x2`. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the range. */
    label?: string;
    /** The band's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * The slot a child x prop names. A string on a time axis, or a `Date` or number on a category axis,
 * throws `x-type-mismatch` in every build.
 */
export function childSlot(context: ChartRootContextValue, part: string, x: ChartX): number {
  const { domain } = context.model;
  const isString = stringOf(x) !== undefined;
  if ((domain.kind === "time") === isString) {
    throw new ChartCompositionError(
      part,
      "x-type-mismatch",
      domain.kind === "time"
        ? "received an x string on a time axis. Pass a Date or epoch milliseconds, because a date-only string parses as UTC midnight and lands on the wrong day."
        : "received a Date or a number on a category axis. Pass the category string."
    );
  }
  return slotOf(domain, x);
}

/** Fill `{value}` in a label, or join the label and the value, or use the dictionary's pattern. */
function sentence(
  label: string | undefined,
  value: FormattedText,
  pattern: (value: string) => string
): FormattedText {
  if (label === undefined) return { text: pattern(value.text), spoken: pattern(value.spoken) };
  if (label.includes("{value}")) {
    return {
      text: label.replaceAll("{value}", value.text),
      spoken: label.replaceAll("{value}", value.spoken),
    };
  }
  return { text: label, spoken: `${label}: ${value.spoken}` };
}

/** The value of a value-axis reference in the layout's first series' format. */
function valueText(
  context: ChartRootContextValue,
  keys: readonly string[],
  value: number,
  format: ValueFormat | undefined
): FormattedText {
  const first = keys[0];
  return formatValue(
    context.locale,
    value,
    format ?? (first === undefined ? {} : context.config[first]?.format) ?? {},
    "full"
  );
}

/** Warn once in development when a reference sits outside the value domain. */
function warnOutside(part: string, values: readonly number[], domain: readonly [number, number]): void {
  if (!isChartDevelopment()) return;
  if (values.every((value) => value >= domain[0] && value <= domain[1])) return;
  console.warn(
    `${part} sits outside the value domain, so it renders clipped. Pass its value to yInclude on Chart.Root or the Panel, because Root never reads its children.`
  );
}

/**
 * The bottom edge of a value reference's label on a vertical chart, after the labels above it,
 * as a CSS length. The reference registers its label with Root's store while it shows one, so
 * every label of the plot stacks clear of the others. Other references return undefined.
 */
function useLabelBottom(
  context: ChartRootContextValue,
  shown: boolean,
  at: number,
  clipped: boolean
): string | undefined {
  const { store } = context;
  const id = useId();
  const stacks = shown && context.orientation === "vertical";
  useLayoutEffect(() => {
    if (!stacks) return;
    store.set({ labels: { ...store.get().labels, [id]: { at, clipped } } });
    return () => {
      store.set({
        labels: Object.fromEntries(Object.entries(store.get().labels).filter(([key]) => key !== id)),
      });
    };
  }, [store, id, stacks, at, clipped]);
  return useChartStore(store, (snapshot) => {
    if (!stacks) return undefined;
    const entries = Object.entries(snapshot.labels).map(([key, place], order) => ({ key, order, ...place }));
    // Before it registers, as on the server, the label places itself after every other.
    const self = entries.find(({ key }) => key === id) ?? { key: id, order: entries.length, at, clipped };
    return referenceLabelBottom(entries.includes(self) ? entries : [...entries, self], self);
  });
}

/** A range in visual form with a bare en dash, writing a shared unit once, such as `5–10 kWh`. */
function rangeText(
  from: FormattedText,
  to: FormattedText,
  join: (from: string, to: string) => string
): FormattedText {
  const fromParts = from.text.split("\u00a0");
  const toParts = to.text.split("\u00a0");
  const sharedUnit = fromParts.length > 1 && fromParts.at(-1) === toParts.at(-1);
  const head = sharedUnit ? fromParts.slice(0, -1).join("\u00a0") : from.text;
  return { text: `${head}\u2013${to.text}`, spoken: join(from.spoken, to.spoken) };
}

/**
 * A line at one value or one x, such as a price cap. Readers hear it as a visually hidden sentence
 * that always carries the value, in the reference's own place after the plot. Pass the value to
 * Root's `yInclude` when it may sit outside the data, because Root never reads its children, and a
 * development build warns with `reference-outside-domain` when it does.
 *
 * @beta
 */
export function ChartReferenceLine({ style, ...props }: ChartReferenceLineProps): ReactElement {
  const { label, variant = "solid", tone = "default", className } = props;
  const context = useChartRoot("Chart.ReferenceLine");
  const layout = useChartLayout("Chart.ReferenceLine");
  const strings = CHART_STRINGS[context.locale];
  let at: number;
  let value: FormattedText;
  let axis: "value" | "slot";
  if (props.y === undefined) {
    const window = context.model.window;
    const slot = childSlot(context, "Chart.ReferenceLine", props.x);
    at = window === null || slot === -1 ? -1 : slotCentre(window, slot, context.xScale) * 100;
    value = slot === -1 ? { text: "", spoken: "" } : slotLabel(context, slot, props.format);
    axis = "slot";
  } else {
    warnOutside("Chart.ReferenceLine", [props.y], layout.y.domain);
    at = valueTop(layout.y.domain, props.y);
    value = valueText(context, layout.keys, props.y, props.format);
    axis = "value";
  }
  const text = sentence(label, value, strings.referenceLine);
  // A line outside the plot draws nothing and keeps its sentence.
  const outside = at < 0 || at > 100;
  const bottom = useLabelBottom(context, axis === "value" && !outside && label !== undefined, at, false);
  return (
    <div
      data-slot="chart-reference-line"
      data-axis={axis}
      data-outside={outside ? "" : undefined}
      data-variant={variant}
      data-tone={tone}
      className={className}
      style={{ "--chart-at": `${String(at)}%`, "--chart-x": at / 100, ...style }}>
      <span
        data-slot="chart-reference-label"
        data-stack={bottom === undefined ? undefined : ""}
        aria-hidden="true"
        style={{ "--chart-label-bottom": bottom }}>
        {label === undefined ? null : text.text}
      </span>
      <span data-slot="chart-reference-text">{text.spoken}</span>
    </div>
  );
}

/**
 * A band between two values or two x values, such as a tariff step. Readers hear it as a visually
 * hidden sentence with the range. Both ends are inclusive.
 *
 * @beta
 */
export function ChartReferenceArea({ style, ...props }: ChartReferenceAreaProps): ReactElement {
  const { label, tone = "default", className } = props;
  const context = useChartRoot("Chart.ReferenceArea");
  const layout = useChartLayout("Chart.ReferenceArea");
  const strings = CHART_STRINGS[context.locale];
  let from: number;
  let to: number;
  let value: FormattedText;
  let axis: "value" | "slot";
  if (props.y1 === undefined) {
    const window = context.model.window;
    const a = childSlot(context, "Chart.ReferenceArea", props.x1);
    const b = childSlot(context, "Chart.ReferenceArea", props.x2);
    const count = window === null ? 1 : window.last - window.first + 1;
    const first = Math.min(a, b) - (window?.first ?? 0);
    const last = Math.max(a, b) - (window?.first ?? 0);
    from = (first / count) * 100;
    to = ((last + 1) / count) * 100;
    value =
      a === -1 || b === -1
        ? { text: "", spoken: "" }
        : rangeText(
            slotLabel(context, Math.min(a, b), props.format),
            slotLabel(context, Math.max(a, b), props.format),
            strings.valueRange
          );
    axis = "slot";
  } else {
    const low = Math.min(props.y1, props.y2);
    const high = Math.max(props.y1, props.y2);
    warnOutside("Chart.ReferenceArea", [low, high], layout.y.domain);
    from = valueTop(layout.y.domain, high);
    to = valueTop(layout.y.domain, low);
    value = rangeText(
      valueText(context, layout.keys, low, props.format),
      valueText(context, layout.keys, high, props.format),
      strings.valueRange
    );
    axis = "value";
  }
  const text = sentence(label, value, strings.referenceArea);
  // The band clips to the plot, and a band wholly outside it draws nothing and keeps its sentence.
  const shownFrom = Math.min(Math.max(from, 0), 100);
  const shownTo = Math.min(Math.max(to, 0), 100);
  const outside = shownFrom >= shownTo;
  // A value band cut at the plot top keeps its label inside the band, below the cut.
  const clipped = axis === "value" && from < 0;
  const bottom = useLabelBottom(
    context,
    axis === "value" && !outside && label !== undefined,
    shownFrom,
    clipped
  );
  return (
    <div
      data-slot="chart-reference-area"
      data-axis={axis}
      data-outside={outside ? "" : undefined}
      data-clipped={clipped ? "" : undefined}
      data-tone={tone}
      className={className}
      style={{
        "--chart-from": `${String(shownFrom)}%`,
        "--chart-to": `${String(shownTo)}%`,
        "--chart-x": shownFrom / 100,
        ...style,
      }}>
      <span
        data-slot="chart-reference-label"
        data-stack={bottom === undefined ? undefined : ""}
        aria-hidden="true"
        style={{ "--chart-label-bottom": bottom }}>
        {label === undefined ? null : text.text}
      </span>
      <span data-slot="chart-reference-text">{text.spoken}</span>
    </div>
  );
}

Object.assign(ChartReferenceLine, { displayName: "Chart.ReferenceLine" });
Object.assign(ChartReferenceArea, { displayName: "Chart.ReferenceArea" });
