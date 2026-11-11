// ScatterChart's Root and marks in Chromium. Unit under test: the whole path from Root's rows to
// the drawn `d`, the grid and axis placements, the server HTML and the data rules. Oracles: pixels
// worked out by hand on a 200 by 140 px plot over x [−2, 18] and y [20 000, 160 000], where x = 2
// sits 40 px from the left and y = 90 000 sits 70 px from the top, and sentences written by hand.
import type { ReactNode } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { popup } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = {
  now: { label: "Forbruk 2026", color: "chart-1" },
  normal: { label: "Normalforbruk", color: "chart-2" },
} as const satisfies ChartConfig;

type Row = { readonly t: number | null; readonly kwh: number | null; readonly s: string };

/** Points whose extents nice to exactly [−2, 18] and [20 000, 160 000]. */
const ROWS: readonly Row[] = [
  { t: 18, kwh: 160_000, s: "now" },
  { t: -2, kwh: 20_000, s: "now" },
  { t: 2, kwh: 90_000, s: "now" },
  { t: 2, kwh: 90_000, s: "normal" },
  { t: -2, kwh: 20_000, s: "normal" },
  { t: 18, kwh: 160_000, s: "normal" },
];

/** A scatter chart with no axes, so its plot is the whole 200 by 140 px frame, and no entrance. */
function Scatter({
  data = ROWS,
  children,
}: {
  readonly data?: readonly Row[];
  readonly children: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 200 }}>
        <ScatterChart.Root
          data={data}
          config={CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          xFormat={{ style: "unit", unit: "celsius" }}
          valueFormat={{ preset: "energy", unit: "kWh" }}
          xLabel="Temperatur"
          yLabel="Forbruk"
          data-intro="none"
          aria-label="Forbruk mot temperatur"
          style={{ "--chart-plot-height": "140px" }}>
          {children}
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The `d` of every points path, in part order. */
function pointPaths(host: HTMLElement): (string | null)[] {
  // The points are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll('[data-slot="chart-points-path"]')].map((path) => path.getAttribute("d"));
}

describe("ScatterChart Root", () => {
  it("renders the final figure on the server, with no mark drawn before the browser measures", () => {
    const html = renderToString(
      <Scatter>
        <ScatterChart.Points dataKey="now" />
      </Scatter>
    );
    const template = document.createElement("template");
    template.innerHTML = html;
    const figure = template.content.querySelector("figure");
    expect(figure?.getAttribute("aria-label")).toBe("Forbruk mot temperatur");
    expect(template.content.querySelector('[role="listbox"] [role="option"]')).not.toBeNull();
    // The server HTML is a detached fragment, and the marks and the description are
    // aria-hidden or visually hidden, so their slots are the only locators.
    expect(template.content.querySelector('[data-slot="chart-points"]')).not.toBeNull();
    expect(template.content.querySelector('[data-slot="chart-points-path"]')).toBeNull();
    expect(template.content.querySelector('[data-slot="chart-description"]')?.textContent).toBe(
      // Fuse writes every space inside a number, a unit and a count as U+00A0.
      "Forbruk 2026: 3\u00a0punkter, Temperatur minus\u00a02\u00a0grader\u00a0celsius til 18\u00a0grader\u00a0celsius, Forbruk 20\u00a0000\u00a0kilowattimer til 160\u00a0000\u00a0kilowattimer. " +
        "Normalforbruk: 3\u00a0punkter, Temperatur minus\u00a02\u00a0grader\u00a0celsius til 18\u00a0grader\u00a0celsius, Forbruk 20\u00a0000\u00a0kilowattimer til 160\u00a0000\u00a0kilowattimer."
    );
  });

  it("throws non-finite-x in development for a NaN x, naming the row and the column", () => {
    renderThemed(
      <CaughtError>
        <Scatter data={[...ROWS, { t: Number.NaN, kwh: 1, s: "now" }]}>
          <ScatterChart.Points dataKey="now" />
        </Scatter>
      </CaughtError>
    );
    expect(caughtError().name).toBe("ChartDataError");
    expect(caughtError().message).toContain('Row 6 of "t"');
  });

  it("skips a row with a null x or y quietly", async () => {
    const { host } = renderThemed(
      <Scatter data={[...ROWS, { t: null, kwh: 1, s: "now" }, { t: 4, kwh: null, s: "now" }]}>
        <ScatterChart.Points dataKey="now" />
      </Scatter>
    );
    await expect.poll(() => pointPaths(host)).toEqual(["M0 140h0M40 70h0M200 0h0"]);
  });

  it("throws unknown-key for a part that names no config key", () => {
    renderThemed(
      <CaughtError>
        <Scatter>
          <ScatterChart.Points dataKey="missing" />
        </Scatter>
      </CaughtError>
    );
    expect(caughtError().name).toBe("ChartCompositionError");
    expect(caughtError().message).toContain('"missing"');
  });
});

// ScatterChart's readout in Chromium: the single-option keyboard walk, where Left and Right walk the
// focused series by x, then y, Up and Down cycle the series focus with all series first, and Home
// and End reach the ends, the pointer's nearest-point pick, the tooltip, the active dot, the legend
// and the table. Unit under test: the surface, the readout parts and the store between them.
// Oracles: option names, positions and set sizes written by hand from the rows below, pixels worked
// out by hand on a 200 by 140 px plot over x [−2, 18] and y [20\u00a0000, 160\u00a0000], and row
// orders sorted by hand.
describe("interaction", () => {
  const INTERACTIVE_CONFIG = {
    now: { label: "Forbruk 2026", color: "chart-1" },
    last: { label: "Forbruk 2025", color: "chart-4" },
    normal: { label: "Normalforbruk", color: "chart-2" },
  } as const satisfies ChartConfig;

  type InteractiveRow = { readonly t: number; readonly kwh: number; readonly s: string };

  /**
   * The walk, by x, then y, then series in config order: now(−2, 20\u00a0000), normal(−2, 20\u00a0000),
   * last(1, 140\u00a0000), now(2, 90\u00a0000), last(2, 100\u00a0000), normal(18, 160\u00a0000). The extents nice to
   * [−2, 18] and [20\u00a0000, 160\u00a0000].
   */
  const INTERACTIVE_ROWS: readonly InteractiveRow[] = [
    { t: 2, kwh: 90_000, s: "now" },
    { t: -2, kwh: 20_000, s: "now" },
    { t: 1, kwh: 140_000, s: "last" },
    { t: 2, kwh: 100_000, s: "last" },
    { t: 18, kwh: 160_000, s: "normal" },
    { t: -2, kwh: 20_000, s: "normal" },
  ];

  function InteractiveScatter({
    data = INTERACTIVE_ROWS,
    children,
  }: {
    readonly data?: readonly InteractiveRow[];
    readonly children?: ReactNode;
  }) {
    return (
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 200 }}>
          <ScatterChart.Root
            data={data}
            config={INTERACTIVE_CONFIG}
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
      renderThemed(<InteractiveScatter />);
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
              data={INTERACTIVE_ROWS}
              config={INTERACTIVE_CONFIG}
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
      renderThemed(<InteractiveScatter />);
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
      const { host } = renderThemed(<InteractiveScatter />);
      await enterChart();
      await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
      await expect.poll(tooltipText).toBe("Forbruk 2026Temperatur2Forbruk90\u00a0000");
      // The active dot is aria-hidden plot output.
      const ring = host.querySelector('[data-slot="chart-active-dot"][data-value] [data-slot="chart-dot"]');
      // now(2, 90\u00a0000) sits at (40, 70), an 8 px dot, so the ring's radius is 4 + 3.
      expect([ring?.getAttribute("cx"), ring?.getAttribute("cy"), ring?.getAttribute("r")]).toEqual([
        "40",
        "70",
        "7",
      ]);
      await userEvent.keyboard("{Escape}");
      await expect.poll(tooltipText).toBeNull();
      // Root's active state is the attribute the CSS reads.
      expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active")).toBe(false);
    });
  });

  describe("the pointer", () => {
    it("activates the nearest point within the hit radius, and nothing past it", async () => {
      renderThemed(<InteractiveScatter />);
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
      renderThemed(<InteractiveScatter />);
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
        <InteractiveScatter>
          <ScatterChart.Table />
        </InteractiveScatter>
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
        <InteractiveScatter data={many}>
          <ScatterChart.Table />
        </InteractiveScatter>
      );
      await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
      // The toggle expanded the table and its pagination, which are clipped while collapsed.
      const table = page.getByRole("table");
      await expect.element(table).toBeVisible();
      const next = page.getByRole("button", { name: "Gå til neste side" });
      await expect.element(next).toBeVisible();
      // A role query over 500 rows walks the accessibility tree for seconds, and the body
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

  describe("the walk across data updates", () => {
    it("gives the focus of a series that loses its points back to all series, and Home stays inside", async () => {
      // Focus "normal", then drop its rows and keep its config entry. The walk is then now(−2),
      // last(1), now(2), last(2), and Home names its first point.
      const { rerender } = renderThemed(<InteractiveScatter />);
      await enterChart();
      await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(focused()[0]).toContain("Normalforbruk");
      rerender(<InteractiveScatter data={INTERACTIVE_ROWS.filter((row) => row.s !== "normal")} />);
      await userEvent.keyboard("{Home}");
      expect(focused()).toEqual(["Forbruk 2026, Temperatur: minus 2, Forbruk: 20 000", "1", "4"]);
    });

    it("walks past repeated points one at a time", async () => {
      // Two identical points and one more: the walk is 1, 2 and 3 of 3.
      renderThemed(
        <InteractiveScatter
          data={[
            { t: -2, kwh: 20_000, s: "now" },
            { t: -2, kwh: 20_000, s: "now" },
            { t: 18, kwh: 160_000, s: "now" },
          ]}
        />
      );
      await enterChart();
      expect(focused()[1]).toBe("1");
      await userEvent.keyboard("{ArrowRight}");
      expect(focused().slice(1)).toEqual(["2", "3"]);
      await userEvent.keyboard("{ArrowRight}");
      expect(focused()).toEqual(["Forbruk 2026, Temperatur: 18, Forbruk: 160 000", "3", "3"]);
    });
  });

  describe("the tooltip under the pointer", () => {
    /** Three points: (−2, 20 000) at (0, 140), (8, 90 000) at (100, 70) and (18, 160 000) at (200, 0). */
    const SPREAD = [
      { t: -2, kwh: 20_000, s: "now" },
      { t: 8, kwh: 90_000, s: "now" },
      { t: 18, kwh: 160_000, s: "now" },
    ];

    it("stays open while the pointer moves from its point straight into the popup", async () => {
      renderThemed(<InteractiveScatter data={SPREAD} />);
      const surface = page.getByRole("listbox");
      await userEvent.hover(surface, { position: { x: 100, y: 70 } });
      await expect.poll(tooltipText).toBe("Forbruk 2026Temperatur8Forbruk90 000");
      // The popup rests above the point or, without room there, below it. The pointer moves
      // straight along x = 100 into the popup's middle, past the 24 px hit radius.
      // The popup portals out of the host, so its slot locates it.
      const popup =
        document.querySelector('[data-slot="chart-tooltip"]')?.getBoundingClientRect() ?? new DOMRect();
      const plot = surface.element().getBoundingClientRect();
      const into = (popup.top + popup.bottom) / 2 - plot.top;
      expect(Math.abs(into - 70)).toBeGreaterThan(24);
      await userEvent.hover(surface, { position: { x: 100, y: into }, force: true });
      // The popup portals out of the host, and the pointer is over its own slot.
      expect(document.querySelector('[data-slot="chart-tooltip"]:hover')).not.toBeNull();
      // Three frames give a store change time to render and the popup time to start closing.
      await nextFrames(3);
      expect(tooltipText()).toBe("Forbruk 2026Temperatur8Forbruk90 000");
    });

    it("stays closed after Escape while the pointer rests on the point", async () => {
      // The walk's first point, now(−2, 20 000), sits at (0, 140).
      renderThemed(<InteractiveScatter data={SPREAD} />);
      await enterChart();
      const surface = page.getByRole("listbox");
      await userEvent.hover(surface, { position: { x: 2, y: 138 } });
      await expect.poll(tooltipText).toBe("Forbruk 2026Temperatur−2Forbruk20 000");
      await userEvent.keyboard("{Escape}");
      await expect.poll(tooltipText).toBeNull();
      await userEvent.hover(surface, { position: { x: 3, y: 138 } });
      // Three frames give a store change time to render and the popup time to start closing.
      await nextFrames(3);
      expect(tooltipText()).toBeNull();
    });
  });

  describe("a press after a data update", () => {
    const NBSP = "\u00a0";
    /** now(−2, 20 000) at (0, 140), now(8, 90 000) at (100, 70) and now(18, 160 000) at (200, 0). */
    const THREE = [
      { t: -2, kwh: 20_000, s: "now" },
      { t: 8, kwh: 90_000, s: "now" },
      { t: 18, kwh: 160_000, s: "now" },
    ];

    /** The active ring's centre, or null while no point is active. */
    function ring(): readonly [string | null, string | null] | null {
      // The active dot is aria-hidden plot output.
      const dot = document.querySelector(
        '[data-slot="chart-active-dot"][data-value] [data-slot="chart-dot"]'
      );
      return dot === null ? null : [dot.getAttribute("cx"), dot.getAttribute("cy")];
    }

    it("pins the clicked point when the update moves the ids", async () => {
      // now(13, 125 000) sorts before now(18, 160 000), so that point's id moves from 2 to 3. The
      // domains stay [−2, 18] and [20 000, 160 000], so every point keeps its place.
      const { rerender } = renderThemed(<InteractiveScatter data={THREE} />);
      const surface = page.getByRole("listbox");
      await userEvent.click(surface, { position: { x: 100, y: 70 } });
      await expect.poll(tooltipText).toBe("Forbruk 2026Temperatur8Forbruk90 000");
      rerender(<InteractiveScatter data={[...THREE, { t: 13, kwh: 125_000, s: "now" }]} />);
      await userEvent.click(surface, { position: { x: 199, y: 1 } });
      await expect.poll(tooltipText).toBe("Forbruk 2026Temperatur18Forbruk160 000");
      expect(ring()).toEqual(["200", "0"]);
    });

    it("pins the clicked point when the update keeps every id", async () => {
      // now(28, 160 000) sorts after every point, so the ids 0, 1 and 2 stay and the new point takes
      // 3. x widens to [−2, 28]: 30 / 10 = 3, between √2 and √10, so the step is 2. Once the domains
      // have glided there, the new point sits at (200, 0) and now(18, 160 000) at (133.3, 0).
      const { rerender } = renderThemed(<InteractiveScatter data={THREE} />);
      const surface = page.getByRole("listbox");
      await userEvent.click(surface, { position: { x: 199, y: 1 } });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur18Forbruk160${NBSP}000`);
      rerender(<InteractiveScatter data={[...THREE, { t: 28, kwh: 160_000, s: "now" }]} />);
      // The pinned ring rides the glide to its new place.
      await expect.poll(() => ring()?.[0]).toBe("133");
      await userEvent.click(surface, { position: { x: 199, y: 1 } });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur28Forbruk160${NBSP}000`);
      expect(ring()).toEqual(["200", "0"]);
    });
  });

  describe("a pin across a data update", () => {
    const NBSP = " ";
    /** A is now(−2, 20 000) at (0, 140) and now(18, 160 000) at (200, 0), B is last(8, 90 000) at (100, 70). */
    const A = [
      { t: -2, kwh: 20_000, s: "now" },
      { t: 18, kwh: 160_000, s: "now" },
    ];
    const B = { t: 8, kwh: 90_000, s: "last" };

    it("lets go when the pinned series loses its points, and the next hover opens", async () => {
      // Without B the domains stay [−2, 18] and [20 000, 160 000], so A's points keep their places.
      const { rerender } = renderThemed(<InteractiveScatter data={[...A, B]} />);
      const surface = page.getByRole("listbox");
      await userEvent.click(surface, { position: { x: 100, y: 70 } });
      await expect.poll(tooltipText).toBe(`Forbruk 2025Temperatur8Forbruk90${NBSP}000`);
      rerender(<InteractiveScatter data={A} />);
      await expect.poll(tooltipText).toBeNull();
      await userEvent.hover(surface, { position: { x: 199, y: 1 } });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur18Forbruk160${NBSP}000`);
    });

    it("lets go when the chart empties, and a hover opens once it fills again", async () => {
      const { rerender } = renderThemed(<InteractiveScatter data={[...A, B]} />);
      const surface = page.getByRole("listbox");
      await userEvent.click(surface, { position: { x: 100, y: 70 } });
      await expect.poll(tooltipText).toBe(`Forbruk 2025Temperatur8Forbruk90${NBSP}000`);
      rerender(<InteractiveScatter data={[]} />);
      await expect.poll(tooltipText).toBeNull();
      rerender(<InteractiveScatter data={[...A, B]} />);
      await userEvent.hover(surface, { position: { x: 199, y: 1 } });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur18Forbruk160${NBSP}000`);
    });
  });

  describe("a dismissal under the pointer", () => {
    const NBSP = " ";
    /** now(−2, 20 000) at (0, 140), now(8, 90 000) at (100, 70) and now(18, 160 000) at (200, 0). */
    const SPREAD = [
      { t: -2, kwh: 20_000, s: "now" },
      { t: 8, kwh: 90_000, s: "now" },
      { t: 18, kwh: 160_000, s: "now" },
    ];

    it("ends once the pointer moves to another point, so the first opens again on return", async () => {
      renderThemed(<InteractiveScatter data={SPREAD} />);
      // Entering opens the walk's first point, whose popup covers A, so Escape closes it first.
      await enterChart();
      await userEvent.keyboard("{Escape}");
      await expect.poll(tooltipText).toBeNull();
      const surface = page.getByRole("listbox");
      // A closing popup may still cover the plot, so each hover skips Playwright's visibility wait.
      await userEvent.hover(surface, { position: { x: 100, y: 70 }, force: true });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur8Forbruk90${NBSP}000`);
      await userEvent.keyboard("{Escape}");
      await expect.poll(tooltipText).toBeNull();
      await userEvent.hover(surface, { position: { x: 199, y: 1 }, force: true });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur18Forbruk160${NBSP}000`);
      await userEvent.hover(surface, { position: { x: 100, y: 70 }, force: true });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur8Forbruk90${NBSP}000`);
    });
  });

  describe("a consumer ref on Root", () => {
    it("receives the figure, and Root still marks the hovered point active", async () => {
      let figure: HTMLElement | null = null;
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 200 }}>
            <ScatterChart.Root
              ref={(element) => {
                figure = element;
              }}
              data={INTERACTIVE_ROWS}
              config={INTERACTIVE_CONFIG}
              xKey="t"
              yKey="kwh"
              seriesKey="s"
              aria-label="Forbruk mot temperatur"
              style={{ "--chart-plot-height": "140px" }}>
              <ScatterChart.Points dataKey="now" />
              <ScatterChart.ActiveDot />
            </ScatterChart.Root>
          </div>
        </LocaleProvider>
      );
      // Root's figure carries the active state the CSS reads.
      const root = host.querySelector('[data-slot="chart"]');
      expect(figure).toBe(root);
      // now(2, 90 000) sits at (40, 70) over x [−2, 18] and y [20 000, 160 000].
      await userEvent.hover(page.getByRole("listbox"), { position: { x: 40, y: 70 } });
      await expect.poll(() => root?.getAttribute("data-active")).toBe("pointer");
    });
  });

  describe("a click that moves a pin onto the option's point", () => {
    const NBSP = "\u00a0";
    /** now(−2, 20 000) at (0, 140), the walk's first point, where the option lies, now(8, 90 000) at (100, 70) and now(18, 160 000) at (200, 0). */
    const SPREAD = [
      { t: -2, kwh: 20_000, s: "now" },
      { t: 8, kwh: 90_000, s: "now" },
      { t: 18, kwh: 160_000, s: "now" },
    ];

    it("pins the clicked point, though its press focuses the option", async () => {
      renderThemed(<InteractiveScatter data={SPREAD} />);
      const surface = page.getByRole("listbox");
      await userEvent.click(surface, { position: { x: 100, y: 70 } });
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur8Forbruk90${NBSP}000`);
      await userEvent.click(surface, { position: { x: 1, y: 139 } });
      expect(document.activeElement?.getAttribute("role")).toBe("option");
      await expect.poll(tooltipText).toBe(`Forbruk 2026Temperatur−2Forbruk20${NBSP}000`);
    });
  });
});
