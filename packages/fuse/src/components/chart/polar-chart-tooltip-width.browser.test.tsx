import { Suspense, use, useSyncExternalStore } from "react";
import type { ComponentProps, ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { label, popup } from "../../../test/chart/marks";
import { SPOKE_CONFIG } from "../../../test/chart/polar-fixtures";
import {
  LETTER_SPOKES,
  opacity,
  pausedExit,
  Pie,
  side,
  tabIn,
  THREE_PART_BILL_CONFIG,
  viewport,
} from "../../../test/chart/polar-root";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

/** How many lines an element's text wraps to, or 0 when there is no element. */
function lineCount(element: Element | null): number {
  if (element === null) return 0;
  const range = document.createRange();
  range.selectNodeContents(element);
  // A range's client rects hold one box per line of each text run, so equal tops share a line.
  return new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size;
}

/** The width `text` takes on one line in the font `like` computes, measured outside any popup. */
function unwrappedWidth(like: Element, text: string): number {
  const style = getComputedStyle(like);
  const probe = document.createElement("span");
  probe.textContent = text;
  Object.assign(probe.style, {
    position: "absolute",
    whiteSpace: "nowrap",
    font: style.font,
    letterSpacing: style.letterSpacing,
  });
  document.body.append(probe);
  const { width } = probe.getBoundingClientRect();
  probe.remove();
  return width;
}

/** The open popup's width, or 0 while none is open. */
function popupWidth(): number {
  return popup()?.getBoundingClientRect().width ?? 0;
}

/** Renders a pie `width` pixels wide whose Tooltip renders `tooltip`, and tabs onto it. */
async function openPie(pie: {
  readonly width: number;
  readonly config?: ChartConfig;
  readonly tooltip: ReactNode;
}): Promise<void> {
  const { host } = renderThemed(
    <>
      <button type="button">før</button>
      <Pie width={pie.width} config={pie.config}>
        <PieChart.Tooltip>{pie.tooltip}</PieChart.Tooltip>
      </Pie>
    </>
  );
  await tabIn(host);
}

/** Suspends its Suspense boundary until `pending` settles. */
function Gate({ pending }: { readonly pending: Promise<void> }): null {
  use(pending);
  return null;
}

describe("the popup's width under a TooltipLabel that Fuse prints", () => {
  // Each label reads as Root's labels do. A pie prints its slices' names whatever the format, an
  // HTML element without children of its own prints the label Fuse gives it, and a consumer's
  // data-slot leaves the text as it is.
  it.each([
    { under: "a format the pie does not use", tooltip: <PieChart.TooltipLabel format="date" /> },
    { under: "a render element of an HTML tag", tooltip: <PieChart.TooltipLabel render={<strong />} /> },
    {
      under: "a TooltipLabel that takes its own data-slot",
      tooltip: <PieChart.TooltipLabel data-slot="bill-label" />,
      slot: "bill-label",
    },
  ])("opens at the widest name's width under $under", async (row) => {
    const longest = "Offentlige avgifter og gebyrer";
    await openPie({
      width: 300,
      config: { ...THREE_PART_BILL_CONFIG, avgifter: { label: longest, color: "chart-3" } },
      tooltip: row.tooltip,
    });
    // The data-slot row looks its label up by the consumer's slot.
    const line = (): HTMLElement | null =>
      popup()?.querySelector<HTMLElement>(`[data-slot="${row.slot ?? "chart-tooltip-label"}"]`) ?? null;
    await expect.poll(() => line()?.textContent).toBe("Strøm");
    await expect.poll(opacity).toBe(1);
    const first = popupWidth();
    const shown = line();
    if (shown === null) throw new Error("no label");
    // The longest name's width on one line, measured apart from the popup in the label's font.
    expect(first).toBeGreaterThanOrEqual(unwrappedWidth(shown, longest));
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect.poll(() => line()?.textContent).toBe(longest);
    // The step has laid the longest name out once it reads as one line.
    await expect.poll(() => lineCount(line())).toBe(1);
    // The popup opened as wide as the longest name, so the step changes no width.
    expect(Math.abs(popupWidth() - first)).toBeLessThanOrEqual(0.5);
  });
});

describe("the popup's width under a TooltipLabel that prints its own text", () => {
  /** The open popup's label line. */
  const labelLine = (): HTMLElement | null =>
    popup()?.querySelector<HTMLElement>('[data-slot="chart-tooltip-label"]') ?? null;

  /**
   * Expects the open popup to hold its label, once it reads as `text` matches, on one line, as wide
   * as the label's text set apart from the popup in the label's font.
   */
  async function expectOneLine(text: string | RegExp): Promise<void> {
    await expect.poll(() => label() ?? "").toMatch(text);
    await expect.poll(opacity).toBe(1);
    const line = labelLine();
    if (line === null) throw new Error("no label");
    expect(lineCount(line)).toBe(1);
    expect(popupWidth()).toBeGreaterThanOrEqual(unwrappedWidth(line, line.textContent));
  }

  it("opens a pie's popup as wide as a label whose render element brings its own text", async () => {
    // The text is wider than any slice's name, which the popup's estimate prints.
    const text = "Andel av månedens strømregning";
    await openPie({ width: 300, tooltip: <PieChart.TooltipLabel render={<span>{text}</span>} /> });
    await expectOneLine(text);
  });

  /** A bill whose last part's name is wider than a side lane holds. */
  const LONG_CONFIG = {
    ...THREE_PART_BILL_CONFIG,
    avgifter: { label: "Offentlige avgifter, gebyrer og merverdiavgift på strøm", color: "chart-3" },
  } as const;

  it("rests a short label of its own in a side lane, whatever the slices' names", async () => {
    // A side lane is capped below the long name's width, so a popup sized for that name would
    // take the lane below the dial.
    await viewport(1024, 768);
    await openPie({
      width: 650,
      config: LONG_CONFIG,
      tooltip: <PieChart.TooltipLabel render={<span>Detaljer</span>} />,
    });
    await expectOneLine("Detaljer");
    expect(["left", "right"]).toContain(side());
  });

  /** Uppercases a string label. */
  const uppercase = (children: ReactNode): ReactNode =>
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the consumer contract under test: a render function receives the label as string children
    typeof children === "string" ? children.toUpperCase() : children;

  /** Keeps a name of up to 30 characters and abbreviates a longer one. */
  const abbreviate = (children: ReactNode): ReactNode =>
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the consumer contract under test: a render function or component receives the label as string children
    typeof children === "string" && children.length > 30 ? `${children.slice(0, 28)}…` : children;

  /** A component that prints its children through `abbreviate`. */
  function Abbrev({ children, ...props }: ComponentProps<"span">): ReactNode {
    return <span {...props}>{abbreviate(children)}</span>;
  }

  /** The long bill with a first name wider than the popup's `min-width` that `abbreviate` keeps. */
  const ABBREVIATED_CONFIG = {
    ...LONG_CONFIG,
    strom: { label: "Strøm og nettleie i år", color: "chart-1" },
  } as const;

  /** Rows that name the active slice under the label. */
  const items = (
    <PieChart.TooltipItems>
      <PieChart.SeriesLabel />
    </PieChart.TooltipItems>
  );

  /**
   * Opens a pie's popup by key in a 220 px tall viewport and expects it to read `reads` once
   * shown, in a side lane inside the viewport, at least as wide as its label line set apart in the
   * label's font. No tooltip here prints the long last name in its label on the first slice. Sized
   * for that name, the popup would need the lane below or above the dial, which the viewport has
   * no room for.
   */
  async function openInShortViewport(row: {
    readonly width: number;
    readonly config: ChartConfig;
    readonly tooltip: ReactNode;
    readonly reads: string;
  }): Promise<{ readonly open: HTMLElement; readonly box: DOMRect; readonly text: number }> {
    await viewport(1024, 220);
    await openPie(row);
    await expect.poll(() => popup()?.textContent).toBe(row.reads);
    await expect.poll(opacity).toBe(1);
    const open = popup();
    const line = labelLine();
    if (open === null || line === null) throw new Error("no popup");
    const box = open.getBoundingClientRect();
    // The label's width on one line, measured apart from the popup in the label's font.
    const text = unwrappedWidth(line, line.textContent);
    expect(lineCount(line)).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(text);
    expect(["left", "right"]).toContain(side());
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
    return { open, box, text };
  }

  // The popup holds only its label line, so it is as wide as that line or its own `min-width`,
  // whichever is wider.
  it.each([
    {
      prints: "a label of its own",
      width: 495,
      config: LONG_CONFIG,
      tooltip: <PieChart.TooltipLabel render={<span>Detaljer</span>} />,
      reads: "Detaljer",
    },
    {
      prints: "a label of its own that reads as the first slice's name",
      width: 495,
      config: LONG_CONFIG,
      tooltip: <PieChart.TooltipLabel render={<span>Strøm</span>} />,
      reads: "Strøm",
    },
    {
      prints: "the name a render function abbreviates only when long",
      width: 560,
      config: ABBREVIATED_CONFIG,
      tooltip: (
        <PieChart.TooltipLabel render={(props) => <span {...props}>{abbreviate(props.children)}</span>} />
      ),
      reads: "Strøm og nettleie i år",
    },
    {
      prints: "the name a render component element abbreviates only when long",
      width: 560,
      config: ABBREVIATED_CONFIG,
      tooltip: <PieChart.TooltipLabel render={<Abbrev />} />,
      reads: "Strøm og nettleie i år",
    },
  ])("sizes a popup whose label prints $prints for that label inside a short viewport", async (row) => {
    const { open, box, text } = await openInShortViewport(row);
    const style = getComputedStyle(open);
    const sides = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"] as const;
    const frame = sides.reduce((sum, key) => sum + Number.parseFloat(style[key]), 0);
    // One pixel covers the popup's width rounded up to a whole pixel.
    expect(box.width).toBeLessThanOrEqual(Math.max(Number.parseFloat(style.minWidth), text + frame) + 1);
  });

  // The rows under the label print the slice's name.
  it.each([
    {
      prints: "the name uppercased by a render function",
      width: 495,
      config: LONG_CONFIG,
      tooltip: (
        <>
          <PieChart.TooltipLabel render={(props) => <span {...props}>{uppercase(props.children)}</span>} />
          {items}
        </>
      ),
      reads: "STRØMStrøm",
    },
    {
      prints: "nothing, under children that are undefined",
      width: 495,
      config: LONG_CONFIG,
      tooltip: (
        <>
          <PieChart.TooltipLabel>{undefined}</PieChart.TooltipLabel>
          {items}
        </>
      ),
      reads: "Strøm",
    },
  ])(
    "keeps a popup whose label prints $prints above its rows in a side lane inside a short viewport",
    async (row) => {
      await openInShortViewport(row);
    }
  );

  /**
   * Two rings that each fill 80 % of their own maximum, so both end at one angle, under a label
   * that a render function prints as it gets it. The second name is the wider.
   */
  function rings(first: string, second: string): ReactNode {
    return (
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 400 }}>
          <RadialChart.Root
            data={[
              { name: "varme", v: 160, limit: 200 },
              { name: "elbil", v: 176, limit: 220 },
            ]}
            config={{
              varme: { label: first, color: "chart-1" },
              elbil: { label: second, color: "chart-2" },
            }}
            nameKey="name"
            valueKey="v"
            maxKey="limit"
            aria-label="Budsjett">
            <RadialChart.Tooltip>
              <RadialChart.TooltipLabel render={(props) => <span {...props} />} />
            </RadialChart.Tooltip>
          </RadialChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** A radar series' name, wider than the popup's `min-width`. */
  const PRICE = "Pris per kilowattime med nettleie";

  // Each step keeps the popup's angle: the two rings end at one angle, and a step between a radar's
  // series keeps the spoke. Only the label's text changes, and the new text is the wider.
  it.each([
    {
      between: "rings at one share of their maximum",
      chart: rings("Oppvarming av huset", "Lading av elbil gjennom hele måneden"),
      first: "Oppvarming av huset",
      next: "Lading av elbil gjennom hele måneden",
    },
    {
      between: "a radar's series on one spoke under a label that names the series",
      chart: (
        <LocaleProvider locale="nb-NO">
          <button type="button">før</button>
          <div style={{ width: 400 }}>
            <RadarChart.Root
              data={LETTER_SPOKES}
              config={{ ...SPOKE_CONFIG, v: { label: PRICE, color: "chart-1" } }}
              nameKey="cat"
              aria-label="Radar">
              <RadarChart.Tooltip>
                <RadarChart.TooltipLabel
                  render={(props) => (
                    <span {...props}>
                      {props.children} <RadarChart.SeriesLabel />
                    </span>
                  )}
                />
              </RadarChart.Tooltip>
            </RadarChart.Root>
          </div>
        </LocaleProvider>
      ),
      // Focus starts on all series, which name no series.
      first: "a ",
      next: `a ${PRICE}`,
    },
  ])("widens the popup on a step between $between", async (row) => {
    await viewport(1024, 768);
    const { host } = renderThemed(row.chart);
    await tabIn(host);
    await expectOneLine(row.first);
    const first = labelLine();
    if (first === null) throw new Error("no label");
    // The new label's width on one line, measured apart from the popup in the label's font.
    const needed = unwrappedWidth(first, row.next);
    // The popup opens narrower than the new label, so only a measure after the step fits it.
    expect(popupWidth()).toBeLessThan(needed);
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(label).toBe(row.next);
    await expect.poll(popupWidth).toBeGreaterThanOrEqual(needed);
    expect(lineCount(labelLine())).toBe(1);
  });

  /**
   * A label line that cuts its text off at the popup's edge. New text then never changes the popup's
   * size, so no resize measures it, and only the watch on the popup's content can widen it.
   */
  const TRUNCATE = {
    display: "block",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  } as const;

  /** A text a test changes without rendering the chart again. */
  type NoteStore = {
    readonly read: () => string;
    readonly subscribe: (listener: () => void) => () => void;
    readonly write: (text: string) => void;
  };

  /** A store whose text starts empty. */
  function noteStore(): NoteStore {
    let text = "";
    const listeners = new Set<() => void>();
    return {
      read: () => text,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      write: (next) => {
        text = next;
        for (const listener of listeners) listener();
      },
    };
  }

  /** The store's text, which renders again on its own when the store changes. */
  function Note({ store }: { readonly store: NoteStore }): string {
    return useSyncExternalStore(store.subscribe, store.read);
  }

  /**
   * A pie whose label prints the slice's name and then the store's note. The Tooltip shares its
   * Suspense boundary with `children`, so the chart's options, which hold focus, stay out of it.
   */
  function notedPie(store: NoteStore, children?: ReactNode): ReactNode {
    return (
      <>
        <button type="button">før</button>
        <Pie width={400}>
          <Suspense fallback={null}>
            <PieChart.Tooltip>
              <PieChart.TooltipLabel
                render={(props) => (
                  <span {...props} style={TRUNCATE}>
                    {props.children}
                    <Note store={store} />
                  </span>
                )}
              />
            </PieChart.Tooltip>
            {children}
          </Suspense>
        </Pie>
      </>
    );
  }

  it("widens the popup for a label's new text after a Suspense boundary hides and reveals its Tooltip", async () => {
    await viewport(1024, 768);
    const store = noteStore();
    const { host, rerender } = renderThemed(notedPie(store));
    await tabIn(host);
    await expectOneLine("Strøm");
    const open = popup();
    const first = labelLine();
    if (open === null || first === null) throw new Error("no popup");
    const note = " og nettleie for hele måneden";
    // The new label's width on one line, measured apart from the popup in the label's font.
    const needed = unwrappedWidth(first, `Strøm${note}`);
    expect(open.getBoundingClientRect().width).toBeLessThan(needed);
    const { promise: pending, resolve: release } = Promise.withResolvers<void>();
    rerender(notedPie(store, <Gate pending={pending} />));
    // The boundary hides the popup's positioner, and the popup stays in the page.
    await expect.poll(() => open.getBoundingClientRect().width).toBe(0);
    release();
    await expect.poll(() => open.getBoundingClientRect().width).toBeGreaterThan(0);
    // The measures the reveal queues run before the note changes.
    await nextFrames(2);
    // The label prints new text while the slice stays and the chart does not render again.
    store.write(note);
    await expect.poll(label).toBe(`Strøm${note}`);
    expect(popup()).toBe(open);
    await expect.poll(() => open.getBoundingClientRect().width).toBeGreaterThanOrEqual(needed);
  });

  it("keeps a closing popup's width when a step to wider content closes before the next frame", async () => {
    await viewport(1024, 768);
    const { host } = renderThemed(rings("Oppvarming", "Lading av elbil gjennom hele måneden"));
    await tabIn(host);
    await expectOneLine("Oppvarming");
    const open = popup();
    if (open === null) throw new Error("no popup");
    // The layout width, which the exit's transform does not scale.
    const before = open.offsetWidth;
    // The paused exit keeps the closing popup in the page for the check.
    const exit = pausedExit(open);
    // A key goes to the option that has focus, which a step moves.
    const press = (key: string): void => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    };
    // React commits the step in a microtask, and the close follows in the same task, before the
    // frame that measures the step.
    press("ArrowDown");
    await Promise.resolve();
    expect(label()).toBe("Lading av elbil gjennom hele måneden");
    press("Escape");
    await exit;
    // A measure the step queued would run in the frame after it.
    await nextFrames(2);
    expect(open.offsetWidth).toBe(before);
  });

  it("opens a clock's popup as wide as a label in its own format", async () => {
    // The label's own format prints a long date and time, wider than the "00–01" range in Root's
    // format, which the popup's estimate prints.
    const day = Date.parse("2025-10-24T22:00:00Z");
    const format = {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    } as const;
    const data = Array.from({ length: 24 }, (_, hour) => ({ start: day + hour * 3_600_000, kwh: 1 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <button type="button">før</button>
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={data}
            config={{ kwh: { label: "kWh", color: "chart-1" } }}
            xKey="start"
            cycle="day"
            interval="hour"
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Column dataKey="kwh" />
            <ClockChart.Tooltip>
              <ClockChart.TooltipLabel format={format} />
            </ClockChart.Tooltip>
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await tabIn(host);
    // Intl may print a no-break space between the parts, which `\s` matches.
    await expectOneLine(/^lørdag\s25\.\soktober\skl\.\s00:00$/u);
  });
});
