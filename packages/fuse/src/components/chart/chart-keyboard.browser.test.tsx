import type { ReactNode } from "react";

// The chart's key maps, the Escape rule and the modifier rule, in Chromium.
// Every expected option name, position and set size is written by hand from the committed
// Elhub rows and the hand-written month-switch fixture, never read from Fuse.
import { virtual } from "@guidepup/virtual-screen-reader";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, pollFrames } from "../../../test/animation-frames";
import { axFocused, axNodes, axProperty } from "../../../test/ax-tree";
import { S06Chart } from "../../../test/chart/bar-charts";
import {
  animatedWhile,
  animating,
  keyOpen,
  label,
  pointerAt,
  popup,
  popupFade,
  popupOpen,
  surfaceBox,
} from "../../../test/chart/marks";
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
  it("is one Tab stop: Tab leaves the plot from any option, and Shift+Tab returns to the active one", async () => {
    const { host } = renderThemed(<S06Chart orientation="horizontal" />);
    const listbox = host.querySelector('[role="listbox"]');
    await enterChart(host);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const active = focused();
    expect(listbox?.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Tab}");
    expect(listbox?.contains(document.activeElement)).toBe(false);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(focused()).toEqual(active);
  });

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
    // Y ticks are aria-hidden text, so their slot is the only locator.
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
    // Root's data-active, data-pinned and data-selected are its public paint contract.
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

  it("toggles the pin with Enter while no LegendToggleGroup is mounted, and the pinned tooltip's option stays unselected", async () => {
    const { host } = renderThemed(
      <S06Chart>
        <Chart.Bar dataKey="household" />
        <Chart.Tooltip />
      </S06Chart>
    );
    await enterChart(host);
    await userEvent.keyboard("{Enter}");
    // Root's data-pinned attribute is its public paint contract.
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-pinned")).toBe(true);
    await expect.poll(popupOpen).toBe(true);
    // A pin holds the tooltip and selects nothing, as Chromium's accessibility tree reports.
    const focusedNode = axFocused(await axNodes());
    expect(focusedNode?.role?.value).toBe("option");
    expect(axProperty(focusedNode ?? { nodeId: "" }, "selected")).toBe(false);
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
    // Root's data-active, data-pinned and data-selected are its public paint contract.
    const root = host.querySelector('[data-slot="chart"]');
    expect(root?.hasAttribute("data-selected")).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Hytte valgt");
    expect(
      // The toggle's data-series index ties it to the focused series.
      host.querySelector('[data-slot="chart-legend-toggle"][data-series="1"]')?.getAttribute("aria-pressed")
    ).toBe("true");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{Enter}");
    expect(root?.hasAttribute("data-selected")).toBe(false);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Ingen serie valgt ");
  });
});

describe("keys per task", () => {
  it("reaches a normal day's most consuming hour in six keys", async () => {
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

describe("a key step lands at once", () => {
  /** S06's household line with every part that follows the active slot, the crosshair a line. */
  function Followers(): ReactNode {
    return (
      <S06Chart>
        <Chart.Line dataKey="household" />
        <Chart.ActiveDot dataKey="household" />
        <Chart.Crosshair variant="line">
          <Chart.SlotLabel />
        </Chart.Crosshair>
        <Chart.Tooltip />
      </S06Chart>
    );
  }

  /** The parts that follow the active slot, by name. */
  function followers(host: HTMLElement): string[] {
    // Each follower is aria-hidden plot output, and the popup portals out of the host, so their
    // slots are the only locators. The tooltip glides on Base UI's positioner, the popup's parent.
    return animating({
      crosshair: host.querySelector('[data-slot="chart-crosshair"]'),
      "active dot": host.querySelector('[data-slot="chart-active-dot"]'),
      "slot label": host.querySelector('[data-slot="chart-slot-label"]'),
      tooltip: document.querySelector('[data-slot="chart-tooltip"]')?.parentElement,
    });
  }

  /** Waits until nothing in the chart or its popup animates, so a step starts from rest. */
  async function rest(host: HTMLElement): Promise<void> {
    await nextFrames(2);
    const popupNode = document.querySelector('[data-slot="chart-tooltip"]');
    const running = [
      ...host.getAnimations({ subtree: true }),
      ...(popupNode?.getAnimations({ subtree: true }) ?? []),
    ];
    await Promise.all(running.map((animation) => animation.finished));
  }

  /** The x of the crosshair line's middle in client pixels, or NaN with no line. */
  function crosshairX(host: HTMLElement): number {
    // The line is aria-hidden plot output, so its slot locates it.
    const box = host.querySelector('[data-slot="chart-crosshair-mark"]')?.getBoundingClientRect();
    return box === undefined ? Number.NaN : box.left + box.width / 2;
  }

  /** The x of the active dot's middle in client pixels while it shows, or NaN when it does not. */
  function activeDotX(host: HTMLElement): number {
    // The dot is aria-hidden plot output, so its slot locates it.
    const dot = host.querySelector('[data-slot="chart-active-dot"] [data-slot="chart-dot"]');
    if (dot === null || !dot.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
      return Number.NaN;
    const box = dot.getBoundingClientRect();
    return box.left + box.width / 2;
  }

  /**
   * The middles of S06's 24 hours in client pixels. The hours are equal slots, so the middles lie
   * evenly between the first and the last, where Home and End put the crosshair at rest. It leaves
   * the chart on the first hour.
   */
  async function slotMiddles(host: HTMLElement): Promise<number[]> {
    await userEvent.keyboard("{End}");
    await rest(host);
    const last = crosshairX(host);
    await userEvent.keyboard("{Home}");
    await rest(host);
    const first = crosshairX(host);
    return Array.from({ length: 24 }, (_, slot) => first + ((last - first) * slot) / 23);
  }

  /** Whether the tooltip's positioner runs its own glide, a script animation of its place. */
  function tooltipGlides(): boolean {
    // The popup portals out of the host, so its slot locates it, and Base UI's positioner is its
    // parent. The popup's own fade is a CSS transition on the popup, not on the positioner.
    const positioner = document.querySelector('[data-slot="chart-tooltip"]')?.parentElement;
    return (
      positioner
        ?.getAnimations()
        .some(
          (animation) =>
            !(animation instanceof CSSTransition) &&
            !(animation instanceof CSSAnimation) &&
            animation.playState === "running"
        ) ?? false
    );
  }

  it("moves the crosshair, active dot, slot label and tooltip with no glide on Arrow, Home and End", async () => {
    const { host } = renderThemed(<Followers />);
    await enterChart(host);
    await rest(host);
    const middles = await slotMiddles(host);
    for (const [key, shows, slot] of [
      ["{ArrowRight}", "01–02", 1],
      ["{End}", "23–24", 23],
      ["{Home}", "00–01", 0],
    ] as const) {
      const seen = await animatedWhile(
        () => followers(host),
        () => userEvent.keyboard(key),
        () => label() === shows
      );
      expect(seen, key).toEqual([]);
      // The active dot shows on the line at the hour's middle.
      expect(Math.abs(activeDotX(host) - (middles[slot] ?? Number.NaN)), key).toBeLessThan(0.5);
    }
  });

  it("glides every follower on a pointer step, the control", async () => {
    const { host } = renderThemed(<Followers />);
    const plot = surfaceBox(host);
    const hour = plot.width / 24;
    await pointerAt(plot.left + hour * 3.5, plot.top + plot.height / 2);
    await rest(host);
    const seen = await animatedWhile(
      () => followers(host),
      () => pointerAt(plot.left + hour * 8.5, plot.top + plot.height / 2),
      () => label() === "08–09"
    );
    expect(seen).toEqual(["active dot", "crosshair", "slot label", "tooltip"]);
  });

  it("cancels the pointer's glides when a key takes over the slot they glide to", async () => {
    const { host } = renderThemed(<Followers />);
    await enterChart(host);
    await rest(host);
    const middles = await slotMiddles(host);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await rest(host);
    const surface = host.querySelector('[role="listbox"]');
    const option = document.activeElement;
    if (surface === null || option === null) throw new Error("no focused option");
    const plot = surfaceBox(host);
    const crosshair = host.querySelector('[data-slot="chart-crosshair"]');
    // The popup portals out of the host, and Base UI's positioner is its parent.
    const positioner = document.querySelector('[data-slot="chart-tooltip"]')?.parentElement;
    if (positioner === undefined || positioner === null) throw new Error("no tooltip positioner");
    // Where the popup rests over 03:00, the focused option's slot, which the takeover lands it on.
    const resting = positioner.getBoundingClientRect();
    const moveTo = (slot: number): void => {
      surface.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: middles[slot],
          clientY: plot.top + plot.height / 2,
          pointerType: "mouse",
        })
      );
    };
    // The pointer leaves for 08:00, and the glides there finish, so only the glides back run next.
    moveTo(8);
    await pollFrames(label, "08–09");
    await rest(host);
    expect(tooltipGlides()).toBe(false);
    // The pointer comes back to 03:00, and the crosshair and the popup glide back toward it.
    moveTo(3);
    await pollFrames(tooltipGlides, true, 10);
    expect(animating({ crosshair })).toEqual(["crosshair"]);
    // Enter pins the focused option's slot, the one the pointer already made active. The key and
    // the reads run in one task, so nothing else ends the glides.
    option.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(tooltipGlides()).toBe(false);
    const landed = positioner.getBoundingClientRect();
    expect(Math.abs(landed.left - resting.left)).toBeLessThan(0.5);
    expect(Math.abs(landed.top - resting.top)).toBeLessThan(0.5);
    expect(animating({ crosshair })).toEqual([]);
    expect(Math.abs(crosshairX(host) - (middles[3] ?? Number.NaN))).toBeLessThan(0.5);
  });
});

describe("the tooltip's entrance", () => {
  /** The open popup's own animations and transitions, by name. */
  function entering(): string[] {
    return popupFade(popup());
  }

  it("opens at once on focus, fades in on a pointer, and fades out after a key opened it", async () => {
    const { host } = renderThemed(
      <S06Chart>
        <Chart.Bar dataKey="household" />
        <Chart.Tooltip />
      </S06Chart>
    );
    expect(await keyOpen(() => enterChart(host))).toEqual({ motion: [], firstOpacity: 1 });
    // The exit fades whatever opened the popup.
    expect(
      await animatedWhile(
        () => popupFade(document.querySelector('[data-slot="chart-tooltip"]')),
        () => userEvent.keyboard("{Escape}"),
        () => !popupOpen()
      )
    ).toEqual(["fade"]);
    await userEvent.keyboard("{Tab}");
    const plot = surfaceBox(host);
    expect(
      await animatedWhile(
        entering,
        () => pointerAt(plot.left + plot.width / 2, plot.top + plot.height / 2),
        popupOpen
      )
    ).toEqual(["fade"]);
  });
});
