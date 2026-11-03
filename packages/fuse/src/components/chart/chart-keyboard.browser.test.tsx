// CONTRACT section 9.4's key maps, the Escape rule and the modifier rule, in Chromium, Firefox and
// WebKit. Every expected option name, position and set size is written by hand from the committed
// Elhub rows and the hand-written month-switch fixture, never read from Fuse.
import { virtual } from "@guidepup/virtual-screen-reader";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { OCTOBER_FIRST_LOAD, OCTOBER_RELOAD, october, september } from "../../../test/chart/month-switch";
import type { DayRow } from "../../../test/chart/month-switch";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

const keys: string[] = [];
const recordKey = (event: KeyboardEvent): void => {
  keys.push(`${event.key}${event.defaultPrevented ? " handled" : ""}`);
};

afterEach(() => {
  document.removeEventListener("keydown", recordKey);
  keys.length = 0;
});

/** The focused option's name, position and set size. */
function focused(): readonly [string | null, string | null, string | null] {
  const element = document.activeElement;
  return [
    element?.getAttribute("aria-label") ?? null,
    element?.getAttribute("aria-posinset") ?? null,
    element?.getAttribute("aria-setsize") ?? null,
  ];
}

async function enterChart(host: HTMLElement): Promise<void> {
  host.querySelector("button")?.focus();
  await userEvent.keyboard("{Tab}");
}

describe("horizontal bars", () => {
  it("move between categories with Up and Down and between series with Left and Right", async () => {
    const { host } = renderThemed(<S06Chart orientation="horizontal" />);
    expect(host.querySelector('[role="listbox"]')?.getAttribute("aria-orientation")).toBe("vertical");
    await enterChart(host);
    await userEvent.keyboard("{ArrowDown}");
    // Hand-written: S06's second hour, household 1.2381 and cabin 0.6543 kWh per meter.
    expect(focused()).toEqual([
      "kl. 01 til 02: Husholdning 1,24 kilowattimer, Hytte 0,65 kilowattimer",
      "2",
      "24",
    ]);
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()[0]).toBe("Husholdning 1,24 kilowattimer, kl. 01 til 02");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()[0]).toBe("Hytte 0,65 kilowattimer, kl. 01 til 02");
    // The cycle does not wrap.
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()[0]).toBe("Hytte 0,65 kilowattimer, kl. 01 til 02");
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()[1]).toBe("1");
  });
});

describe("the effective window", () => {
  function windowed(data: readonly DayRow[], first: Date, last: Date) {
    const config = {
      kwh: { label: "Forbruk", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
    } as const;
    return (
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root
          data={data}
          config={config}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          xRange={[first, last]}
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="kwh" />
          <Chart.YAxis />
        </Chart.Root>
      </LocaleProvider>
    );
  }

  it("walks 10 to 20 October as 11 slots, with End on the 20th", async () => {
    const { host } = renderThemed(windowed(OCTOBER_FIRST_LOAD, october(10), october(20)));
    await enterChart(host);
    expect(focused()).toEqual(["fredag 10. oktober: Forbruk 10 kilowattimer", "1", "11"]);
    await userEvent.keyboard("{End}");
    expect(focused()).toEqual(["mandag 20. oktober: Forbruk 20 kilowattimer", "11", "11"]);
    // The window's highest value is 20, so the 1-2-5 rule nices the domain to [0, 20] in steps of 5.
    // DOM audit: y ticks are aria-hidden text, so their slot is the only locator.
    expect([...host.querySelectorAll('[data-slot="chart-y-tick"]')].map((tick) => tick.textContent)).toEqual([
      "0 kWh",
      "5 kWh",
      "10 kWh",
      "15 kWh",
      "20 kWh",
    ]);
  });

  it("speaks the window's last slot as position 11 of 11 to a screen reader", async () => {
    const { host } = renderThemed(windowed(OCTOBER_FIRST_LOAD, october(10), october(20)));
    host.querySelector("button")?.focus();
    await virtual.start({ container: host });
    try {
      await virtual.press("Tab");
      await virtual.press("End");
      const log = await virtual.spokenPhraseLog();
      // vsr's phrase for an option: its role, name, selection state, position and set size.
      expect(log.at(-1)).toBe(
        "option, mandag\u00a020.\u00a0oktober: Forbruk 20\u00a0kilowattimer, not selected, position 11, set size 11"
      );
    } finally {
      await virtual.stop();
    }
  });

  it("keeps the active slot's x across the October reload", async () => {
    const { host, rerender } = renderThemed(windowed(OCTOBER_FIRST_LOAD, october(10), october(20)));
    await enterChart(host);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(focused()[1]).toBe("4");
    rerender(windowed(OCTOBER_RELOAD, october(10), october(20)));
    expect(focused()).toEqual(["mandag 13. oktober: Forbruk 13 kilowattimer", "4", "11"]);
  });

  it("falls back to the whole of October for a September window, and an active September slot gives way to 1 October", async () => {
    // September rows, one per day with the day as the value, then October data under the same window.
    const septemberRows = Array.from({ length: 30 }, (_, index) => ({
      day: september(index + 1),
      kwh: index + 1,
    }));
    const { host, rerender } = renderThemed(windowed(septemberRows, september(1), september(30)));
    await enterChart(host);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(focused()).toEqual(["fredag\u00a05.\u00a0september: Forbruk 5\u00a0kilowattimer", "5", "30"]);
    rerender(windowed(OCTOBER_RELOAD, september(1), september(30)));
    expect(focused()).toEqual(["onsdag\u00a01.\u00a0oktober: Forbruk 1\u00a0kilowattime", "1", "31"]);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("");
  });
});

describe("the Escape rule and key safety", () => {
  it("hides the active state with the first Escape, keeps focus, and lets the second propagate", async () => {
    const { host } = renderThemed(<S06Chart />);
    document.addEventListener("keydown", recordKey);
    await enterChart(host);
    await userEvent.keyboard("{ArrowRight}");
    // DOM audit: Root's data-active, data-pinned and data-selected are its public paint contract.
    const root = host.querySelector('[data-slot="chart"]');
    expect(root?.hasAttribute("data-active")).toBe(true);
    keys.length = 0;
    await userEvent.keyboard("{Escape}");
    expect(root?.hasAttribute("data-active")).toBe(false);
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    expect(keys).toEqual([]);
    await userEvent.keyboard("{Escape}");
    expect(keys).toEqual(["Escape"]);
  });

  it("passes modified and unhandled keys to a document listener untouched", async () => {
    const { host } = renderThemed(<S06Chart />);
    document.addEventListener("keydown", recordKey);
    await enterChart(host);
    keys.length = 0;
    await userEvent.keyboard("{Control>}{ArrowRight}{/Control}");
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await userEvent.keyboard("{Meta>}{ArrowRight}{/Meta}");
    await userEvent.keyboard("a");
    expect(keys.filter((key) => !["Control", "Alt", "Meta"].includes(key))).toEqual([
      "ArrowRight",
      "ArrowRight",
      "ArrowRight",
      "a",
    ]);
    expect(focused()[1]).toBe("1");
  });

  it("handles the arrows itself, so the page does not scroll", async () => {
    const { host } = renderThemed(<S06Chart />);
    document.addEventListener("keydown", recordKey);
    await enterChart(host);
    keys.length = 0;
    await userEvent.keyboard("{ArrowRight}{PageDown}{Home}");
    expect(keys).toEqual(["ArrowRight handled", "PageDown handled", "Home handled"]);
  });

  it("toggles the pin with Enter while no LegendToggleGroup is mounted", async () => {
    const { host } = renderThemed(<S06Chart />);
    await enterChart(host);
    await userEvent.keyboard("{Enter}");
    // DOM audit: Root's data-pinned attribute is its public paint contract.
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-pinned")).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-pinned")).toBe(false);
  });

  it("selects the focused series with Enter while a LegendToggleGroup is mounted, and announces it", async () => {
    const { host } = renderThemed(
      <S06Chart>
        <Chart.Bar dataKey="household" />
        <Chart.LegendToggleGroup />
      </S06Chart>
    );
    await enterChart(host);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    // DOM audit: Root's data-active, data-pinned and data-selected are its public paint contract.
    const root = host.querySelector('[data-slot="chart"]');
    expect(root?.hasAttribute("data-selected")).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Hytte valgt");
    expect(
      // DOM audit: the toggle's data-series index ties it to the focused series.
      host.querySelector('[data-slot="chart-legend-toggle"][data-series="1"]')?.getAttribute("aria-pressed")
    ).toBe("true");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{Enter}");
    expect(root?.hasAttribute("data-selected")).toBe(false);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Ingen serie valgt ");
  });
});

describe("keys per task", () => {
  it("reaches S06's most consuming hour in six keys", async () => {
    // Chartability heuristic 38. Hand-written from the committed Elhub rows: 19:00 holds the day's
    // highest household reading, 1.8034 kWh per meter, beside 0.9273 for cabins. Tab enters, End
    // reaches 23:00 and four ArrowLefts step back to 19:00.
    const { host } = renderThemed(<S06Chart />);
    host.querySelector("button")?.focus();
    const presses = ["{Tab}", "{End}", "{ArrowLeft}", "{ArrowLeft}", "{ArrowLeft}", "{ArrowLeft}"];
    for (const press of presses) await userEvent.keyboard(press);
    expect(presses).toHaveLength(6);
    // The energy preset prints up to 2 fraction digits and drops a trailing 0, with U+00A0 spaces.
    expect(focused()[0]).toBe(
      "kl.\u00a019\u00a0til\u00a020: Husholdning 1,8\u00a0kilowattimer, Hytte 0,93\u00a0kilowattimer"
    );
  });
});
