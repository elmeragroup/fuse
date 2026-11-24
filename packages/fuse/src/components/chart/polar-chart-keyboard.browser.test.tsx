// A screen reader's key sequence through each polar family, in Chromium. Units under test:
// PieChart.Root, RadialChart.Root, RadarChart.Root and ClockChart.Root. Oracle: the option grammar
// in Norwegian Bokmål, written by hand in vsr's phrase grammar: role, name, state, position and set
// size joined by ", ".
import { virtual } from "@guidepup/virtual-screen-reader";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, useFakeFrames } from "../../../test/animation-frames";
import { animatedWhile, keyOpen, popup, popupFade, popupOpen } from "../../../test/chart/marks";
import { BILL, BILL_CONFIG, SPOKE_CONFIG, SPOKES } from "../../../test/chart/polar-fixtures";
import { phrasesAfter, startReader as start } from "../../../test/chart/spoken";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

afterEach(async () => {
  await virtual.stop();
});

describe("a screen reader's key sequence through each family", () => {
  /** Midnight in Oslo on 25 October 2025, a 24-hour day. */
  const day = Date.parse("2025-10-24T22:00:00Z");
  const families = [
    {
      family: "pie",
      chart: (
        <PieChart.Root data={BILL} config={BILL_CONFIG} nameKey="name" valueKey="v" aria-label="Regning" />
      ),
      keys: [
        ["Tab", 1],
        ["ArrowRight", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, Strøm: 50, 50\sprosent, Kakediagram med 4\sdeler, .*, not selected, position 1, set size 4$/u,
      then: [
        "option, Nettleie: 30, 30\u00a0prosent, not selected, position 2, set size 4",
        "option, Mva: 5, 5\u00a0prosent, not selected, position 4, set size 4",
        "option, Strøm: 50, 50\u00a0prosent, not selected, position 1, set size 4",
        "option, Strøm: 50, 50\u00a0prosent, not selected, position 1, set size 4",
      ],
    },
    {
      family: "radial",
      chart: (
        <RadialChart.Root
          data={BILL}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          max={50}
          aria-label="Ringer"
        />
      ),
      keys: [
        ["Tab", 1],
        ["ArrowDown", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, Strøm: 50 av 50, Ringdiagram med 4\sringer\. .*, not selected, position 1, set size 4$/u,
      then: [
        "option, Nettleie: 30 av 50, not selected, position 2, set size 4",
        "option, Mva: 5 av 50, not selected, position 4, set size 4",
        "option, Strøm: 50 av 50, not selected, position 1, set size 4",
        "option, Strøm: 50 av 50, not selected, position 1, set size 4",
      ],
    },
    {
      family: "radar",
      chart: <RadarChart.Root data={SPOKES} config={SPOKE_CONFIG} nameKey="area" aria-label="Områder" />,
      keys: [
        ["Tab", 1],
        ["ArrowRight", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, NO1: Forbruk 1, Pris 3, Radardiagram med 2\sserier over 3\skategorier\. .*, not selected, position 1, set size 3$/u,
      then: [
        "option, NO2: Forbruk 2, Pris 2, not selected, position 2, set size 3",
        "option, NO3: Forbruk 3, Pris 1, not selected, position 3, set size 3",
        "option, NO1: Forbruk 1, Pris 3, not selected, position 1, set size 3",
        "option, NO1: Forbruk 1, Pris 3, not selected, position 1, set size 3",
      ],
    },
    {
      family: "clock",
      chart: (
        <ClockChart.Root
          data={Array.from({ length: 24 }, (_, hour) => ({ start: day + hour * 3_600_000, kwh: hour }))}
          config={{ kwh: { label: "kWh", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="hour"
          aria-label="Døgn"
        />
      ),
      keys: [
        ["Tab", 1],
        ["ArrowRight", 1],
        ["PageDown", 1],
        ["PageUp", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, kl\.\s00\stil\s01: kWh 0, Klokkediagram med 1\sserie\. .*, not selected, position 1, set size 24$/u,
      then: [
        "option, kl.\u00a001\u00a0til\u00a002: kWh 1, not selected, position 2, set size 24",
        "option, kl.\u00a007\u00a0til\u00a008: kWh 7, not selected, position 8, set size 24",
        "option, kl.\u00a001\u00a0til\u00a002: kWh 1, not selected, position 2, set size 24",
        "option, kl.\u00a023\u00a0til\u00a024: kWh 23, not selected, position 24, set size 24",
        "option, kl.\u00a000\u00a0til\u00a001: kWh 0, not selected, position 1, set size 24",
        "option, kl.\u00a000\u00a0til\u00a001: kWh 0, not selected, position 1, set size 24",
      ],
    },
  ];

  it.each(families)(
    "speaks the $family chart's options through Tab, arrows, Home, End and Escape",
    async ({ chart, keys, first, then }) => {
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <button type="button">før</button>
          {chart}
        </LocaleProvider>
      );
      await start(host);
      const heard = await phrasesAfter(keys);
      // Tab enters on the first option with the chart's description, each key moves the option, and
      // Escape leaves focus on it with nothing new to say.
      expect(heard[0]).toMatch(first);
      expect(heard.slice(1)).toEqual(then);
    }
  );
});

describe("a key step on a clock", () => {
  /** Midnight in Oslo on 25 October 2025, a 24-hour day. */
  const day = Date.parse("2025-10-24T22:00:00Z");

  /** A day of hours with the Scrubber's hand and the Tooltip, with a button before it. */
  function Day() {
    return (
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <button type="button">før</button>
        <ClockChart.Root
          data={Array.from({ length: 24 }, (_, hour) => ({ start: day + hour * 3_600_000, kwh: hour + 1 }))}
          config={{ kwh: { label: "kWh", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="hour"
          data-intro="none"
          aria-label="Døgn">
          <ClockChart.Column dataKey="kwh" />
          <ClockChart.Scrubber />
          <ClockChart.Tooltip />
        </ClockChart.Root>
      </LocaleProvider>
    );
  }

  /**
   * The angle the hand shows, in degrees clockwise from 12 o'clock within one turn, read from its
   * rendered box. The hand is a spoke from the hole to the rim, so its box's middle lies on its ray
   * from the dial's center, the middle of the Scrubber's layer.
   */
  function hand(host: HTMLElement): number {
    // The Scrubber is aria-hidden plot output, so its slots locate its layer and its hand.
    const layer = host.querySelector('[data-slot="clock-chart-scrubber"]')?.getBoundingClientRect();
    const spoke = host.querySelector('[data-slot="clock-chart-scrubber-path"]')?.getBoundingClientRect();
    if (layer === undefined || spoke === undefined) return Number.NaN;
    const x = spoke.left + spoke.width / 2 - (layer.left + layer.width / 2);
    const y = spoke.top + spoke.height / 2 - (layer.top + layer.height / 2);
    const turn = (Math.atan2(x, -y) * 180) / Math.PI;
    return (turn + 360) % 360;
  }

  it("turns the hand onto the hour at once on Arrow, End and Home, and holds it a frame later", async () => {
    const { host } = renderThemed(<Day />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await nextFrames(2);
    // An hour is 15°, and the hand points at the hour's middle: 00 to 01 at 7.5°.
    expect(Math.abs(hand(host) - 7.5)).toBeLessThan(0.5);
    // From here on, a frame runs only when the test moves the clock.
    useFakeFrames();
    for (const [key, angle, position] of [
      ["ArrowRight", 22.5, "2"],
      ["End", 352.5, "24"],
      ["Home", 7.5, "1"],
    ] as const) {
      // The key goes to the option that has focus now, and the first read runs in the same task,
      // so no frame runs between them.
      const option = document.activeElement;
      if (option?.getAttribute("role") !== "option") throw new Error("no focused option");
      option.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
      expect(Math.abs(hand(host) - angle), key).toBeLessThan(0.5);
      // React commits the step, which hands focus to the new hour's option, and then one frame runs.
      await expect.poll(() => document.activeElement?.getAttribute("aria-posinset")).toBe(position);
      vi.advanceTimersByTime(16);
      expect(Math.abs(hand(host) - angle), `${key}, a frame later`).toBeLessThan(0.5);
    }
  });

  it("opens the tooltip at once on focus, fades it in on a pointer, and fades it out after a key opened it", async () => {
    const { host } = renderThemed(<Day />);
    host.querySelector("button")?.focus();
    // The popup holds at opacity 0 until it is placed, and then shows at full opacity, with no
    // transition, fade or other animation of its own.
    expect(await keyOpen(() => userEvent.keyboard("{Tab}"))).toEqual({ motion: [], firstOpacity: 1 });
    // The popup and its positioner, where Base UI places it, are both visible, with no opacity 0 on
    // either or above them.
    const shown = popup();
    if (shown === null) throw new Error("no open popup");
    expect(shown.parentElement?.checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(
      true
    );
    expect(shown.checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(true);
    expect(
      await animatedWhile(
        () => popupFade(document.querySelector('[data-slot="chart-tooltip"]')),
        () => userEvent.keyboard("{Escape}"),
        () => !popupOpen()
      )
    ).toEqual(["fade"]);
    await userEvent.keyboard("{Tab}");
    const dial = host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
    // A third of the way out from the center toward 3 o'clock lands on a column.
    expect(
      await animatedWhile(
        () => popupFade(popup()),
        () =>
          userEvent.hover(host.querySelector('[role="listbox"]') ?? document.body, {
            position: { x: dial.width / 2 + dial.width / 3, y: dial.height / 2 },
            force: true,
          }),
        popupOpen
      )
    ).toEqual(["fade"]);
  });
});
