// ScatterChart's readout in Chromium: the single-option keyboard walk, where Left and Right walk the
// focused series by x, then y, Up and Down cycle the series focus with all series first, and Home
// and End reach the ends, the pointer's nearest-point pick, the tooltip, the active dot, the legend and the table. Unit under test: the
// surface, the readout parts and the store between them. Oracles: option names, positions and set
// sizes written by hand from the rows below, pixels worked out by hand on a 200 by 140 px plot over
// x [−2, 18] and y [20\u00a0000, 160\u00a0000], and row orders sorted by hand.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { popup } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = {
  now: { label: "Forbruk 2026", color: "chart-1" },
  last: { label: "Forbruk 2025", color: "chart-4" },
  normal: { label: "Normalforbruk", color: "chart-2" },
} as const satisfies ChartConfig;

type Row = { readonly t: number; readonly kwh: number; readonly s: string };

/**
 * The walk, by x, then y, then series in config order: now(−2, 20\u00a0000), normal(−2, 20\u00a0000),
 * last(1, 140\u00a0000), now(2, 90\u00a0000), last(2, 100\u00a0000), normal(18, 160\u00a0000). The extents nice to
 * [−2, 18] and [20\u00a0000, 160\u00a0000].
 */
const ROWS: readonly Row[] = [
  { t: 2, kwh: 90_000, s: "now" },
  { t: -2, kwh: 20_000, s: "now" },
  { t: 1, kwh: 140_000, s: "last" },
  { t: 2, kwh: 100_000, s: "last" },
  { t: 18, kwh: 160_000, s: "normal" },
  { t: -2, kwh: 20_000, s: "normal" },
];

function Scatter({
  data = ROWS,
  children,
}: {
  readonly data?: readonly Row[];
  readonly children?: ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <button type="button">før</button>
      <div style={{ width: 200 }}>
        <ScatterChart.Root
          data={data}
          config={CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          xFormat={{ maximumFractionDigits: 1 }}
          valueFormat={{ maximumFractionDigits: 0 }}
          xLabel="Temperatur"
          yLabel="Forbruk"
          data-intro="none"
          aria-label="Forbruk mot temperatur"
          style={{ "--chart-plot-height": "140px" }}>
          <ScatterChart.Points dataKey="now" size="md" />
          <ScatterChart.Points dataKey="last" size="sm" variant="quiet" />
          <ScatterChart.Line dataKey="normal" />
          <ScatterChart.ActiveDot />
          <ScatterChart.Tooltip />
          {children}
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The focused option's name, position and set size. */
function focused(): readonly [string | null, string | null, string | null] {
  const element = document.activeElement;
  return [
    element?.getAttribute("aria-label") ?? null,
    element?.getAttribute("aria-posinset") ?? null,
    element?.getAttribute("aria-setsize") ?? null,
  ];
}

async function enterChart(): Promise<void> {
  await userEvent.click(page.getByRole("button", { name: "før" }));
  await userEvent.keyboard("{Tab}");
}

/** The tooltip's text, or null while it is closed. */
function tooltipText(): string | null {
  return popup()?.textContent ?? null;
}

describe("the keyboard walk", () => {
  it("walks every point by x, then y, then series, from the one option", async () => {
    renderThemed(<Scatter />);
    await enterChart();
    expect(
      page.getByRole("listbox", { name: "Forbruk mot temperatur, datapunkter" }).element()
    ).not.toBeNull();
    expect(focused()).toEqual(["Forbruk 2026, Temperatur: minus\u00a02, Forbruk: 20\u00a0000", "1", "6"]);
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toEqual(["Normalforbruk, Temperatur: minus\u00a02, Forbruk: 20\u00a0000", "2", "6"]);
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toEqual(["Forbruk 2025, Temperatur: 1, Forbruk: 140\u00a0000", "3", "6"]);
    await userEvent.keyboard("{End}");
    expect(focused()).toEqual(["Normalforbruk, Temperatur: 18, Forbruk: 160\u00a0000", "6", "6"]);
    // The walk stops at its ends.
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()[1]).toBe("6");
    await userEvent.keyboard("{Home}");
    expect(focused()[1]).toBe("1");
    // The listbox always holds exactly one option once a step settles.
    expect(page.getByRole("option").all()).toHaveLength(1);
  });

  it("names x and y by the dictionary's words when Root names neither measure", async () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 200 }}>
          <ScatterChart.Root
            data={ROWS}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            xFormat={{ maximumFractionDigits: 1 }}
            valueFormat={{ maximumFractionDigits: 0 }}
            data-intro="none"
            aria-label="Forbruk mot temperatur"
            style={{ "--chart-plot-height": "140px" }}>
            <ScatterChart.Points dataKey="now" />
          </ScatterChart.Root>
        </div>
      </LocaleProvider>
    );
    await enterChart();
    expect(focused()).toEqual(["Forbruk 2026, x-verdi: minus\u00a02, y-verdi: 20\u00a0000", "1", "6"]);
    await userEvent.keyboard("{End}");
    expect(focused()).toEqual(["Normalforbruk, x-verdi: 18, y-verdi: 160\u00a0000", "6", "6"]);
  });

  it("cycles the series focus with Up and Down, all series first, and walks the focused one", async () => {
    renderThemed(<Scatter />);
    await enterChart();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    // From last(1, 140\u00a0000), Down focuses "now", whose nearest x is 2.
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toEqual(["Forbruk 2026, Temperatur: 2, Forbruk: 90\u00a0000", "2", "2"]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toEqual(["Forbruk 2026, Temperatur: minus\u00a02, Forbruk: 20\u00a0000", "1", "2"]);
    // Down focuses "last": from now(−2), its nearest x is 1.
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toEqual(["Forbruk 2025, Temperatur: 1, Forbruk: 140\u00a0000", "1", "2"]);
    // Down focuses "normal": from last(1, 140 000) its nearest x is −2, 3 away against 18's 17.
    // A second Down stays, since "normal" is the last series.
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(focused()).toEqual(["Normalforbruk, Temperatur: minus\u00a02, Forbruk: 20\u00a0000", "1", "2"]);
    // Up walks back: "last" nearest −2 is (1, 140 000), "now" nearest 1 is (2, 90 000), and all
    // series keeps that point, the fourth in the whole walk.
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(focused()).toEqual(["Forbruk 2026, Temperatur: 2, Forbruk: 90\u00a0000", "4", "6"]);
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()[1]).toBe("4");
  });

  it("shows the tooltip and the ring on the focused point, and Escape closes them", async () => {
    const { host } = renderThemed(<Scatter />);
    await enterChart();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await expect.poll(tooltipText).toBe("Forbruk 2026Temperatur2Forbruk90\u00a0000");
    // DOM audit: the active dot is aria-hidden plot output.
    const ring = host.querySelector('[data-slot="chart-active-dot"][data-value] [data-slot="chart-dot"]');
    // now(2, 90\u00a0000) sits at (40, 70), an 8 px dot, so the ring's radius is 4 + 3.
    expect([ring?.getAttribute("cx"), ring?.getAttribute("cy"), ring?.getAttribute("r")]).toEqual([
      "40",
      "70",
      "7",
    ]);
    await userEvent.keyboard("{Escape}");
    await expect.poll(tooltipText).toBeNull();
    // DOM audit: Root's active state is the attribute the CSS reads.
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active")).toBe(false);
  });
});

describe("the pointer", () => {
  it("activates the nearest point within the hit radius, and nothing past it", async () => {
    renderThemed(<Scatter />);
    const surface = page.getByRole("listbox");
    // 6 px right of now(2, 90\u00a0000) at (40, 70), and 4 px from no other point.
    await userEvent.hover(surface, { position: { x: 46, y: 70 } });
    await expect.poll(tooltipText).toBe("Forbruk 2026Temperatur2Forbruk90\u00a0000");
    // (100, 120) lies more than 24 px from every point. The tooltip may cover it, and a pointer
    // over the popup picks the points under it, so the move goes through whatever lies on top.
    await userEvent.hover(surface, { position: { x: 100, y: 120 }, force: true });
    await expect.poll(tooltipText).toBeNull();
  });

  it("pins a clicked point, and a second click on it dismisses the tooltip", async () => {
    renderThemed(<Scatter />);
    const surface = page.getByRole("listbox");
    // last(2, 100\u00a0000) sits at (40, 60).
    await userEvent.click(surface, { position: { x: 40, y: 59 } });
    await expect.poll(tooltipText).toBe("Forbruk 2025Temperatur2Forbruk100\u00a0000");
    // A pinned tooltip stays while the pointer moves elsewhere.
    await userEvent.hover(surface, { position: { x: 180, y: 10 }, force: true });
    expect(tooltipText()).toBe("Forbruk 2025Temperatur2Forbruk100\u00a0000");
    await userEvent.click(surface, { position: { x: 40, y: 59 } });
    await expect.poll(tooltipText).toBeNull();
  });
});

describe("the table", () => {
  it("lists every point in the walk order, under the measures' names", async () => {
    renderThemed(
      <Scatter>
        <ScatterChart.Table />
      </Scatter>
    );
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    const table = page.getByRole("table", { name: "Forbruk mot temperatur, 6\u00a0punkter" });
    // A cell shows its visual text, and a twin cell carries its spoken form beside it, visually
    // hidden, so the visual form is the aria-hidden part's text where there is one.
    const visible = (cell: Element): string =>
      cell.querySelector('[aria-hidden="true"]')?.textContent ?? cell.textContent;
    const rows = table
      .getByRole("row")
      .all()
      .map((row) => [...row.element().children].map(visible).join(" | "));
    expect(rows).toEqual([
      "Serie | Temperatur | Forbruk",
      "Forbruk 2026 | −2 | 20\u00a0000",
      "Normalforbruk | −2 | 20\u00a0000",
      "Forbruk 2025 | 1 | 140\u00a0000",
      "Forbruk 2026 | 2 | 90\u00a0000",
      "Forbruk 2025 | 2 | 100\u00a0000",
      "Normalforbruk | 18 | 160\u00a0000",
    ]);
  });

  it("pages past 500 points by row range", async () => {
    // 501 points of one series on a line, x 0 to 500.
    const many = Array.from({ length: 501 }, (_, index) => ({ t: index, kwh: 20_000 + index, s: "now" }));
    renderThemed(
      <Scatter data={many}>
        <ScatterChart.Table />
      </Scatter>
    );
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    // The toggle expanded the table and its pagination, which are clipped while collapsed.
    const table = page.getByRole("table");
    await expect.element(table).toBeVisible();
    const next = page.getByRole("button", { name: "Gå til neste side" });
    await expect.element(next).toBeVisible();
    // DOM audit: a role query over 500 rows walks the accessibility tree for seconds, and the body
    // rows are the table's own rows.
    const bodyRows = () => table.element().querySelectorAll("tbody > tr").length;
    expect(bodyRows()).toBe(500);
    expect(page.getByText("Side 1 av 2 · Rad 1 til 500").element()).not.toBeNull();
    await userEvent.click(next);
    expect(bodyRows()).toBe(1);
    // The status region announces the new page, and the pagination shows it.
    expect(page.getByRole("status").element().textContent).toBe("Side 2 av 2 · Rad 501 til 501");
  });
});
