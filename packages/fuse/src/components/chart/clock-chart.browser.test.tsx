// ClockChart's dial, marks and readouts in Chromium. Units under test: ClockChart.Root with its
// Grid, AngleAxis, Line, Area, Column, Dots, Now, Center and the shared readouts. Oracles, written
// by hand: equal slots, slot i of 24 centered at 15i + 7.5°; the radii on a [0, 4] domain
// with a 0.3 hole, √(0.09 + 0.91 · v/4) under "radial" and 0.3 + 0.7 · v/4 under "linear"; the pick
// by the pointer's angle alone, found by brute force; the threshold, whose wedges above it paint
// the theme's `above` role and the rest `below`, both resolved through a probe and compared through
// `@elmeragroup/color`, and whose line gradient turns hard at the threshold's own radius; the
// pixel floor, one device pixel along the radius, and the stack's floor on its outer segment alone;
// the 25-hour 26 October 2025, where "06" sits at 100.8°; the seam where the arrows wrap; Now at
// 11:30, 172.5°; the clock key map, where PageDown moves six hours; and the Tooltip under
// `defaultActiveX`, shown in its lane at rest and on the first pointer pass, and painted only while
// at least half of the dial is in view, in the bottom or top lane that `laneRest` documents.
import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { clockLayer, clockPath, dotPoints, wedgeRadii } from "../../../test/chart/clock";
import {
  framesThroughReport,
  label,
  mountedPopup,
  popup,
  popupFrame,
  popupPaints,
  shownFrames,
  surface,
  surfaceBox,
  visible,
} from "../../../test/chart/marks";
import type { PopupFrame } from "../../../test/chart/marks";
import { clientPoint, dialPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { fkasPrivate, renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import slots from "./format/fixtures/slots.json" with { type: "json" };

const HOUR = 3_600_000;

/** Midnight in Oslo on 25 October 2025, a 24-hour day. */
const DAY = Date.parse("2025-10-24T22:00:00Z");

/** A day of hourly rows from a list of values, `null` leaving a slot without a row. */
function hours(values: readonly (number | null)[], start = DAY, key = "kwh") {
  return values.flatMap((value, hour) =>
    value === null ? [] : [{ start: start + hour * HOUR, [key]: value }]
  );
}

/** 24 values: 4, 0, 2, 1 and then 1s. */
const VALUES = [4, 0, 2, 1, ...Array.from({ length: 20 }, () => 1)];

function Dial({
  data = hours(VALUES),
  config = { kwh: { label: "kWh", color: "chart-1" } },
  scale,
  inner,
  now,
  defaultActiveX,
  size,
  children,
}: {
  readonly data?: readonly Record<string, number | string | null>[];
  readonly config?: ChartConfig;
  readonly scale?: "radial" | "linear";
  /** The hole's radius as a share of the outer radius, 0.3 by default. */
  readonly inner?: number;
  readonly now?: number;
  readonly defaultActiveX?: number;
  /** The dial's `--chart-polar-size`, as a consumer sets it. */
  readonly size?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>
        <ClockChart.Root
          data={data}
          config={config}
          xKey="start"
          cycle="day"
          interval="hour"
          radiusScale={scale}
          innerRadius={inner}
          now={now}
          defaultActiveX={defaultActiveX}
          data-intro="none"
          style={size === undefined ? undefined : { "--chart-polar-size": size }}
          aria-label="Døgn">
          {children}
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("the dial's geometry", () => {
  it("picks the slot under the pointer's angle, whatever its distance from the center", async () => {
    const { host } = renderThemed(
      <Dial>
        <ClockChart.Column dataKey="kwh" />
      </Dial>
    );
    await nextFrames(1);
    const column = clockLayer(host, "clock-chart-column");
    const figure = polarFigure(host);
    let checked = 0;
    // Each probe sits at a slot's middle, past the 2 px dead band a held slot keeps.
    for (let ring = 0; ring < 3; ring += 1) {
      for (let step = 0; step < 36; step += 1) {
        const angle = ((step * 7) % 24) * 15 + 7.5;
        const radius = 0.35 + ring * 0.25;
        const radians = (angle * Math.PI) / 180;
        await hoverAt(...clientPoint(column, radius * Math.sin(radians), -radius * Math.cos(radians)));
        expect(figure.style.getPropertyValue("--chart-active")).toBe(String(Math.floor(angle / 15)));
        checked += 1;
      }
    }
    expect(checked).toBe(108);
  });
});

describe("the seam, Now and the keys", () => {
  it("steps one slot with the arrows, wrapping, and six hours with PageDown and PageUp", async () => {
    const { host } = renderThemed(
      <Dial>
        <ClockChart.Line dataKey="kwh" />
      </Dial>
    );
    const figure = polarFigure(host);
    const active = () => figure.style.getPropertyValue("--chart-active");
    await userEvent.tab();
    expect(active()).toBe("0");
    await userEvent.keyboard("{PageDown}");
    expect(active()).toBe("6");
    await userEvent.keyboard("{PageUp}{PageUp}");
    expect(active()).toBe("18");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(active()).toBe("0");
    expect(page.getByRole("listbox").element().getAttribute("aria-orientation")).toBe("horizontal");
  });
});

describe("a datum on a coarse reading", () => {
  it("marks and emphasizes an hourly reading from any quarter of its hour", async () => {
    // A quarter-hour dial with an hourly reading of 3 on each :00 row and Now at 00:15, the second
    // quarter, which the 00:00 reading covers. The Marker's dot sits at that reading's vertex, its
    // ValueLabel prints 3, and the Column's emphasis on "now" outlines its one wedge.
    const quarters = slots["quarter-hour"]["Europe/Oslo"]["2025-10-25"].utc_start.map((start) =>
      Date.parse(start)
    );
    const rows = quarters.map((start, slot) =>
      slot % 4 === 0 ? { start, kwh: 3, price: 1 } : { start, price: 1 }
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={rows}
            config={{
              kwh: { label: "kWh", color: "chart-1", interval: "hour" },
              price: { label: "Pris", color: "chart-2" },
            }}
            xKey="start"
            cycle="day"
            interval="quarter-hour"
            yInclude={[0, 4]}
            now={quarters[1]}
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Column dataKey="kwh" emphasis="now" />
            <ClockChart.Marker dataKey="kwh" at="now">
              <ClockChart.ValueLabel />
            </ClockChart.Marker>
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await nextFrames(1);
    // The marker's dots, its pill and the emphasis are aria-hidden plot output.
    const marker = clockLayer(host, "clock-chart-marker");
    expect(dotPoints(clockPath(marker, "dots"))).toHaveLength(1);
    expect(host.querySelector('[data-slot="clock-chart-value-label"]')?.textContent).toBe("3");
    const emphasis = clockLayer(host, "clock-chart-column").querySelector('[data-part="emphasis"]');
    expect(wedgeRadii(emphasis?.getAttribute("d") ?? "")).toHaveLength(1);
  });
});

describe("a ReferenceArea's label", () => {
  it("prints a time sector's range in Root's locale and zone through the label's {value}", async () => {
    // The sector holds the hours from 17:00 to 19:00 in Oslo, so it runs from 17:00 to 20:00, which
    // nb-NO writes 24-hour, its ends joined by an en dash as the value annulus joins its values.
    const { host } = renderThemed(
      <Dial>
        <ClockChart.ReferenceArea
          x1={DAY + 17 * HOUR}
          x2={DAY + 19 * HOUR}
          label="Topp {value}"
          format="time"
        />
      </Dial>
    );
    await nextFrames(1);
    // The area's label is aria-hidden plot text, read by its part.
    const text = host.querySelector(
      '[data-slot="clock-chart-reference-area"] > [data-part="label"]'
    )?.textContent;
    expect(text).toBe("Topp 17:00\u201320:00");
  });

  it("prints the same range when the sector takes the default format", async () => {
    const { host } = renderThemed(
      <Dial>
        <ClockChart.ReferenceArea x1={DAY + 17 * HOUR} x2={DAY + 19 * HOUR} label="Topp {value}" />
      </Dial>
    );
    await nextFrames(1);
    // The area's label is aria-hidden plot text, read by its part.
    const text = host.querySelector(
      '[data-slot="clock-chart-reference-area"] > [data-part="label"]'
    )?.textContent;
    expect(text).toBe("Topp 17:00\u201320:00");
  });
});

describe("a reference's sentence", () => {
  // The cartesian references' contract: the drawing and the label are hidden from readers, and one
  // visually hidden sentence, outside any aria-hidden subtree, always carries the value or the range,
  // in the dictionary's pattern without a label and as "label: value" with one. nb-NO's patterns are
  // "Referanselinje: …", "Område: …" and "… til …", and it speaks a clock time as "kl. 06:00",
  // joined by a no-break space. On a dial of hours a reference prints instants by default: a spoke
  // its slot's start, a sector its first slot's start and its last slot's end. A reference that
  // draws nothing keeps its sentence.
  const rows = hours(Array.from({ length: 24 }, (_, hour) => (hour % 2 === 0 ? 100 : 200)));

  it.each([
    ["a value line with a label", <ClockChart.ReferenceLine key="r" y={150} label="Mål" />, "Mål: 150"],
    ["a value line past the rim", <ClockChart.ReferenceLine key="r" y={300} label="Mål" />, "Mål: 300"],
    ["a value line with no label", <ClockChart.ReferenceLine key="r" y={150} />, "Referanselinje: 150"],
    [
      "a spoke at 06:00",
      <ClockChart.ReferenceLine key="r" x={DAY + 6 * HOUR} label="Start" />,
      "Start: kl.\u00a006:00",
    ],
    [
      "a spoke at 06:00 in an explicit format",
      <ClockChart.ReferenceLine key="r" x={DAY + 6 * HOUR} label="Start" format="time" />,
      "Start: kl.\u00a006:00",
    ],
    [
      "a value band with no label",
      <ClockChart.ReferenceArea key="r" y1={200} y2={100} />,
      "Område: 100 til 200",
    ],
    [
      "a sector from 17:00 to 20:00",
      <ClockChart.ReferenceArea
        key="r"
        x1={DAY + 17 * HOUR}
        x2={DAY + 19 * HOUR}
        label="Topp"
        format="time"
      />,
      "Topp: kl.\u00a017:00 til kl.\u00a020:00",
    ],
    [
      "a sector from 17:00 to 20:00 in the default format",
      <ClockChart.ReferenceArea key="r" x1={DAY + 17 * HOUR} x2={DAY + 19 * HOUR} label="Topp" />,
      "Topp: kl.\u00a017:00 til kl.\u00a020:00",
    ],
  ] as const)("speaks %s", async (_, reference, spoken) => {
    const { host } = renderThemed(
      <Dial data={rows} scale="linear">
        {reference}
      </Dial>
    );
    await nextFrames(1);
    // The sentence is visually hidden text on its slot, the cartesian references' own.
    const sentence = host.querySelector('[data-slot="chart-reference-text"]');
    expect(sentence?.textContent).toBe(spoken);
    expect(sentence?.closest('[aria-hidden="true"]')).toBeNull();
    // The visible drawing stays hidden from readers.
    const drawing = host.querySelector('[data-slot^="clock-chart-reference"]');
    expect(drawing?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("a reference's default slot text on a coarse dial", () => {
  // Every slot of a year of months and a week of days starts at local midnight, so a clock time
  // would read 00:00 for each. The default names the slot as the cartesian references do: the
  // month in en-US's "March 2025", joined by a no-break space, and the day as its date, never a
  // time. en-US speaks a range as "… to …".
  /** A year of months or a week of days, each slot starting at its first local midnight in Oslo. */
  function Coarse({
    cycle,
    children,
  }: {
    readonly cycle: "year" | "week";
    readonly children: React.ReactNode;
  }) {
    const starts =
      cycle === "year"
        ? Array.from({ length: 12 }, (_, month) =>
            Date.parse(
              `2025-${String(month + 1).padStart(2, "0")}-01T00:00:00${month >= 3 && month <= 9 ? "+02:00" : "+01:00"}`
            )
          )
        : // Monday 27 October 2025 onwards, all in CET.
          Array.from({ length: 7 }, (_, day) => Date.parse("2025-10-27T00:00:00+01:00") + day * 24 * HOUR);
    return (
      <LocaleProvider locale="en-US" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={starts.map((start) => ({ start, kwh: 1 }))}
            config={{ kwh: { label: "kWh", color: "chart-1" } }}
            xKey="start"
            cycle={cycle}
            interval={cycle === "year" ? "month" : "day"}
            data-intro="none"
            aria-label="Dial">
            {children}
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The reference's visually hidden sentence. */
  const sentence = (host: HTMLElement) =>
    // The sentence is visually hidden text on its slot.
    host.querySelector('[data-slot="chart-reference-text"]')?.textContent ?? "";

  it("names the month on a year of months", async () => {
    const { host } = renderThemed(
      <Coarse cycle="year">
        <ClockChart.ReferenceLine x={Date.parse("2025-03-01T00:00:00+01:00")} label="Start" />
      </Coarse>
    );
    await nextFrames(1);
    expect(sentence(host)).toBe("Start: March\u00a02025");
  });

  it("names the day on a week of days", async () => {
    const { host } = renderThemed(
      <Coarse cycle="week">
        <ClockChart.ReferenceLine x={Date.parse("2025-10-29T00:00:00+01:00")} label="Start" />
      </Coarse>
    );
    await nextFrames(1);
    expect(sentence(host)).toMatch(/^Start: .*29/u);
    expect(sentence(host)).not.toMatch(/00:00|12:00/u);
  });

  it("names the first and the last month of a sector", async () => {
    const { host } = renderThemed(
      <Coarse cycle="year">
        <ClockChart.ReferenceArea
          x1={Date.parse("2025-06-01T00:00:00+02:00")}
          x2={Date.parse("2025-08-01T00:00:00+02:00")}
          label="Summer"
        />
      </Coarse>
    );
    await nextFrames(1);
    expect(sentence(host)).toBe("Summer: June\u00a02025 to August\u00a02025");
  });

  it("keeps an explicit format ahead of the default", async () => {
    const { host } = renderThemed(
      <Coarse cycle="year">
        <ClockChart.ReferenceLine x={Date.parse("2025-03-01T00:00:00+01:00")} label="Start" format="year" />
      </Coarse>
    );
    await nextFrames(1);
    expect(sentence(host)).toBe("Start: 2025");
  });
});

describe("the default tooltip over a stack", () => {
  it("adds one total row for a stack of two series, as the table and the option do", async () => {
    // Household 2 and cabin 1 at 00:00 stack to 3, which the total row prints.
    const rows = hours(Array.from({ length: 24 }, () => 2)).map((row) => ({ ...row, cabin: 1 }));
    renderThemed(
      <Dial
        data={rows}
        config={{
          kwh: { label: "Husholdning", color: "chart-1", stack: "home" },
          cabin: { label: "Hytte", color: "chart-2", stack: "home" },
        }}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Column dataKey="cabin" />
        <ClockChart.Tooltip />
      </Dial>
    );
    await userEvent.tab();
    // The popup portals out of the host, and its total row carries its slot.
    await expect.poll(() => document.querySelectorAll('[data-slot="chart-tooltip-total"]').length).toBe(1);
    expect(document.querySelector('[data-slot="chart-tooltip-total"]')?.textContent).toContain("3");
  });
});

/** The gap the bottom and top lanes keep from the dial, as `laneRest` in `layout/polar-lane.ts` documents. */
const LANE_GAP = 8;

/**
 * What one frame shows: whether the popup is open and whether it paints, its positioner's box, and
 * the dial's box and the viewport's height then. The positioner carries the popup to its lane, and
 * the popup's own entrance zooms and slides it inside, so the lane is the positioner's box.
 */
type Shown = PopupFrame & {
  readonly placed: DOMRect;
  readonly dial: DOMRect;
  readonly height: number;
};

/**
 * Reads the frame now.
 *
 * @param host - The rendered chart's host.
 * @returns What the frame shows.
 */
function shown(host: HTMLElement): Shown {
  return {
    ...popupFrame(),
    placed: mountedPopup()?.parentElement?.getBoundingClientRect() ?? new DOMRect(),
    dial: surfaceBox(host),
    height: window.innerHeight,
  };
}

/**
 * How far a popup sits from its lane, or null when it sits in it. In a 320 px figure no side lane
 * has room, so the popup takes the bottom lane, its top one gap below the dial, while the room from
 * there to the viewport's bottom holds it, and the top lane, its bottom one gap above the dial,
 * otherwise. Both lanes center on the dial. The oracle is that placement rule, applied to the dial's
 * box and the viewport of the frame that painted the popup.
 *
 * @param frame - The frame that painted the popup.
 * @returns The miss, or null.
 */
function laneMiss({ placed, dial, height }: Shown): string | null {
  const below = dial.bottom + LANE_GAP;
  const lane = below + placed.height <= height ? "bottom" : "top";
  const edge = lane === "bottom" ? placed.top - below : placed.bottom - (dial.top - LANE_GAP);
  const across = (placed.left + placed.right) / 2 - (dial.left + dial.right) / 2;
  return Math.abs(edge) <= 1 && Math.abs(across) <= 1
    ? null
    : `${lane} lane missed by ${String(edge)} px, ${String(across)} px across`;
}

/** The frames that painted a popup. */
const paintedFrames = (frames: readonly Shown[]) => frames.filter((frame) => frame.painted);

/** How far each painted frame sits from its lane, leaving out the frames that sit in it. */
const laneMisses = (frames: readonly Shown[]) =>
  paintedFrames(frames)
    .map(laneMiss)
    .filter((miss) => miss !== null);

/**
 * Expects the popup to have painted, and every painted frame, the first one included, to sit in its lane.
 *
 * @param frames - The frames recorded.
 */
function expectInLane(frames: readonly Shown[]): void {
  expect(paintedFrames(frames).length, "painted frames").toBeGreaterThan(0);
  expect(laneMisses(frames)).toEqual([]);
}

describe("the tooltip under defaultActiveX", () => {
  /** The open popup. */
  function opened(): HTMLElement {
    const open = popup();
    if (open === null) throw new Error("no open popup");
    return open;
  }

  it("shows the default item's popup in its lane and updates it on the first pointer pass", async () => {
    // 17:00 is active before any pointer, so its popup opens once the dial's first in-view report
    // lands. The pass moves the active hour to 04:00, slot 4 at 67.5°. The oracle is the slot labels
    // and the Tooltip's lane rule: the popup paints, fully opaque, in the bottom lane, at rest and
    // after the pass, since a step never moves the bottom lane.
    const { host } = renderThemed(
      <Dial defaultActiveX={DAY + 17 * HOUR}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Tooltip />
      </Dial>
    );
    await expect.poll(label).toBe("17–18");
    await expect
      .poll(() => {
        const frame = shown(host);
        return frame.painted && laneMiss(frame) === null;
      })
      .toBe(true);
    const column = clockLayer(host, "clock-chart-column");
    for (const angle of [37.5, 52.5, 67.5]) {
      const { x, y } = dialPoint(angle, 0.6);
      await hoverAt(...clientPoint(column, x, y));
    }
    await expect.poll(label).toBe("04–05");
    const open = opened();
    await expect.poll(() => getComputedStyle(open).opacity).toBe("1");
    expect(visible(open)).toBe(true);
    expect(laneMiss(shown(host))).toBeNull();
  });
});

describe("the default item's popup while its dial is out of view", () => {
  afterEach(async () => {
    window.scrollTo(0, 0);
    await page.viewport(414, 896);
  });

  /** Whether the popup has finished opening: it paints, fully opaque, with no entrance running. */
  function settledOpen(): boolean {
    const element = mountedPopup();
    return (
      element !== null &&
      element.hasAttribute("data-open") &&
      !element.hasAttribute("data-starting-style") &&
      visible(element) &&
      getComputedStyle(element).opacity === "1" &&
      element.getAnimations().every((animation) => animation.playState !== "running")
    );
  }

  /** Records each frame from before `action` until the popup has finished opening. */
  function framesUntilShown(host: HTMLElement, action: () => void): Promise<Shown[]> {
    const frames = recordFrames(() => shown(host), settledOpen);
    action();
    return frames;
  }

  /** Records each frame from before `action` until the popup stops painting. */
  function framesUntilHidden(host: HTMLElement, action: () => void): Promise<Shown[]> {
    const frames = recordFrames(
      () => shown(host),
      () => !popupPaints()
    );
    action();
    return frames;
  }

  /** The scroll that leaves a share of the dial's height above the viewport's bottom edge. */
  function scrollShowing(host: HTMLElement, share: number): number {
    const box = surfaceBox(host);
    return box.top + window.scrollY + share * box.height - window.innerHeight;
  }

  function DefaultDial({ data }: { readonly data?: readonly Record<string, number | string | null>[] }) {
    return (
      <Dial data={data} defaultActiveX={DAY + 17 * HOUR}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Tooltip />
      </Dial>
    );
  }

  it("keeps the popup closed below the fold and under 30% in view, and opens it in its lane at 70%", async () => {
    // 17:00 is active by default and the dial sits 1,500 px below a 700 px viewport. The oracle is
    // the rule that a default item's popup shows only while at least half the dial's height is in
    // view, with the scroll positions worked out from the dial's box: none of it in view, 30%, then
    // 70%, back to 30%, 70% again, then none, then 70% once more.
    await page.viewport(800, 700);
    let host: HTMLElement = document.body;
    const mounted = await framesThroughReport(
      () => shown(host),
      () => {
        ({ host } = renderThemed(
          <>
            <div style={{ height: 1500 }} />
            <DefaultDial />
            <div style={{ height: 1500 }} />
          </>
        ));
        expect(popup()).toBeNull();
        return surface(host);
      }
    );
    expect(shownFrames(mounted)).toEqual([]);
    const scrollTo = (top: number) => () => {
      window.scrollTo(0, top);
      return surface(host);
    };
    expect(shownFrames(await framesThroughReport(() => shown(host), scrollTo(5)))).toEqual([]);
    const least = scrollShowing(host, 0.3);
    expect(shownFrames(await framesThroughReport(() => shown(host), scrollTo(least)))).toEqual([]);
    const most = scrollShowing(host, 0.7);
    expectInLane(await framesUntilShown(host, scrollTo(most)));
    await expect.poll(label).toBe("17–18");
    // Back at 30% the popup closes, so a cutoff under 30% fails here even when its wrong open is
    // still transparent.
    window.scrollTo(0, least);
    await expect.poll(popup).toBeNull();
    expectInLane(await framesUntilShown(host, scrollTo(most)));
    // Scrolling the dial out closes the popup with no exit: it paints only in its lane, and stops.
    expect(laneMisses(await framesUntilHidden(host, scrollTo(0)))).toEqual([]);
    expectInLane(await framesUntilShown(host, scrollTo(most)));
  });

  it("paints no popup under display: none, and opens it in its lane when the dial shows", async () => {
    // The oracle is the same rule: a dial under display: none is not in view.
    let host: HTMLElement = document.body;
    const mounted = await framesThroughReport(
      () => shown(host),
      () => {
        ({ host } = renderThemed(
          <div data-testid="hidden" style={{ display: "none" }}>
            <DefaultDial />
          </div>
        ));
        expect(popup()).toBeNull();
        return surface(host);
      }
    );
    expect(shownFrames(mounted)).toEqual([]);
    const hidden = host.querySelector<HTMLElement>('[data-testid="hidden"]');
    if (hidden === null) throw new Error("no hidden wrapper");
    expectInLane(
      await framesUntilShown(host, () => {
        hidden.style.display = "";
      })
    );
  });

  it("paints no popup in the first resize report after an ancestor of a shown dial goes display: none", async () => {
    // The popup rests in its lane, then its ancestor goes display: none. The oracle is the rule that
    // a close because the dial left view paints no exit: the first resize report that sees the dial
    // with no box runs before that frame paints, and by then the popup is closed and no longer
    // paints.
    const { host } = renderThemed(
      <div data-testid="hidden">
        <DefaultDial />
      </div>
    );
    const hidden = host.querySelector<HTMLElement>('[data-testid="hidden"]');
    if (hidden === null) throw new Error("no hidden wrapper");
    expectInLane(await framesUntilShown(host, () => undefined));
    const dial = surface(host);
    const atHide = new Promise<PopupFrame>((resolve) => {
      const sizes = new ResizeObserver((entries) => {
        const box = entries.at(-1)?.contentRect;
        if (box === undefined) return;
        if (box.width > 0 && box.height > 0) {
          // A new observer's first report measures the dial with its box. The ancestor goes
          // display: none in the next frame's callbacks, which run before that frame's resize
          // reports.
          requestAnimationFrame(() => {
            hidden.style.display = "none";
          });
          return;
        }
        sizes.disconnect();
        resolve(popupFrame());
      });
      onTestFinished(() => {
        sizes.disconnect();
      });
      sizes.observe(dial);
    });
    expect(await atHide).toEqual({ open: false, painted: false });
  });

  it("paints no popup outside a scrolling panel, and opens it in its lane once the panel scrolls to the dial", async () => {
    // The panel sits in the viewport, and its dial starts 800 px down its scroll, out of its view.
    let host: HTMLElement = document.body;
    const mounted = await framesThroughReport(
      () => shown(host),
      () => {
        ({ host } = renderThemed(
          <div data-testid="panel" style={{ height: 300, overflow: "auto" }}>
            <div style={{ height: 800 }} />
            <DefaultDial />
          </div>
        ));
        expect(popup()).toBeNull();
        return surface(host);
      }
    );
    expect(shownFrames(mounted)).toEqual([]);
    const panel = host.querySelector<HTMLElement>('[data-testid="panel"]');
    if (panel === null) throw new Error("no panel");
    expectInLane(
      await framesUntilShown(host, () => {
        panel.scrollTop = 800;
      })
    );
  });

  it("opens the popup in its lane when a sibling collapses and brings the dial into view with no scroll", async () => {
    await page.viewport(800, 700);
    let host: HTMLElement = document.body;
    const mounted = await framesThroughReport(
      () => shown(host),
      () => {
        ({ host } = renderThemed(
          <>
            <div data-testid="spacer" style={{ height: 1500 }} />
            <DefaultDial />
          </>
        ));
        expect(popup()).toBeNull();
        return surface(host);
      }
    );
    expect(shownFrames(mounted)).toEqual([]);
    const spacer = host.querySelector<HTMLElement>('[data-testid="spacer"]');
    if (spacer === null) throw new Error("no spacer");
    expectInLane(
      await framesUntilShown(host, () => {
        spacer.style.height = "0px";
      })
    );
    expect(window.scrollY).toBe(0);
  });

  it("opens the popup in its lane when readings arrive for a dial in view that had none", async () => {
    // Every hour's reading is null, so the dial draws no plot, and its surface mounts only once the
    // readings arrive. The oracle is the same rule: the new surface is in view, so the default
    // item's popup opens. With no surface there is nothing in view, so the record runs through the
    // figure's own report.
    const blank = Array.from({ length: 24 }, (_, hour) => ({ start: DAY + hour * HOUR, kwh: null }));
    let host: HTMLElement = document.body;
    let rerender: (next: ReactNode) => void = () => undefined;
    const mounted = await framesThroughReport(
      () => shown(host),
      () => {
        ({ host, rerender } = renderThemed(<DefaultDial data={blank} />));
        expect(popup()).toBeNull();
        return polarFigure(host);
      }
    );
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(shownFrames(mounted)).toEqual([]);
    expectInLane(await framesUntilShown(host, () => rerender(<DefaultDial />)));
  });

  it("opens the popup in its lane when the chart renders into a container that is attached later", async () => {
    // The Root renders, and its effects run, in a container outside the document, which the page
    // then appends. The oracle is the same rule: a detached dial is not in view, so the popup stays
    // closed, and once attached the dial is in view, so the default item's popup opens in its lane.
    // The popup portals to the theme scope's container, which sits inside the detached host, so the
    // test looks for it there until the host is attached.
    const host = document.createElement("div");
    const detachedOpen = () => host.querySelector('[data-slot="chart-tooltip"][data-open]') !== null;
    const root = createRoot(host);
    onTestFinished(() => {
      flushSync(() => {
        root.unmount();
      });
      host.remove();
    });
    let frames = 0;
    const detached = recordFrames(detachedOpen, () => (frames += 1) >= 3);
    flushSync(() => {
      root.render(
        <ThemeScope theme={fkasPrivate}>
          <DefaultDial />
        </ThemeScope>
      );
    });
    expect(detachedOpen()).toBe(false);
    expect((await detached).filter(Boolean)).toEqual([]);
    expectInLane(
      await framesUntilShown(host, () => {
        document.body.append(host);
      })
    );
  });

  it("opens the popup of a dial cut to 60% on both axes, 36% of its area", async () => {
    // The dial sits 1,500 px down and 1,000 px across an 800 × 700 viewport. The oracle is the rule
    // that the dial is in view while each axis shows at least half of its extent. The scroll shows
    // 60% of its width and 60% of its height, so the popup opens although only 36% of its area is
    // in view.
    await page.viewport(800, 700);
    const { host } = renderThemed(
      <div style={{ width: 2400 }}>
        <div style={{ height: 1500 }} />
        <div style={{ display: "flex" }}>
          <div style={{ flex: "0 0 1000px" }} />
          <DefaultDial />
        </div>
        <div style={{ height: 1500 }} />
      </div>
    );
    const box = surfaceBox(host);
    window.scrollTo(box.left + window.scrollX + 0.4 * box.width, scrollShowing(host, 0.6));
    const cut = surfaceBox(host);
    expect((Math.min(cut.right, window.innerWidth) - Math.max(cut.left, 0)) / cut.width).toBeCloseTo(0.6, 2);
    expect((Math.min(cut.bottom, window.innerHeight) - Math.max(cut.top, 0)) / cut.height).toBeCloseTo(
      0.6,
      2
    );
    await expect.poll(label).toBe("17–18");
  });

  it.each([
    {
      by: "a key",
      label: "17–18",
      take: async () => {
        await userEvent.tab();
      },
    },
    {
      by: "a touch pin",
      label: "04–05",
      take: async (host: HTMLElement) => {
        // A synthetic touch press is the only way to give Chromium a touch pointer type without
        // emulating a touch device for the whole file. A tap on 04:00 pins it.
        const { x, y } = dialPoint(67.5, 0.6);
        const [clientX, clientY] = clientPoint(clockLayer(host, "clock-chart-column"), x, y);
        for (const type of ["pointerdown", "pointerup"])
          surface(host).dispatchEvent(
            new PointerEvent(type, { bubbles: true, clientX, clientY, pointerType: "touch" })
          );
        await expect.poll(() => polarFigure(host).hasAttribute("data-pinned")).toBe(true);
      },
    },
  ])("keeps the popup that $by took over open while the dial leaves view", async ({ label: taken, take }) => {
    // The default item's popup opens with the dial in view, and the reader takes it over. The oracle
    // is the rule that the in-view gate holds only a default item's popup. Once a key or a pin takes
    // it, the popup stays open through the dial's own report of leaving view.
    await page.viewport(800, 700);
    const { host } = renderThemed(
      <>
        <DefaultDial />
        <div style={{ height: 1500 }} />
      </>
    );
    await expect.poll(label).toBe("17–18");
    await take(host);
    await expect.poll(label).toBe(taken);
    const frames = await framesThroughReport(popupFrame, () => {
      window.scrollTo(0, 1200);
      return surface(host);
    });
    expect(surfaceBox(host).bottom).toBeLessThan(0);
    expect(frames.filter((frame) => !frame.open)).toEqual([]);
    expect(label()).toBe(taken);
  });
});

describe("a coarse series under the pointer", () => {
  it("picks and selects the hourly series anywhere in its hour, not only at its first quarter", async () => {
    // A quarter-hour dial with prices at 1 every quarter and an hourly reading of 3 on each :00 row.
    // On [0, 4] under "radial" the hourly tip sits at √(0.09 + 0.91 · 3/4) ≈ 0.879 and the price's
    // at √(0.09 + 0.91 · 1/4) ≈ 0.563. The second quarter, slot 1 of 96, centers at 5.625°.
    const quarters = slots["quarter-hour"]["Europe/Oslo"]["2025-10-25"].utc_start.map((start) =>
      Date.parse(start)
    );
    const rows = quarters.map((start, slot) =>
      slot % 4 === 0 ? { start, kwh: 3, price: 1 } : { start, price: 1 }
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={rows}
            config={{
              kwh: { label: "Forbruk", color: "chart-1", interval: "hour" },
              price: { label: "Pris", color: "chart-2" },
            }}
            xKey="start"
            cycle="day"
            interval="quarter-hour"
            yInclude={[0, 4]}
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Column dataKey="kwh" />
            <ClockChart.Line dataKey="price" />
            <ClockChart.LegendToggleGroup />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await nextFrames(1);
    const layer = clockLayer(host, "clock-chart-column");
    const at = {
      x: 0.879 * Math.sin((5.625 * Math.PI) / 180),
      y: -0.879 * Math.cos((5.625 * Math.PI) / 180),
    };
    await hoverAt(...clientPoint(layer, at.x, at.y));
    // The hourly series, the first in config order, is the nearest.
    expect(polarFigure(host).getAttribute("data-near")).toBe("0");
    await userEvent.click(page.getByRole("listbox"), {
      position: {
        x:
          clientPoint(layer, at.x, at.y)[0] -
          page.getByRole("listbox").element().getBoundingClientRect().left,
        y:
          clientPoint(layer, at.x, at.y)[1] - page.getByRole("listbox").element().getBoundingClientRect().top,
      },
    });
    expect(page.getByRole("button", { name: "Forbruk" }).element().getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the readouts", () => {
  it("prints the value at Now in the center with nothing active, and the active slot's on hover", async () => {
    const { host } = renderThemed(
      <Dial now={DAY + 2.5 * HOUR}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Center />
      </Dial>
    );
    await nextFrames(1);
    // The center is aria-hidden plot text, read by its slot.
    const value = () => host.querySelector('[data-slot="clock-chart-active-value"]')?.textContent;
    expect(value()).toBe("2");
    const column = clockLayer(host, "clock-chart-column");
    await hoverAt(
      ...clientPoint(column, 0.5 * Math.sin((7.5 * Math.PI) / 180), -0.5 * Math.cos((7.5 * Math.PI) / 180))
    );
    expect(value()).toBe("4");
  });

  it("opens its description with the family word and lists every hour in its table", () => {
    const { host } = renderThemed(
      <Dial>
        <ClockChart.Line dataKey="kwh" />
        <ClockChart.Table />
      </Dial>
    );
    // The generated description is the figure's visually hidden text, read by its slot.
    expect(host.querySelector('[data-slot="chart-description"]')?.textContent).toMatch(
      /^Klokkediagram med 1 serie\. /u
    );
    expect(host.querySelectorAll("tbody tr")).toHaveLength(24);
  });
});
