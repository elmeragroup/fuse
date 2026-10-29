// The Table, Empty and Skeleton judges in Chromium, Firefox and WebKit. Oracles: CONTRACT section
// 9.6's disclosure and pagination rules and section 9.12's table row, E13's hourly year, whose ISO
// weeks run from the week of 29 September 2025 to the week of 28 September 2026 and whose fall-back
// week from 20 to 26 October holds 7 × 24 + 1 = 169 hours, and section 8.13's empty state, all
// written by hand.
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import year from "./format/fixtures/elhub/no1-household-hourly-2025-10_2026-09.json" with { type: "json" };

const CONFIG = {
  kwh: { label: "Forbruk", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
} as const satisfies ChartConfig;

const START = Date.parse(year.start);
const HOURS = year.values.map((kwh, index) => ({ start: new Date(START + index * 3_600_000), kwh }));

function yearChart(locale: "nb-NO" | "en-US" = "nb-NO") {
  return (
    <LocaleProvider locale={locale}>
      <button type="button">før</button>
      <Chart.Root
        data={HOURS}
        config={CONFIG}
        xKey="start"
        interval="hour"
        timeZone="Europe/Oslo"
        aria-label="Forbruk per time">
        <Chart.Table />
      </Chart.Root>
    </LocaleProvider>
  );
}

function bodyRows(host: HTMLElement): number {
  // DOM audit: the table is visually hidden while collapsed, so its rows are read by structure.
  return host.querySelectorAll('[data-slot="chart-table-content"] tbody tr').length;
}

function status(host: HTMLElement): string {
  // DOM audit: the visible page status is the pagination's only text.
  return host.querySelector('[data-slot="chart-table-pagination"] > span')?.textContent ?? "";
}

describe("the table's disclosure", () => {
  it("names the button, points it at the table and states no expanded state", () => {
    renderThemed(yearChart());
    const button = page.getByRole("button", { name: "Vis som tabell" }).element();
    expect(button.hasAttribute("aria-expanded")).toBe(false);
    expect(button.hasAttribute("aria-pressed")).toBe(false);
    const table = page.getByRole("table").element();
    expect(button.getAttribute("aria-controls")).toBe(table.id);
  });

  it("keeps the collapsed table's controls out of the Tab order and moves focus to the table when shown", async () => {
    const { host } = renderThemed(yearChart());
    // DOM audit: the pagination buttons are named by DataTable's dictionary.
    const controls = [...host.querySelectorAll('[data-slot="chart-table-pagination"] button')];
    expect(controls.length).toBe(4);
    for (const control of controls) expect(control.getAttribute("tabindex")).toBe("-1");
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    expect(document.activeElement).toBe(page.getByRole("table").element());
    // Shown, the enabled controls take their natural place in the Tab order again.
    const enabled = controls.filter(
      (control) => !control.hasAttribute("disabled") && !control.hasAttribute("data-disabled")
    );
    expect(enabled.length).toBe(2);
    for (const control of enabled) expect(control.getAttribute("tabindex") ?? "0").toBe("0");
    await userEvent.click(page.getByRole("button", { name: "Skjul tabell" }));
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Vis som tabell" }).element());
  });
});

describe("the hourly year's pages", () => {
  it("pages 8,760 hours by ISO week into 53 pages, with a 169-row fall-back week", async () => {
    const { host } = renderThemed(yearChart());
    // Page 1 is 1 to 5 October 2025, five days of the week of 29 September.
    expect(bodyRows(host)).toBe(120);
    expect(status(host)).toBe("Side 1 av 53 · uke 40");
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    const next = page.getByRole("button", { name: "Gå til neste side" });
    await userEvent.click(next);
    await userEvent.click(next);
    await userEvent.click(next);
    expect(status(host)).toBe("Side 4 av 53 · uke 43");
    expect(bodyRows(host)).toBe(169);
    // DOM audit: Root's status region announces the page change.
    expect(host.querySelector('[role="status"]')?.textContent.trim()).toBe("Side 4 av 53 · uke 43");
    await userEvent.click(page.getByRole("button", { name: "Gå til siste side" }));
    expect(status(host)).toBe("Side 53 av 53 · uke 40");
  });

  it("announces the spoken week, not the visible abbreviation", async () => {
    // jc7: CONTRACT section 9.7 has status messages read the spoken field, and the judge's
    // hand-written en-US list gives "Page 2 of 53 · week 41" where the pagination shows W41. The
    // spoken period joins the word to its number with a no-break space.
    const { host } = renderThemed(yearChart("en-US"));
    await userEvent.click(page.getByRole("button", { name: "Show as table" }));
    await userEvent.click(page.getByRole("button", { name: "Go to next page" }));
    // DOM audit: Root's status region announces the page change.
    expect(host.querySelector('[role="status"]')?.textContent.trim()).toBe("Page 2 of 53 · week\u00a041");
  });

  it("gives the shown table a Tab stop, so a keyboard can scroll it at 390 px", async () => {
    // js13: the table scrolls sideways in its container at narrow widths, and axe's
    // scrollable-region-focusable needs a focusable element inside that container.
    const { host } = renderThemed(<div style={{ width: 390 }}>{yearChart()}</div>);
    const table = page.getByRole("table").element();
    expect(table.getAttribute("tabindex")).toBe("-1");
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    expect(table.getAttribute("tabindex")).toBe("0");
    // DOM audit: Fuse Table's scroll container holds the table.
    expect(host.querySelector('[data-slot="table-container"]')?.contains(table)).toBe(true);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(table);
  });

  it("prints the unit once in the header and none in the cells", () => {
    const { host } = renderThemed(yearChart());
    // DOM audit: the table's header cells, read by structure.
    const headers = [...host.querySelectorAll('[data-slot="chart-table-content"] thead th')].map(
      (cell) => cell.querySelector('[aria-hidden="true"]')?.textContent ?? cell.textContent
    );
    expect(headers).toEqual(["Tidspunkt", "Forbruk (kWh)"]);
    // The first hour reads 1.2734 kWh, which the energy preset's two digits print as 1,27.
    const firstCell = host.querySelector('[data-slot="chart-table-content"] tbody td');
    expect(firstCell?.textContent).toBe("1,27");
  });
});

describe("the empty state", () => {
  it.each([
    ["no rows", []],
    [
      "rows whose every value is missing",
      [
        { start: new Date(START), kwh: null },
        { start: new Date(START + 3_600_000), kwh: null },
      ],
    ],
  ] as const)("draws 0 marks, no tab stop and no table for %s", (_, rows) => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={CONFIG}
          xKey="start"
          interval="hour"
          timeZone="Europe/Oslo"
          aria-label="Forbruk per time">
          <Chart.Bar dataKey="kwh" />
          <Chart.Table />
          <Chart.Empty />
        </Chart.Root>
      </LocaleProvider>
    );
    // DOM audit: marks are aria-hidden plot output.
    expect(host.querySelectorAll('[data-slot="chart-bar"], [data-slot="chart-bar-missing"]')).toHaveLength(0);
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(host.querySelector('[data-slot="chart-table"]')).toBeNull();
    expect(page.getByText("Ingen data for perioden", { exact: true }).element()).toBeTruthy();
    // DOM audit: the description is visually hidden text.
    expect(host.querySelector('[data-slot="chart-description"]')?.textContent).toBe(
      "Ingen data for perioden."
    );
  });
});

describe("the skeleton", () => {
  it("sketches 12 bars and names the wait with one loader", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Skeleton />
      </LocaleProvider>
    );
    // DOM audit: skeleton marks are aria-hidden shapes.
    expect(host.querySelectorAll('[data-slot="chart-skeleton-mark"]')).toHaveLength(12);
    expect(page.getByRole("status", { name: "Laster diagram" }).element()).toBeTruthy();
  });
});
