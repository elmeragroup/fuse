/**
 * The scenario runner of the chart world browser test: the chart a world renders, the steps that
 * change a world, the checks every sampled frame and every rest must pass, and the run that drives
 * a world through its steps at one device pixel ratio.
 */

import { expect } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import { Chart } from "../../src/components/chart/chart-namespace";
import type { ChartConfig } from "../../src/components/chart/chart-types";
import { LocaleProvider } from "../../src/intl/locale-context";
import { renderThemed } from "../themed-browser-render";
import {
  DECIMATE_ABOVE,
  SERIAL,
  domainOf,
  expected,
  lineOffset,
  pathForm,
  relays,
  show,
  windowOf,
} from "./world-model";
import type { Area, Datum, Expected, Line, Reading, Span, World } from "./world-model";
import { shoot } from "./world-reader";
import type { Mark, Shot } from "./world-reader";

type MetricsCdp = {
  send: ((
    method: "Emulation.setDeviceMetricsOverride",
    params: { width: number; height: number; deviceScaleFactor: number; mobile: boolean }
  ) => Promise<void>) &
    ((method: "Emulation.clearDeviceMetricsOverride") => Promise<void>);
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): MetricsCdp => cdp() as MetricsCdp;

/** Wait for one frame. */
export async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Emulate a device pixel ratio, which the test's afterEach clears. */
export async function setRatio(dpr: number): Promise<void> {
  await session().send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 768,
    deviceScaleFactor: dpr,
    mobile: false,
  });
  await frame();
}

/** Clear the emulated device metrics. */
export async function clearRatio(): Promise<void> {
  await session().send("Emulation.clearDeviceMetricsOverride");
}

/** A role list paints a gradient from each bar's tip, and missing readings take the quality column. */
export const CONFIG = {
  v: { label: "V", color: ["chart-1", "chart-3"], qualityKey: "q" },
} as const satisfies ChartConfig;

/** The stacked world's config: w, always positive, stacks over v. */
export const STACKED = {
  v: { label: "V", color: ["chart-1", "chart-3"], qualityKey: "q", stack: "s" },
  w: { label: "W", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

export type Row = {
  readonly name: string;
  readonly v: Reading;
  readonly w?: number;
  readonly q: "missing" | "measured";
  readonly u: number;
};

/** One row array per data array, so a render that changes something else keeps the data. */
export const rows = new WeakMap<readonly Datum[], readonly Row[]>();

export function rowsOf(data: readonly Datum[]): readonly Row[] {
  const known =
    rows.get(data) ??
    data.map(({ name, v, w }): Row => {
      const q = v === null ? "missing" : "measured";
      // The upper Panel's series, which a world with Panels draws only as an axis.
      return w === undefined ? { name, v, q, u: 1 } : { name, v, w, q, u: 1 };
    });
  rows.set(data, known);
  return known;
}

/** The config of a world with Panels: its own config and the upper Panel's series. */
export function panelledConfig<C extends ChartConfig>(config: C) {
  return { ...config, u: { label: "U", color: "chart-4" } } as const;
}

export function view(world: World) {
  const { line, area } = world;
  const config = world.stacked === true ? STACKED : CONFIG;
  const include = [world.include[0], world.include[1]];
  const marks = (
    <>
      <Chart.Bar dataKey="v" variant={world.variant} />
      <Chart.ReferenceLine y={0} />
      {line.axis === "value" ? (
        <Chart.ReferenceLine y={line.at} label="Linje" />
      ) : (
        <Chart.ReferenceLine x={line.name} label="Linje" />
      )}
      {area.axis === "value" ? (
        <Chart.ReferenceArea y1={area.from} y2={area.to} label="Bånd" />
      ) : (
        <Chart.ReferenceArea x1={area.first} x2={area.last} label="Bånd" />
      )}
      <Chart.ActiveValue dataKey="v" />
      <Chart.ActiveValueLine dataKey="v" />
      <Chart.Line dataKey="v" curve="linear" />
      <Chart.Dots dataKey="v" />
      {world.stacked === true ? <Chart.Line dataKey="w" curve="linear" /> : null}
    </>
  );
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: world.width }}>
        <Chart.Root
          data-intro="none"
          data={rowsOf(world.data)}
          config={world.panelled === true ? panelledConfig(config) : config}
          xKey="name"
          orientation={world.orientation}
          yInclude={world.panelled === true ? undefined : include}
          xRange={world.window === null ? undefined : [world.window[0], world.window[1]]}
          style={{ "--chart-plot-height": `${String(world.height)}px` }}
          aria-label="Verden">
          {world.panelled === true ? (
            <>
              <Chart.Panel series={["u"]}>
                <Chart.YAxis />
              </Chart.Panel>
              <Chart.Panel series={Object.keys(config)} yInclude={include}>
                {marks}
              </Chart.Panel>
            </>
          ) : (
            marks
          )}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

// The checks.

/** The edge of a span away from the baseline: a bar's tip, or the baseline itself for a flat bar. */
export function tipEdge(span: Span, baseline: number): number {
  const [a, b] = span;
  return Math.abs(a - baseline) > Math.abs(b - baseline) ? a : b;
}

export const near = (a: number, b: number) => Math.abs(a - b) <= SERIAL;
export const sameSpan = (a: Span, b: Span) => near(a[0], b[0]) && near(a[1], b[1]);

/** The checks of every frame: one pixel per coordinate, the side, and the references' own rules. */
export function faults(shot: Shot, world: World): string[] {
  const failures: string[] = [];
  const device = 1 / shot.plot.dpr;
  const { baseline } = shot;
  if (baseline === null) return ["no reference at 0"];
  const vertical = world.orientation === "vertical";
  // A decimated column spans its bucket's lowest extent to its highest, so it covers the baseline.
  const [first, last] = windowOf(world);
  const decimated = last - first + 1 > DECIMATE_ABOVE;
  for (const [name, bar] of shot.bars) {
    if (decimated) {
      if (bar.across[0] > baseline + SERIAL || bar.across[1] < baseline - SERIAL)
        failures.push(`column ${name} ${show(bar.across)} off baseline ${String(baseline)}`);
      continue;
    }
    if (!bar.across.some((edge) => near(edge, baseline))) {
      failures.push(`bar ${name} ${show(bar.across)} off baseline ${String(baseline)}`);
    }
    if (bar.negative === null) continue;
    const tip = tipEdge(bar.across, baseline);
    const side =
      Math.abs(tip - baseline) < device - SERIAL ? null : vertical ? tip > baseline : tip < baseline;
    if (side !== null && bar.negative !== side)
      failures.push(`bar ${name} side ${String(bar.negative)} at ${show(bar.across)}`);
  }
  for (const [name, tick] of shot.ticks) {
    if (!near(tick.base, baseline))
      failures.push(`tick ${name} at ${String(tick.base)} off baseline ${String(baseline)}`);
    if (tick.soft) failures.push(`tick ${name} between device pixels`);
  }
  // A decimated window's columns stand for buckets, so no column is the active reading's own.
  const activeBar = shot.active === null || decimated ? undefined : shot.bars.get(shot.active);
  if (activeBar !== undefined && shot.line !== null) {
    const tip = tipEdge(activeBar.across, baseline);
    const tips = {
      line: shot.line,
      overlay: shot.overlay === null ? tip : tipEdge(shot.overlay.across, baseline),
      value: shot.value?.tip ?? tip,
    };
    for (const [what, at] of Object.entries(tips)) {
      if (!near(at, tip)) failures.push(`${what} at ${String(at)} off the tip ${String(tip)}`);
    }
    // ActiveValue stands over its bar's middle, within the half pixel each of the two snaps.
    const middle = (activeBar.along[0] + activeBar.along[1]) / 2;
    if (shot.value !== null && Math.abs(shot.value.centre - middle) > device + SERIAL) {
      failures.push(`active value at ${String(shot.value.centre)} off its bar's middle ${String(middle)}`);
    }
  }
  // The pill draws where its shares place it, in Root's frame and in a Panel alike: centred on its
  // place, 0.25rem beyond the tip, above a vertical bar and right of a horizontal one. Layout keeps
  // positions in 1/64 px, which each edge rounds to.
  if (shot.value !== null) {
    const gap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) / 4;
    const edge = world.orientation === "vertical" ? shot.value.tip - gap : shot.value.tip + gap;
    const { drawn } = shot.value;
    if (Math.abs(drawn.centre - shot.value.centre) > 1 / 32 || Math.abs(drawn.edge - edge) > 1 / 32) {
      failures.push(
        `active value drawn at ${String(drawn.centre)}, ${String(drawn.edge)}, placed at ${String(shot.value.centre)}, ${String(edge)}`
      );
    }
  }
  // Every dot sits on a vertex of the line in every frame, as both draw one tween's numbers, the
  // vertex moved by the stroke's parity.
  const offset = lineOffset(shot.plot.dpr);
  for (const [along, across] of shot.dots) {
    if (!shot.vertices.some(([a, b]) => near(a, along) && near(b, across + offset)))
      failures.push(`dot at ${String(along)}, ${String(across)} off the line`);
  }
  for (const reference of shot.references) {
    if (reference.outside && reference.stacked) failures.push(`hidden ${reference.what} holds a label place`);
    if (reference.outside === reference.shown) {
      failures.push(
        `${reference.what} outside ${String(reference.outside)} but shown ${String(reference.shown)}`
      );
    }
    if (!reference.outside && reference.span[1] - reference.span[0] < device - SERIAL) {
      failures.push(`${reference.what} ${show(reference.span)} under a device pixel`);
    }
  }
  return failures;
}

/** Every mark against the model, exactly. */
export function mismatches(shot: Shot, model: Expected): string[] {
  const failures: string[] = [];
  if (shot.baseline === null || !near(shot.baseline, model.baseline)) {
    failures.push(`baseline ${String(shot.baseline)}, model ${String(model.baseline)}`);
  }
  if (model.columns !== null) {
    if (shot.columns.length !== model.columns.length)
      failures.push(`${String(shot.columns.length)} columns, model ${String(model.columns.length)}`);
    model.columns.forEach((column, index) => {
      const drawn = shot.columns[index];
      if (
        drawn === undefined ||
        !sameSpan(drawn.along, column.along) ||
        !sameSpan(drawn.across, column.across)
      ) {
        failures.push(
          `column ${String(index)} ${drawn ? `${show(drawn.along)} × ${show(drawn.across)}` : "missing"}, model ${show(column.along)} × ${show(column.across)}`
        );
      }
    });
  }
  for (const [name, bar] of model.decimated ? [] : model.bars) {
    const drawn = shot.bars.get(name);
    if (drawn === undefined) failures.push(`bar ${name} missing`);
    else {
      if (!sameSpan(drawn.along, bar.along) || !sameSpan(drawn.across, bar.across)) {
        failures.push(
          `bar ${name} ${show(drawn.along)} × ${show(drawn.across)}, model ${show(bar.along)} × ${show(bar.across)}`
        );
      }
      if (drawn.negative !== null && drawn.negative !== bar.negative)
        failures.push(`bar ${name} side ${String(drawn.negative)}`);
    }
  }
  for (const name of model.decimated ? [] : shot.bars.keys())
    if (!model.bars.has(name)) failures.push(`bar ${name} drawn, model none`);
  for (const [name, tick] of model.ticks) {
    const drawn = shot.ticks.get(name);
    if (drawn === undefined || !sameSpan(drawn.along, tick.along) || !near(drawn.base, tick.base)) {
      failures.push(`tick ${name} ${drawn ? show(drawn.along) : "missing"}, model ${show(tick.along)}`);
    }
  }
  if (shot.ticks.size !== model.ticks.size)
    failures.push(`${String(shot.ticks.size)} ticks, model ${String(model.ticks.size)}`);
  if ((shot.upper === null) !== (model.upper === null))
    failures.push(`w line ${String(shot.upper !== null)}`);
  for (const [what, drawn, points] of [
    ["vertex", shot.vertices, model.vertices],
    ["dot", shot.dots, model.points],
    ["w vertex", shot.upper ?? [], model.upper ?? []],
  ] as const) {
    if (drawn.length !== points.length)
      failures.push(`${String(drawn.length)} ${what}s, model ${String(points.length)}`);
    drawn.forEach(([along, across], index) => {
      const [a = Number.NaN, b = Number.NaN] = points[index] ?? [];
      if (!near(along, a) || !near(across, b))
        failures.push(
          `${what} ${String(index)} at ${String(along)}, ${String(across)}, model ${String(a)}, ${String(b)}`
        );
    });
  }
  if ((shot.overlay === null) !== (model.overlay === null))
    failures.push(`overlay ${shot.overlay ? "shown" : "hidden"}`);
  else if (
    shot.overlay &&
    model.overlay &&
    (!sameSpan(shot.overlay.along, model.overlay.along) ||
      !sameSpan(shot.overlay.across, model.overlay.across))
  ) {
    failures.push(
      `overlay ${show(shot.overlay.along)} × ${show(shot.overlay.across)}, model ${show(model.overlay.along)} × ${show(model.overlay.across)}`
    );
  }
  if (
    (shot.line === null) !== (model.line === null) ||
    (shot.line !== null && model.line !== null && !near(shot.line, model.line))
  ) {
    failures.push(`value line ${String(shot.line)}, model ${String(model.line)}`);
  }
  if (
    model.value !== null &&
    (shot.value === null ||
      !near(shot.value.centre, model.value.centre) ||
      !near(shot.value.tip, model.value.tip))
  ) {
    failures.push(`active value ${JSON.stringify(shot.value)}, model ${JSON.stringify(model.value)}`);
  }
  model.references.forEach((reference, index) => {
    const drawn = shot.references[index];
    if (drawn === undefined) return;
    if (drawn.outside === reference.visible) {
      failures.push(
        `${reference.what} outside ${String(drawn.outside)}, model visible ${String(reference.visible)}`
      );
    }
    if (drawn.shown !== reference.visible)
      failures.push(`${reference.what} shown ${String(drawn.shown)}, model ${String(reference.visible)}`);
    if (drawn.stacked !== reference.stacked) {
      failures.push(`${reference.what} stacked ${String(drawn.stacked)}, model ${String(reference.stacked)}`);
    }
    if (reference.visible && !sameSpan(drawn.span, reference.span)) {
      failures.push(`${reference.what} ${show(drawn.span)}, model ${show(reference.span)}`);
    }
  });
  return failures;
}

/** Marks one frame drew that moved more than they may since another, mapped by a resize's ratios. */
export function jumps(before: Shot, after: Shot, keys: (key: string) => boolean): string[] {
  const ratio = {
    along: after.plot.along / before.plot.along,
    across: after.plot.across / before.plot.across,
  };
  const failures: string[] = [];
  // A resize moves every column's span, which names it, so a column matches the one at its span
  // mapped into the new box, within the snapping slack of both its edges.
  const columns = [...after.marks.values()].filter((mark) => mark.along !== undefined);
  const resized = ratio.along !== 1;
  const columnAt = (span: Span): Mark | undefined => {
    const slack = (1 + 0.5 * Math.max(1, ratio.along)) / after.plot.dpr + SERIAL;
    const near = columns.filter(
      ({ along: drawn }) =>
        drawn !== undefined &&
        Math.abs(drawn[0] - span[0] * ratio.along) <= slack &&
        Math.abs(drawn[1] - span[1] * ratio.along) <= slack
    );
    return near.length === 1 ? near[0] : undefined;
  };
  for (const [key, mark] of before.marks) {
    if (!keys(key)) continue;
    const now = resized && mark.along !== undefined ? columnAt(mark.along) : after.marks.get(key);
    if (now === undefined || now.values.length !== mark.values.length) continue;
    mark.values.forEach((value, index) => {
      const scale = ratio[mark.axes[index] ?? "across"];
      // A snapped pixel mapped and the mapped value snapped differ by half a device pixel each.
      const slack = (1 + 0.5 * Math.max(1, scale)) / after.plot.dpr + (mark.hold ?? 0) + SERIAL;
      if (Math.abs((now.values[index] ?? 0) - value * scale) > slack) {
        failures.push(`${key}: ${mark.values.join(",")} → ${now.values.join(",")}`);
      }
    });
  }
  return failures;
}

// The steps.

export type Step =
  | { readonly kind: "update"; readonly readings: readonly Reading[] }
  /**
   * A vertical world grows to 2,400 categories, c0 on, which decimates its line and columns, with
   * a w of 1 to 5 stacked over v when `stacked` says so.
   */
  | { readonly kind: "dense"; readonly readings: readonly Reading[]; readonly stacked?: boolean }
  | { readonly kind: "add"; readonly v: Reading }
  | { readonly kind: "remove"; readonly at: number }
  | { readonly kind: "reorder" }
  | { readonly kind: "swap" }
  | { readonly kind: "window"; readonly from: number; readonly span: number }
  | { readonly kind: "resize"; readonly width: number; readonly height: number }
  | { readonly kind: "turn" }
  | { readonly kind: "activate"; readonly key: "{Home}" | "{End}" | "{ArrowRight}" }
  | { readonly kind: "reference"; readonly line: Line; readonly area: Area }
  | { readonly kind: "edge"; readonly end: "low" | "high"; readonly past: number }
  | { readonly kind: "axis" }
  | { readonly kind: "wait"; readonly ms: number };

/** A fresh name for an added category, unique across the run. */
export let named = 0;
export const fresh = () => {
  named += 1;
  return `n${String(named)}`;
};

/** A window kept only while both its names remain, in order. */
export function keepWindow(world: World, data: readonly Datum[]): World["window"] {
  if (world.window === null) return null;
  const names = data.map(({ name }) => name);
  const [a = -1, b = -1] = world.window.map((name) => names.indexOf(name));
  return a < 0 || b < a ? null : world.window;
}

/** The world a step leaves, or null for a step that renders nothing new. */
export function stepped(world: World, step: Step): World | null {
  const withData = (data: readonly Datum[]): World => ({ ...world, data, window: keepWindow(world, data) });
  switch (step.kind) {
    case "update":
      return withData(
        world.data.map((datum, index) => ({
          ...datum,
          v: step.readings[index % step.readings.length] ?? null,
        }))
      );
    case "dense":
      return world.orientation !== "vertical" || world.data.length > DECIMATE_ABOVE
        ? null
        : {
            ...withData(
              Array.from({ length: 2400 }, (_, index): Datum => {
                const datum = {
                  name: `c${String(index)}`,
                  v: step.readings[index % step.readings.length] ?? null,
                };
                return step.stacked === true ? { ...datum, w: 1 + (index % 5) } : datum;
              })
            ),
            stacked: step.stacked === true,
          };
    case "add":
      return world.data.length >= 100 ? null : withData([...world.data, { name: fresh(), v: step.v }]);
    case "remove":
      return world.data.length <= 3
        ? null
        : withData(world.data.filter((_, index) => index !== step.at % world.data.length));
    case "reorder":
      return withData([...world.data.slice(1), ...world.data.slice(0, 1)]);
    case "swap":
      // A stacked world leaves its stack when it shrinks, so its bars stay loose.
      return withData(
        world.data.length > 100
          ? world.data.slice(0, 5).map(({ name, v }) => ({ name, v }))
          : [
              ...world.data,
              ...Array.from({ length: 101 - world.data.length }, (_, index) => ({
                name: fresh(),
                v: 1 + (index % 7),
              })),
            ]
      );
    case "window": {
      const from = step.from % world.data.length;
      const to = Math.min(world.data.length - 1, from + step.span);
      const [a, b] = [world.data[from]?.name, world.data[to]?.name];
      const window = a === undefined || b === undefined || step.span === 0 ? null : ([a, b] as const);
      // A window that names what the chart already shows commits nothing.
      const same = window === null ? world.window === null : world.window?.join() === window.join();
      return same ? null : { ...world, window };
    }
    case "resize":
      return { ...world, width: step.width, height: step.height };
    case "turn":
      // A horizontal world draws every bar as an element, which 2,400 categories keep too slow, and
      // a world with Panels stays vertical.
      return world.data.length > DECIMATE_ABOVE || world.panelled === true
        ? null
        : { ...world, orientation: world.orientation === "vertical" ? "horizontal" : "vertical" };
    case "reference":
      return { ...world, line: step.line, area: step.area };
    case "edge": {
      const [low, high] = domainOf(world);
      const at = step.end === "low" ? low - step.past * (high - low) : high + step.past * (high - low);
      return { ...world, line: { axis: "value", at } };
    }
    case "axis":
      return {
        ...world,
        line:
          world.line.axis === "value"
            ? { axis: "slot", name: world.data[1]?.name ?? "c0" }
            : { axis: "value", at: 2 },
        area:
          world.area.axis === "value"
            ? { axis: "slot", first: world.data[1]?.name ?? "c0", last: world.data[2]?.name ?? "c0" }
            : { axis: "value", from: 1, to: 3 },
      };
    default:
      return null;
  }
}

/** Wait for every tween to end, then a few frames more. */
export async function settle(): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < 700) await frame();
}

/** Run a world through its steps, checking every sampled frame, and the model where marks rest. */
export async function run(dpr: number, first: World, steps: readonly Step[]): Promise<Shot> {
  await setRatio(dpr);
  let world = first;
  const { host, rerender, unmount } = renderThemed(view(world));
  const failures: string[] = [];
  const check = (when: string): Shot => {
    const shot = shoot(host, world);
    failures.push(...faults(shot, world).map((fault) => `${when}: ${fault}`));
    return shot;
  };
  // Every mark rests on the model, in a frame where none moves.
  const atRest = (when: string): Shot => {
    const shot = check(when);
    failures.push(
      ...mismatches(shot, expected(world, shot.plot, shot.active)).map((fault) => `${when}: ${fault}`)
    );
    return shot;
  };
  try {
    await frame();
    atRest("mount");
    for (const [index, step] of steps.entries()) {
      const when = `step ${String(index)} ${step.kind}`;
      if (step.kind === "wait") {
        const start = performance.now();
        while (performance.now() - start < step.ms) {
          await frame();
          check(when);
        }
        if (step.ms >= 700) atRest(`${when} at rest`);
        continue;
      }
      if (step.kind === "activate") {
        // DOM audit: the plot's single tab stop is the listbox's option.
        host.querySelector<HTMLElement>('[role="option"]')?.focus();
        // A key step places only the followers, which join the bar the step lands on, as check 1
        // holds them in every frame from here. The key arrives over frames in which the tweens run
        // on, so no frame before it compares.
        await userEvent.keyboard(step.key);
        check(when);
        continue;
      }
      // A reference's new value is not a data update, so it waits for the guides to rest first.
      if (step.kind === "reference" || step.kind === "edge") await settle();
      const next = stepped(world, step);
      if (next === null) continue;
      const before = check(`${when} before`);
      const previous = world;
      world = next;
      rerender(view(world));
      // A follower that re-rendered without Root paints in a microtask after the commit, which the
      // browser runs before it paints, so the frame the commit shows waits for it, and no frame more.
      await Promise.resolve();
      // Which marks the commit snaps: every mark on a turn, a window, an update that relays the plot
      // or one that changes the path form's categories, which crossfades it, and the references a
      // reference step changes. An update of the same categories moves the path form's columns.
      const data =
        step.kind === "update" ||
        step.kind === "dense" ||
        step.kind === "add" ||
        step.kind === "remove" ||
        step.kind === "reorder" ||
        step.kind === "swap";
      const snapsAll =
        step.kind === "turn" ||
        step.kind === "window" ||
        (data && ((pathForm(world) && step.kind !== "update") || relays(previous, world)));
      const snapsReferences = step.kind === "reference" || step.kind === "edge" || step.kind === "axis";
      if (snapsAll) {
        atRest(`${when} commit`);
        continue;
      }
      const after = check(when);
      const kept = (key: string) =>
        !(snapsReferences && key.startsWith("reference ")) &&
        !(pathForm(previous) !== pathForm(world) && (key.startsWith("bar ") || key.startsWith("column ")));
      const moved = jumps(before, after, kept);
      // A data update that mounts a mark while a tween still runs relays the plot, which the
      // browser's clock decides, so such a commit may instead snap every mark onto the model.
      const relayed =
        data && moved.length > 0 && mismatches(after, expected(world, after.plot, after.active)).length === 0;
      if (!relayed) failures.push(...moved.map((jump) => `${when}: ${jump}`));
      if (snapsReferences) {
        const model = expected(world, after.plot, after.active);
        const references = mismatches(after, model).filter(
          (fault) => fault.startsWith("line") || fault.startsWith("area")
        );
        failures.push(...references.map((fault) => `${when}: ${fault}`));
      }
    }
    await settle();
    const end = atRest("end");
    expect(failures.slice(0, 6)).toEqual([]);
    return end;
  } finally {
    unmount();
  }
}
