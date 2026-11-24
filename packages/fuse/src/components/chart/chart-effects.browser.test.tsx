// Chart.Reveal in Chromium. Unit under test: the series a Reveal masks, which take the active slot's
// place as `--chart-active-x`. Oracle: Reveal's documented contract, that it masks the lines, areas
// and dots it wraps, so a key step moves the edge of a Line's mask, and a consumer's own drawing
// beside them keeps its mask whatever the slot.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { label } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

const DATA = [
  { hour: "00", price: 1 },
  { hour: "01", price: 3 },
  { hour: "02", price: 2 },
] as const;

const CONFIG = { price: { label: "Pris", color: "chart-1" } } as const;

describe("Chart.Reveal", () => {
  it("moves its Line's mask with the active slot and leaves a consumer's drawing with the same data-slot its own mask", async () => {
    // The consumer's drawing carries a line's slot and a variant, and its own mask through the SVG
    // `mask` attribute, which any stylesheet rule outranks, so a Reveal rule keyed on the slot would
    // replace it.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 480 }}>
          <Chart.Root data={DATA} config={CONFIG} xKey="hour" data-intro="none" aria-label="Pris">
            <Chart.Reveal>
              <Chart.Line dataKey="price" />
              <svg
                mask="url(#consumer-fade)"
                data-slot="chart-line-series"
                data-variant="solid"
                data-testid="consumer"
                aria-hidden="true">
                <mask id="consumer-fade">
                  <rect width="100" height="100" fill="currentColor" />
                </mask>
                <path d="M0 0 L100 100" stroke="currentColor" />
              </svg>
            </Chart.Reveal>
            <Chart.Tooltip />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const reveal = host.querySelector('[data-slot="chart-reveal"]');
    const consumer = host.querySelector('[data-testid="consumer"]');
    const line = [...(reveal?.children ?? [])].find((child) => child !== consumer);
    if (!(line instanceof SVGElement) || !(consumer instanceof SVGElement)) throw new Error("no series");
    const mask = (element: Element): string => getComputedStyle(element).maskImage;
    // No slot is active yet, so the consumer's drawing shows its own mask and the Line none.
    const consumerOwn = mask(consumer);
    expect(consumerOwn).toMatch(/^url\(".*#consumer-fade"\)$/u);
    const lineIdle = mask(line);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await expect.poll(label).toBe("00");
    // A key step places the edge at once, so the Line's mask ends at the first slot's place, in px.
    await expect.poll(() => mask(line)).toMatch(/\dpx/);
    const lineAtFirst = mask(line);
    expect(lineAtFirst).not.toBe(lineIdle);
    expect(mask(consumer)).toBe(consumerOwn);
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(label).toBe("01");
    await expect.poll(() => mask(line)).not.toBe(lineAtFirst);
    expect(mask(consumer)).toBe(consumerOwn);
  });
});
