// ClockChart's dial, marks and readouts in Chromium. Units under test: ClockChart.Root with its
// Grid, AngleAxis, Line, Area, Column, Dots, Now, Center and the shared readouts. Oracles, written
// by hand: D11's equal slots, slot i of 24 centred at 15i + 7.5°; D13's radii on a [0, 4] domain
// with a 0.3 hole, √(0.09 + 0.91 · v/4) under "radial" and 0.3 + 0.7 · v/4 under "linear"; the pick
// by the pointer's angle alone, found by brute force; D23's threshold, whose wedges above it paint
// the theme's `above` role and the rest `below`, both resolved through a probe and compared through
// `@elmeragroup/color`, and whose line gradient turns hard at the threshold's own radius; D24's
// pixel floor, one device pixel along the radius, and the stack's floor on its outer segment alone;
// the 25-hour 26 October 2025, where "06" sits at 100.8°; D16's seam; Now at 11:30, 172.5°; and the
// clock key map, where PageDown moves six hours.
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { clockLayer, clockPath, dotPoints, wedgeRadii } from "../../../test/chart/clock";
import { clientPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
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
  size,
  children,
}: {
  readonly data?: readonly Record<string, number | string>[];
  readonly config?: ChartConfig;
  readonly scale?: "radial" | "linear";
  /** The hole's radius as a share of the outer radius, 0.3 by default. */
  readonly inner?: number;
  readonly now?: number;
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
          data-intro="none"
          style={size === undefined ? undefined : { "--chart-polar-size": size }}
          aria-label="Døgn">
          {children}
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("the dial's geometry (D11, D13)", () => {
  it("picks the slot under the pointer's angle, whatever its distance from the centre", async () => {
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

describe("the seam (D16), Now and the keys", () => {
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
  it("marks and emphasises an hourly reading from any quarter of its hour", async () => {
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

describe("a ReferenceArea's label (B10)", () => {
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

describe("a reference's sentence (A1-02)", () => {
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

describe("the default tooltip over a stack (B11)", () => {
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

describe("a coarse series under the pointer (Q3, B5)", () => {
  it("picks and selects the hourly series anywhere in its hour, not only at its first quarter", async () => {
    // A quarter-hour dial with prices at 1 every quarter and an hourly reading of 3 on each :00 row.
    // On [0, 4] under "radial" the hourly tip sits at √(0.09 + 0.91 · 3/4) ≈ 0.879 and the price's
    // at √(0.09 + 0.91 · 1/4) ≈ 0.563. The second quarter, slot 1 of 96, centres at 5.625°.
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
  it("prints the value at Now in the centre with nothing active, and the active slot's on hover", async () => {
    const { host } = renderThemed(
      <Dial now={DAY + 2.5 * HOUR}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Center />
      </Dial>
    );
    await nextFrames(1);
    // The centre is aria-hidden plot text, read by its slot.
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
