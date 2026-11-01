// The style cost of a bar chart, in Chromium. A bar's geometry lives in its polygon's points, which
// no CSS property reads, so moving a bar restyles nothing. Hover state reaches the layers and the
// followers, never a mark, and the tooltip's portal stays mounted once it has opened, so a close
// moves no node beside the chart. No rule puts :has() above the frame's parts, so a tick that
// mounts restyles no mark either. Every check below is the same count from that design: a recalc
// that reached the marks would restyle all 200 bars at once, so through each operation, a data
// update with its tween, a resize, and a pointer that enters and leaves the plot, every recalc
// restyles fewer elements than the chart has bars. The counts are Chromium's own, the elementCount
// of each UpdateLayoutTree in a trace of the test's frame. With rect geometry, the update's and
// the resize's recalcs each held every bar, and a leave restyled every part of the chart. So that a
// collector that stops seeing recalcs cannot pass, each trace ends with a control outside the
// measured operation: it restyles 300 elements of the same frame at once, between two marks, and
// the trace must count at least 300 for it.
import { describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

/** A frame of the page and the frames inside it. */
type FrameTree = {
  readonly frame: { readonly id: string; readonly url: string };
  readonly childFrames?: readonly FrameTree[];
};

/** One trace event, with the fields this file reads. */
type TraceEvent = {
  readonly name?: string;
  readonly ph?: string;
  readonly ts?: number;
  readonly args?: { readonly elementCount?: number; readonly beginData?: { readonly frame?: string } };
};

/** Chromium's JSON trace: a bare event list or an object holding one. */
type TraceFile = readonly TraceEvent[] | { readonly traceEvents: readonly TraceEvent[] };

/** The CDP calls the trace makes, which vitest types as an empty interface. */
type TraceCdp = {
  send: ((method: "Page.getFrameTree") => Promise<{ readonly frameTree: FrameTree }>) &
    ((
      method: "Tracing.start",
      params: {
        readonly transferMode: "ReturnAsStream";
        readonly traceConfig: { readonly includedCategories: readonly string[] };
      }
    ) => Promise<void>) &
    ((method: "Tracing.end") => Promise<void>) &
    ((
      method: "IO.read",
      params: { readonly handle: string; readonly size: number }
    ) => Promise<{ readonly data: string; readonly eof: boolean }>) &
    ((method: "IO.close", params: { readonly handle: string }) => Promise<void>);
  on: (event: "Tracing.tracingComplete", listener: (payload: { readonly stream: string }) => void) => void;
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send and on.
const session = (): TraceCdp => cdp() as TraceCdp;

/** Every frame of the tree, the page's first. */
const frames = (tree: FrameTree): FrameTree["frame"][] => [
  tree.frame,
  ...(tree.childFrames ?? []).flatMap(frames),
];

/** The frame id of this test's document, so recalcs of other frames stay out of the count. */
async function ownFrame(): Promise<string> {
  const { frameTree } = await session().send("Page.getFrameTree");
  const own = frames(frameTree).find(({ url }) => url === location.href);
  if (own === undefined) throw new Error(`no frame at ${location.href}`);
  return own.id;
}

/** How many elements the control restyles at once, more than the chart has bars. */
const CONTROL = 300;

/** The marks around the control, which the trace records with their times. */
const CONTROL_START = "restyle-control-start";
const CONTROL_END = "restyle-control-end";

/** A recalc of this frame: when it began and how many elements it restyled. */
type Recalc = { readonly ts: number; readonly elements: number };

/**
 * Every recalc of this test's frame in a trace, each with a numeric element count.
 *
 * @throws When a recalc of the frame carries no element count, so a changed event shape fails.
 */
function recalcs(events: readonly TraceEvent[], frame: string): Recalc[] {
  const found: Recalc[] = [];
  for (const { name, ph, ts, args } of events) {
    if (name !== "UpdateLayoutTree" || ph !== "X" || args?.beginData?.frame !== frame) continue;
    const elements = args.elementCount;
    if (elements === undefined || !Number.isFinite(elements) || ts === undefined) {
      throw new Error(`a recalc without its element count: ${JSON.stringify({ ts, args })}`);
    }
    found.push({ ts, elements });
  }
  return found;
}

/** When the trace recorded a mark. */
function markAt(events: readonly TraceEvent[], mark: string): number {
  const at = events.find(({ name }) => name === mark)?.ts;
  if (at === undefined) throw new Error(`the trace holds no ${mark} mark`);
  return at;
}

/**
 * The most elements one recalc restyles in this frame while `operation` runs and settles, checked
 * against a control the same trace measures after it.
 *
 * @param operation - What to trace, awaited to its end.
 * @returns The largest element count of any recalc of the operation, 0 when none ran.
 */
async function largestRestyle(operation: () => Promise<void>): Promise<number> {
  const cdpSession = session();
  const frame = await ownFrame();
  // The control's elements mount and take their first style before the trace starts.
  const control = document.createElement("div");
  const items = Array.from({ length: CONTROL }, () => control.appendChild(document.createElement("span")));
  document.body.append(control);
  void document.body.offsetHeight;
  let tracing = false;
  let text = "";
  try {
    await cdpSession.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      traceConfig: { includedCategories: ["devtools.timeline", "blink.user_timing"] },
    });
    tracing = true;
    await operation();
    // Each element's inline colour changes, which restyles each of them, in one forced recalc.
    performance.mark(CONTROL_START);
    for (const item of items) item.style.color = "rgb(1, 2, 3)";
    void document.body.offsetHeight;
    performance.mark(CONTROL_END);
    const stream = await endTrace(cdpSession);
    tracing = false;
    text = await readTrace(cdpSession, stream);
  } finally {
    control.remove();
    // An operation that failed leaves the trace running: end it and drop its stream, so the next
    // case starts its own trace and the first failure stays the one reported.
    if (tracing) await cdpSession.send("IO.close", { handle: await endTrace(cdpSession) });
  }
  // SAFETY: Chromium writes ReturnAsStream traces as JSON in its trace file format.
  const file = JSON.parse(text) as TraceFile;
  const events = "traceEvents" in file ? file.traceEvents : file;
  const [from, to] = [markAt(events, CONTROL_START), markAt(events, CONTROL_END)];
  const all = recalcs(events, frame);
  const largest = (within: (ts: number) => boolean) =>
    Math.max(0, ...all.filter(({ ts }) => within(ts)).map(({ elements }) => elements));
  expect(
    largest((ts) => ts >= from && ts <= to),
    "the control's recalc"
  ).toBeGreaterThanOrEqual(CONTROL);
  return largest((ts) => ts < from);
}

/** End the running trace and hand back its stream once Chromium has written it. */
function endTrace(cdpSession: TraceCdp): Promise<string> {
  // vitest unsubscribes a `once` listener twice at teardown, so each trace adds an `on` listener,
  // which a later trace's completion calls again to no effect.
  return new Promise<string>((resolve) => {
    cdpSession.on("Tracing.tracingComplete", ({ stream: handle }) => resolve(handle));
    void cdpSession.send("Tracing.end");
  });
}

/** Read a trace's stream to its end, and close it whether or not the read succeeds. */
async function readTrace(cdpSession: TraceCdp, stream: string): Promise<string> {
  let text = "";
  try {
    for (;;) {
      const chunk = await cdpSession.send("IO.read", { handle: stream, size: 1 << 20 });
      text += chunk.data;
      if (chunk.eof) return text;
    }
  } finally {
    await cdpSession.send("IO.close", { handle: stream });
  }
}

/** Wait through `ms` of frames, so every frame in between runs its rendering steps. */
async function wait(ms: number): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < ms) await new Promise((resolve) => requestAnimationFrame(resolve));
}

const CONFIG = {
  a: { label: "A", color: "chart-1", stack: "all" },
  b: { label: "B", color: "chart-2", stack: "all" },
  c: { label: "C", color: "chart-3", stack: "all" },
  d: { label: "D", color: "chart-4", stack: "all" },
} as const satisfies ChartConfig;

/** 50 slots of four stacked series, 200 bars, whose stack tops reach `top`. */
function rows(top: number) {
  return Array.from({ length: 50 }, (_, index) => ({
    name: `c${String(index)}`,
    a: index % 2 === 0 ? top - 3 : 1,
    b: 1,
    c: 1,
    d: 1,
  }));
}

function FourStacks({ top, width }: { readonly top: number; readonly width: number }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width }}>
        <Chart.Root data={rows(top)} config={CONFIG} xKey="name" aria-label="Fire stabler">
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.XAxis />
          {Object.keys(CONFIG).map((key) => (
            <Chart.Bar key={key} dataKey={key} />
          ))}
          <Chart.Crosshair />
          <Chart.Tooltip />
          <Chart.Legend />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

function bars(host: HTMLElement): number {
  // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
  return host.querySelectorAll('[data-slot="chart-bar"]').length;
}

function yTicks(host: HTMLElement): number {
  // DOM audit: tick labels are aria-hidden axis output.
  return host.querySelectorAll('[data-slot="chart-y-tick"]').length;
}

describe("the style cost of moving bars", () => {
  it("restyles no bar in a data update that drops ticks, nor in its tween", async () => {
    const { host, rerender } = renderThemed(<FourStacks top={9} width={800} />);
    await wait(1200);
    expect(bars(host)).toBe(200);
    const ticks = yTicks(host);
    const count = await largestRestyle(async () => {
      rerender(<FourStacks top={30} width={800} />);
      await wait(800);
    });
    // The update mounted and dropped value ticks, which a :has() above the parts would answer.
    expect(yTicks(host)).not.toBe(ticks);
    expect(count).toBeLessThan(bars(host));
  });

  it("restyles no bar in a resize", async () => {
    const { host, rerender } = renderThemed(<FourStacks top={9} width={800} />);
    await wait(1200);
    const count = await largestRestyle(async () => {
      rerender(<FourStacks top={9} width={640} />);
      await wait(600);
    });
    expect(count).toBeLessThan(bars(host));
  });
});

describe("the style cost of hover", () => {
  it("restyles no bar when the pointer enters the plot and leaves it, past every fade", async () => {
    const { host } = renderThemed(<FourStacks top={9} width={800} />);
    await wait(1200);
    // DOM audit: the plot's listbox is its one pointer target.
    const plot = host.querySelector<HTMLElement>('[role="listbox"]');
    if (plot === null) throw new Error("no plot");
    // The first open mounts the tooltip's portal, which stays from then on.
    await userEvent.hover(plot);
    await wait(400);
    await userEvent.unhover(plot);
    await wait(600);
    const count = await largestRestyle(async () => {
      await userEvent.hover(plot);
      await wait(400);
      await userEvent.unhover(plot);
      await wait(600);
    });
    expect(count).toBeLessThan(bars(host));
  });
});
