/**
 * The DOM reader of the chart world browser test. It reads what Chromium drew, every mark's
 * attributes and the plot's measured box, into one shot that the runner compares with the world
 * model.
 */

import { SERIAL, show, windowOf } from "./world-model";
import type { Plot, Span, World } from "./world-model";

export function plotOf(host: HTMLElement, world: World): Plot {
  // DOM audit: the bar series box is the plot box every mark draws in.
  const rect = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
  const vertical = world.orientation === "vertical";
  // The plot's place in the document, which a key step that scrolls the page into view leaves alone,
  // as Root measured it before any scroll.
  const left = rect.left + scrollX;
  const top = rect.top + scrollY;
  return {
    dpr: devicePixelRatio,
    alongAt: vertical ? left : top,
    acrossAt: vertical ? top : left,
    along: vertical ? rect.width : rect.height,
    across: vertical ? rect.height : rect.width,
  };
}

// The drawing.

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function rectOf(element: Element): Rect {
  const [x = 0, y = 0, width = 0, height = 0] = ["x", "y", "width", "height"].map((name) =>
    Number(element.getAttribute(name))
  );
  return { x, y, width, height };
}

export function pathRects(d: string): Rect[] {
  return [...d.matchAll(/M([-\d.e]+) ([-\d.e]+)H([-\d.e]+)V([-\d.e]+)H[-\d.e]+Z/gu)].map(
    ([, x, y, x2, y2]) => ({
      x: Number(x),
      y: Number(y),
      width: Number(x2) - Number(x),
      height: Number(y2) - Number(y),
    })
  );
}

export function stroke(element: Element): number {
  return Number.parseFloat(getComputedStyle(element).strokeWidth);
}

/** A mark's numbers and which plot axis each runs on, for a resize's map. */
export type Mark = {
  readonly values: readonly number[];
  readonly axes: readonly ("along" | "across")[];
  /** How far containment may hold the mark from its mapped position, past the snapping slack. */
  readonly hold?: number;
  /** A path-form column's span along the slot axis, which names it, and which a resize maps. */
  readonly along?: Span;
};

/** What the chart draws in one frame, in CSS pixels from the plot's top left, by category name. */
export type Shot = {
  readonly plot: Plot;
  /** The path form's drawn columns, sorted along the plot then across it. */
  readonly columns: readonly { readonly along: Span; readonly across: Span }[];
  readonly baseline: number | null;
  readonly bars: ReadonlyMap<
    string,
    { readonly along: Span; readonly across: Span; readonly negative: boolean | null }
  >;
  readonly ticks: ReadonlyMap<
    string,
    { readonly along: Span; readonly base: number; readonly soft: boolean }
  >;
  readonly active: string | null;
  readonly overlay: { readonly along: Span; readonly across: Span; readonly negative: boolean } | null;
  readonly line: number | null;
  /**
   * ActiveValue's place from the shares its writer sets, its centre along the slot axis and the tip
   * it sits at, and where its pill drew: the middle of its box along the slot axis and the edge of
   * its box nearest the tip, both from the plot's start.
   */
  readonly value: {
    readonly centre: number;
    readonly tip: number;
    readonly drawn: { readonly centre: number; readonly edge: number };
  } | null;
  readonly references: readonly {
    readonly what: string;
    readonly outside: boolean;
    readonly shown: boolean;
    readonly stacked: boolean;
    readonly span: Span;
  }[];
  readonly marks: ReadonlyMap<string, Mark>;
  /** The Line's vertices, a lone reading's dot by its centre, and the dots' centres, in order. */
  readonly vertices: readonly (readonly [along: number, across: number])[];
  /** A stacked world's w Line vertices, or null without one. */
  readonly upper: readonly (readonly [along: number, across: number])[] | null;
  readonly dots: readonly (readonly [along: number, across: number])[];
};

/** A line's vertices from its path data: each command's end, and a lone reading's dot by its centre. */
export function lineVertices(d: string, vertical: boolean): (readonly [number, number])[] {
  return d
    .split("M")
    .filter((part) => part !== "")
    .flatMap((part) => {
      const pairs = [...part.matchAll(/(-?[\d.e]+),(-?[\d.e]+)/gu)].map(
        ([, a, b]) => [Number(a), Number(b)] as const
      );
      const [first] = pairs;
      if (first === undefined) return [];
      // A lone reading's dot starts 2.5 px before its centre and draws two arcs.
      const points = part.includes("a") ? [[first[0] + 2.5, first[1]] as const] : pairs;
      return points.map(([x, y]) => (vertical ? ([x, y] as const) : ([y, x] as const)));
    });
}

export function shoot(host: HTMLElement, world: World): Shot {
  const vertical = world.orientation === "vertical";
  const plot = plotOf(host, world);
  const { dpr } = plot;
  // DOM audit: the plot's marks are aria-hidden plot output, so their slots are the only locators.
  const layer = host.querySelector('[data-slot="chart-bar-series"]');
  const across = (rect: Rect): Span =>
    vertical ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width];
  const along = (rect: Rect): Span =>
    vertical ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height];
  const centreOf = (line: Element, onY: boolean) => Number(line.getAttribute(onY ? "y1" : "x1"));
  const marks = new Map<string, Mark>();
  const [first, last] = windowOf(world);
  const windowed = world.data.slice(first, last + 1);
  const present = windowed.flatMap(({ name, v }) => (v === null ? [] : [name]));
  const missing = windowed.flatMap(({ name, v }) => (v === null ? [name] : []));
  const bars = new Map<string, { along: Span; across: Span; negative: boolean | null }>();
  // DOM audit: element-form bars, one per present reading in window order.
  [...(layer?.querySelectorAll('[data-slot="chart-bar"]') ?? [])].forEach((body, index) => {
    const name = present[index] ?? "?";
    const rect = rectOf(body);
    bars.set(name, {
      along: along(rect),
      across: across(rect),
      negative: body.hasAttribute("data-negative"),
    });
    marks.set(`bar ${name}`, {
      values: [...along(rect), ...across(rect)],
      axes: ["along", "along", "across", "across"],
    });
  });
  // A column draws only for a reading other than 0, in slot order, so at rest the columns sorted
  // along the plot pair with those readings in window order, however densely they share pixels.
  // A tween's frame may draw a column on its way to or from 0, so each column's continuity mark is
  // keyed by its span along the slot axis, which a commit's first frame keeps, and a column that
  // starts to grow there has no mark before it. The copy a crossfade fades out is no column.
  // DOM audit: the path form's columns are aria-hidden plot output.
  const columns = [
    ...(layer?.querySelectorAll('[data-slot="chart-bar-path"]:not([data-quality]):not([data-outgoing] *)') ??
      []),
  ]
    .flatMap((path) => pathRects(path.getAttribute("d") ?? ""))
    .toSorted((a, b) => along(a)[0] - along(b)[0]);
  const drawnReadings = windowed.flatMap(({ name, v }) => (v === null || v === 0 ? [] : [name]));
  columns.forEach((rect, index) => {
    const name = drawnReadings[index] ?? "?";
    bars.set(name, { along: along(rect), across: across(rect), negative: null });
    marks.set(`column at ${show(along(rect))}`, {
      values: across(rect),
      axes: ["across", "across"],
      along: along(rect),
    });
  });
  // A tick's baseline edge lies half its device pixels, rounded down, past its near edge, and the
  // browser draws the plot's origin on the device pixel nearest its page position.
  const origin = Math.ceil(plot.acrossAt * dpr - 0.5) / dpr;
  const whole = (at: number) => Math.abs(at * dpr - Math.round(at * dpr)) <= SERIAL * dpr;
  const ticks = new Map<string, { along: Span; base: number; soft: boolean }>();
  const tick = (name: string, span: Span, centre: number, width: number) => {
    const base = centre - width / 2 + Math.floor(Math.round(width * dpr) / 2) / dpr;
    ticks.set(name, { along: span, base, soft: !whole(origin + centre - width / 2) || !whole(width) });
    return base;
  };
  // DOM audit: missing ticks are aria-hidden plot output, in window order.
  [...(layer?.querySelectorAll('[data-slot="chart-bar-missing"]') ?? [])].forEach((line, index) => {
    const name = missing[index] ?? "?";
    const [a = 0, b = 0] = (vertical ? ["x1", "x2"] : ["y1", "y2"]).map((end) =>
      Number(line.getAttribute(end))
    );
    const base = tick(name, [Math.min(a, b), Math.max(a, b)], centreOf(line, vertical), stroke(line));
    marks.set(`tick ${name}`, { values: [base], axes: ["across"] });
  });
  // DOM audit: the path form's missing ticks are aria-hidden plot output.
  const missingPath = layer?.querySelector(
    '[data-slot="chart-bar-path"][data-quality="missing"]:not([data-outgoing] *)'
  );
  if (missingPath) {
    [...(missingPath.getAttribute("d") ?? "").matchAll(/M([-\d.e]+) ([-\d.e]+)H([-\d.e]+)/gu)].forEach(
      ([, a, y, b], index) => {
        tick(missing[index] ?? "?", [Number(a), Number(b)], Number(y), stroke(missingPath));
      }
    );
  }
  // DOM audit: references are aria-hidden plot output, in the order they render.
  const references = [
    ...host.querySelectorAll('[data-slot="chart-reference-line"], [data-slot="chart-reference-area"]'),
  ];
  const [zero, ...guides] = references;
  const zeroRule = zero?.querySelector("line");
  const baseline = zeroRule ? centreOf(zeroRule, vertical) - stroke(zeroRule) / 2 : null;
  if (baseline !== null) marks.set("reference at 0", { values: [baseline], axes: ["across"] });
  // DOM audit: Root's own element carries the active state, and the option its position.
  const chart = host.querySelector('[data-slot="chart"]');
  const option = host.querySelector('[role="option"]');
  const position = Number(option?.getAttribute("aria-posinset") ?? 0) - 1;
  const active = chart?.hasAttribute("data-active") === true ? (windowed[position]?.name ?? null) : null;
  // DOM audit: the active overlay is aria-hidden plot output.
  const overlayNode = layer?.querySelector('[data-slot="chart-bar-active"][visibility="visible"]');
  const overlay = overlayNode
    ? {
        along: along(rectOf(overlayNode)),
        across: across(rectOf(overlayNode)),
        negative: overlayNode.hasAttribute("data-negative"),
      }
    : null;
  if (overlay) {
    marks.set(`overlay ${active ?? "?"}`, {
      values: [...overlay.along, ...overlay.across],
      axes: ["along", "along", "across", "across"],
    });
  }
  // DOM audit: the active value line is aria-hidden plot output.
  const valueLine = host.querySelector('[data-slot="chart-active-value-line"][data-value] line');
  const line = valueLine ? centreOf(valueLine, vertical) - stroke(valueLine) / 2 : null;
  if (line !== null) marks.set(`value line ${active ?? "?"}`, { values: [line], axes: ["across"] });
  // DOM audit: ActiveValue is aria-hidden plot output, placed by its two shares.
  const pill = host.querySelector<HTMLElement>('[data-slot="chart-active-value"]');
  const at = Number.parseFloat(pill?.style.getPropertyValue("--chart-value-at") ?? "");
  const top = Number.parseFloat(pill?.style.getPropertyValue("--chart-value-top") ?? "");
  const shownName = active ?? windowed.findLast(({ v }) => v !== null)?.name ?? null;
  const shownReading = windowed.find(({ name }) => name === shownName)?.v ?? null;
  const box = pill?.getBoundingClientRect() ?? new DOMRect();
  const drawn = vertical
    ? {
        centre: box.left + box.width / 2 + scrollX - plot.alongAt,
        edge: box.bottom + scrollY - plot.acrossAt,
      }
    : { centre: box.top + box.height / 2 + scrollY - plot.alongAt, edge: box.left + scrollX - plot.acrossAt };
  const value =
    Number.isFinite(at) && Number.isFinite(top) && shownReading !== null
      ? {
          centre: at * plot.along,
          tip: vertical ? (top / 100) * plot.across : plot.across * (1 - top / 100),
          drawn,
        }
      : null;
  // ActiveValue moves with the datum it shows, and a datum it starts to show is a mark of its own.
  if (value !== null) {
    marks.set(`active value ${shownName ?? "?"}`, {
      values: [value.centre, value.tip],
      axes: ["along", "across"],
    });
  }
  const shots = guides.map((reference, index) => {
    const what = index === 0 ? "line" : "area";
    const rule = reference.querySelector("line");
    const band = reference.querySelector("rect");
    const slotAxis = reference.getAttribute("data-axis") === "slot";
    // A slot reference runs along the slot axis, and a value reference across.
    const onY = slotAxis !== vertical;
    const span: Span = rule
      ? [centreOf(rule, onY) - stroke(rule) / 2, centreOf(rule, onY) + stroke(rule) / 2]
      : band
        ? slotAxis
          ? along(rectOf(band))
          : across(rectOf(band))
        : [0, 0];
    const outside = reference.hasAttribute("data-outside");
    const own = slotAxis ? "along" : "across";
    // Mid-tween a slot line's centre can snap onto its band's far edge, and containment holds the
    // rule back by up to its own width, so its continuity allows that width more.
    const hold = rule && slotAxis ? span[1] - span[0] : 0;
    if (!outside) marks.set(`reference ${what}`, { values: span, axes: [own, own], hold });
    // DOM audit: a reference's drawing and its label are aria-hidden output inside it.
    const svg = reference.querySelector("svg");
    const label = reference.querySelector('[data-slot="chart-reference-label"]');
    return {
      what,
      outside,
      shown: svg !== null && getComputedStyle(svg).display !== "none",
      stacked: label?.hasAttribute("data-stack") === true,
      span,
    };
  });
  // DOM audit: the line and its dots are aria-hidden plot output, and a crossfade's copy is no mark.
  const linePath = host.querySelector(
    '[data-slot="chart-line"][data-series="0"][data-part="solid"]:not([data-outgoing] *)'
  );
  const vertices = lineVertices(linePath?.getAttribute("d") ?? "", vertical);
  const upperPath = host.querySelector(
    '[data-slot="chart-line"][data-series="1"][data-part="solid"]:not([data-outgoing] *)'
  );
  const upper = upperPath === null ? null : lineVertices(upperPath.getAttribute("d") ?? "", vertical);
  const dots = [
    ...host.querySelectorAll('[data-slot="chart-dots"] [data-slot="chart-dot"]:not([data-outgoing] *)'),
  ].map((dot) => {
    const [x, y] = [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))];
    return vertical ? ([x, y] as const) : ([y, x] as const);
  });
  return {
    plot,
    columns: columns
      .map((rect) => ({ along: along(rect), across: across(rect) }))
      .toSorted((a, b) => a.along[0] - b.along[0] || a.across[0] - b.across[0]),
    baseline,
    bars,
    ticks,
    active,
    overlay,
    line,
    value,
    references: shots,
    marks,
    vertices,
    upper,
    dots,
  };
}
