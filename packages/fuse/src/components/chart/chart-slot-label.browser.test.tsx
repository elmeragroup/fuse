// Chart.SlotLabel, the date pill on the x axis, in Chromium: its geometry, motion and measurement.
// Oracles: DECISIONS D14. The pill centres on the active slot's option; the tick labels whose
// boxes it overlaps fade out, with the pill's 0.375rem padding the ValueLabel pill also takes; a
// part of the label that keeps its value keeps its stack still; above 60 labels it prints one
// label; and the server renders none of it.
import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { intersects } from "../../../test/chart/marks";
import {
  DAY_AND_MONTH,
  DayChart,
  days,
  handles,
  intl,
  parts,
  settle,
  shown,
  shownBox,
  shownText,
  slotLabel,
  spaced,
  textBox,
} from "../../../test/chart/slot-label";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartStyle } from "./chart-types";
import "./chart.css";

/** Focus the plot and step to day `index`. */
async function stepTo(host: HTMLElement, index: number): Promise<void> {
  host.querySelector("button")?.focus();
  await userEvent.keyboard("{Tab}{Home}");
  for (let step = 0; step < index; step += 1) await userEvent.keyboard("{ArrowRight}");
  settle();
}

function option(): DOMRect {
  // DOM audit: the focused option marks the active slot's columns.
  return document.activeElement?.getBoundingClientRect() ?? new DOMRect();
}

describe("Chart.SlotLabel", () => {
  it("renders nothing on the server", () => {
    const html = renderToString(<DayChart count={20} />);
    expect(html).toContain('data-slot="chart-crosshair"');
    expect(html).not.toContain("chart-slot-label");
  });

  it("centres on the active slot's option", async () => {
    const { host } = renderThemed(<DayChart count={20} />);
    await stepTo(host, 9);
    const box = shownBox(host);
    const slot = option();
    expect((box.left + box.right) / 2).toBeCloseTo((slot.left + slot.right) / 2, 0);
  });

  it("sets a narrow label's parts side by side, centred, as wide as the label", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} slotFormat={DAY_AND_MONTH} />);
    // 1 October is narrower than the 30 September its day and month stacks also hold.
    await stepTo(host, 11);
    expect(shownText(host)).toBe(intl(11, DAY_AND_MONTH));
    const boxes = shown(host).map(textBox);
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index]?.left).toBeCloseTo(boxes[index - 1]?.right ?? 0, 1);
    }
    const box = shownBox(host);
    const slot = option();
    expect((box.left + box.right) / 2).toBeCloseTo((slot.left + slot.right) / 2, 0);
  });

  it("fades exactly the tick labels its pill overlaps", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} slotFormat={DAY_AND_MONTH} />);
    // 29 September has a tick of its own, which the pill covers.
    await stepTo(host, 9);
    const text = shownBox(host);
    const padding = 0.375 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const pill = new DOMRect(text.left - padding, text.top, text.width + 2 * padding, text.height);
    // DOM audit: ticks are aria-hidden axis output.
    const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')].filter(
      (tick) => tick.getBoundingClientRect().width > 0
    );
    const faded = ticks.filter((tick) => getComputedStyle(tick).opacity === "0");
    expect(faded.length).toBeGreaterThan(0);
    expect(faded).toEqual(ticks.filter((tick) => intersects(tick.getBoundingClientRect(), pill)));
    // The ticks come back once nothing is active.
    await userEvent.keyboard("{Tab}");
    settle();
    expect(ticks.filter((tick) => getComputedStyle(tick).opacity === "0")).toEqual([]);
  });

  it("rolls only the parts whose value changes", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} slotFormat={DAY_AND_MONTH} />);
    // 28 and 29 September share their month; 30 September and 1 October share nothing but dots.
    await stepTo(host, 8);
    const offsets = () =>
      parts(host).map((part) => part.querySelector<HTMLElement>('[data-part="stack"]')?.style.translate);
    const day28 = offsets();
    await userEvent.keyboard("{ArrowRight}");
    settle();
    const day29 = offsets();
    expect(shownText(host)).toBe(intl(9, DAY_AND_MONTH));
    // The day's digits roll and the month stays.
    const monthPart = parts(host).findIndex((part) => part.textContent.includes("sep"));
    const dayPart = parts(host).findIndex((part) => part.textContent.includes("28"));
    expect(day29[dayPart]).not.toBe(day28[dayPart]);
    expect(day29[monthPart]).toBe(day28[monthPart]);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    settle();
    expect(shownText(host)).toBe(intl(11, DAY_AND_MONTH));
    expect(offsets()[monthPart]).not.toBe(day29[monthPart]);
  });

  it("prints one label, written at once, above 60 labels", async () => {
    const { host } = renderThemed(<DayChart count={61} />);
    await stepTo(host, 40);
    expect(shown(host)).toHaveLength(1);
    expect(shownText(host)).toBe(intl(40, { day: "numeric" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(shownText(host)).toBe(intl(41, { day: "numeric" }));
  });

  it("shows the right value of every part when labels have different numbers of parts", async () => {
    // "North" has one part and the other two have three, so two stacks hold an empty value.
    const names = ["North", "North East", "North West", "South"];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 640 }}>
          <Chart.Root
            data={names.map((name, index) => ({ name, v: index + 1 }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            aria-label="Regioner">
            <Chart.XAxis />
            <Chart.Bar dataKey="v" />
            <Chart.Crosshair>
              <Chart.SlotLabel />
            </Chart.Crosshair>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await stepTo(host, 0);
    const seen = [shownText(host)];
    for (let step = 1; step < names.length; step += 1) {
      await userEvent.keyboard("{ArrowRight}");
      settle();
      seen.push(shownText(host));
    }
    expect(seen).toEqual(names);
  });

  it("writes the same geometry and covers the same ticks under an ancestor's scale(0.5)", async () => {
    // Unit under test: the pill under a scaled ancestor. Oracle: the same chart unscaled, since a
    // transform above the chart changes no layout pixel.
    const geometry = async (scale?: number) => {
      const { host, unmount } = renderThemed(
        <DayChart count={20} format={DAY_AND_MONTH} slotFormat={DAY_AND_MONTH} scale={scale} />
      );
      await stepTo(host, 9);
      const label = slotLabel(host);
      // DOM audit: the pill and its parts carry the geometry the paint writes.
      const written = {
        full: label.style.getPropertyValue("--_full"),
        clip: label.querySelector<HTMLElement>('[data-part="pill"]')?.style.clipPath,
        rider: label.querySelector<HTMLElement>('[data-part="rider"]')?.style.translate,
        parts: parts(host).map((part) => part.style.translate),
        covered: [...host.querySelectorAll('[data-slot="chart-x-tick"][data-covered]')].map(
          (tick) => tick.textContent
        ),
      };
      unmount();
      return written;
    };
    const plain = await geometry();
    expect(plain.covered.length).toBeGreaterThan(0);
    expect(await geometry(0.5)).toEqual(plain);
  });

  it("keeps a compact pill inside the plot and fades the ticks it covers at a larger font size", async () => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = "24px";
    try {
      const { host } = renderThemed(
        <DayChart count={61} format={DAY_AND_MONTH} slotFormat={DAY_AND_MONTH} />
      );
      await expectCompactPillFits(host);
    } finally {
      root.style.fontSize = before;
    }
  });

  it("measures a compact pill with its own word spacing", async () => {
    const names = Array.from({ length: 61 }, (_, index) => `Nord ${String(index + 1)} vest`);
    const { host } = renderThemed(<CategoryChart names={names} slotStyle={{ wordSpacing: "1rem" }} />);
    await expectCompactPillFits(host);
  });

  it("sets the active label again after a font loads, with no pointer move", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} slotFormat={DAY_AND_MONTH} />);
    await stepTo(host, 11);
    // A font that loads changes the label's widths and leaves the plot as it was. A larger size
    // stands in for it, and the page announces the load as a font face set does.
    const sheet = document.createElement("style");
    sheet.textContent = '[data-slot="chart-slot-label"] { font-size: 20px; }';
    document.head.append(sheet);
    try {
      document.fonts.dispatchEvent(new Event("loadingdone"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      settle();
      const boxes = shown(host).map(textBox);
      for (let index = 1; index < boxes.length; index += 1) {
        expect(boxes[index]?.left).toBeCloseTo(boxes[index - 1]?.right ?? 0, 1);
      }
      const box = shownBox(host);
      const slot = option();
      expect((box.left + box.right) / 2).toBeCloseTo((slot.left + slot.right) / 2, 0);
    } finally {
      sheet.remove();
    }
  });

  it("formats no compact label at mount and a bounded number per step", async () => {
    // A format whose `day` counts its reads: each formatting of a slot reads it once or twice.
    let reads = 0;
    const counting = {
      get day() {
        reads += 1;
        return "numeric" as const;
      },
      month: "short",
    } as const;
    const { host } = renderThemed(<DayChart count={100} slotFormat={counting} />);
    host.querySelector("button")?.focus();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const atMount = reads;
    await userEvent.keyboard("{Tab}{Home}");
    const shown = reads;
    for (let step = 0; step < 10; step += 1) await userEvent.keyboard("{ArrowRight}");
    expect(atMount).toBe(0);
    expect(reads - shown).toBeLessThanOrEqual(10 * 4);
    expect(shownText(host)).toBe(intl(10, DAY_AND_MONTH));
  });

  it("measures and paints once a scale(0) ancestor shows it, with no NaN", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} scale={0} />);
    await stepTo(host, 8);
    // The transform changes outside React and moves no layout box, so nothing renders again.
    const scaled = host.querySelector<HTMLElement>('[style*="scale(0)"]');
    if (scaled === null) throw new Error("no scaled wrapper");
    scaled.style.transform = "none";
    await userEvent.keyboard("{ArrowRight}");
    // The step finds nothing measured and measures again once the frame has rendered.
    await expect.poll(() => slotLabel(host).hasAttribute("data-shown")).toBe(true);
    settle();
    // DOM audit: every style the paint writes lives in the pill's subtree.
    const styles = [slotLabel(host), ...slotLabel(host).querySelectorAll<HTMLElement>("*")].map(
      (node) => node.getAttribute("style") ?? ""
    );
    expect(styles.filter((style) => /NaN|Infinity/u.test(style))).toEqual([]);
    expect(shownText(host)).toBe(intl(9, DAY_AND_MONTH));
    const boxes = shown(host).map(textBox);
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index]?.left).toBeCloseTo(boxes[index - 1]?.right ?? 0, 1);
    }
    const box = shownBox(host);
    const slot = option();
    expect((box.left + box.right) / 2).toBeCloseTo((slot.left + slot.right) / 2, 0);
  });

  it("fades the ticks of an x axis that replaced the one it measured, and writes none to the old", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} owned />);
    await stepTo(host, 8);
    // DOM audit: ticks are aria-hidden axis output.
    const old = [...host.querySelectorAll('[data-slot="chart-x-tick"]')];
    // The axis's own parent replaces it, so neither Root nor the pill renders again.
    handles.replaceAxis();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    for (const tick of old) tick.removeAttribute("data-covered");
    await userEvent.keyboard("{ArrowRight}");
    settle();
    expect(old.filter((tick) => tick.isConnected)).toEqual([]);
    expect(old.filter((tick) => tick.hasAttribute("data-covered"))).toEqual([]);
    const pill = shownBox(host);
    const padding = 0.375 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const reach = new DOMRect(pill.left - padding, pill.top, pill.width + 2 * padding, pill.height);
    const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')].filter(
      (tick) => tick.getBoundingClientRect().width > 0
    );
    const covered = ticks.filter((tick) => intersects(tick.getBoundingClientRect(), reach));
    expect(covered.length).toBeGreaterThan(0);
    expect(ticks.filter((tick) => tick.hasAttribute("data-covered"))).toEqual(covered);
  });

  it("measures the ticks again when only the axis's styling changes, and fades the new boxes", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} owned />);
    await stepTo(host, 15);
    // The axis's own parent restyles it, so neither Root nor the pill renders again. At 40 px the
    // tick of 8 October reaches left under the pill of 6 October, which it cleared at 12 px.
    handles.styleAxis({ fontSize: "40px" });
    await nextFrames(2);
    await userEvent.keyboard("{ArrowRight}");
    settle();
    expectCoverMatches(host);
    // DOM audit: the tick's text names it.
    const october8 = [...host.querySelectorAll('[data-slot="chart-x-tick"]')].find(
      (tick) => spaced(tick.textContent) === "8. okt."
    );
    expect(october8?.hasAttribute("data-covered")).toBe(true);
  });

  it("measures its parts again when only Root's inherited styling changes", async () => {
    const { host } = renderThemed(<DayChart count={20} format={DAY_AND_MONTH} />);
    await stepTo(host, 10);
    // Root's own state restyles it, so its children render nothing again.
    handles.styleRoot({ letterSpacing: "4px" });
    await nextFrames(2);
    await userEvent.keyboard("{ArrowRight}");
    settle();
    expect(shownText(host)).toBe(intl(11, DAY_AND_MONTH));
    const boxes = shown(host).map(textBox);
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index]?.left).toBeCloseTo(boxes[index - 1]?.right ?? 0, 1);
    }
    const box = shownBox(host);
    const slot = option();
    expect((box.left + box.right) / 2).toBeCloseTo((slot.left + slot.right) / 2, 0);
  });

  it("keeps the axis's row with no x axis, so the pill clears a legend below it", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 640 }}>
          <Chart.Root
            data={days(20)}
            config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            data-intro="none"
            aria-label="Forbruk per dag">
            <Chart.Line dataKey="kwh" />
            <Chart.Crosshair>
              <Chart.SlotLabel />
            </Chart.Crosshair>
            <Chart.Legend />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // The legend centres under the plot, under the tenth day.
    await stepTo(host, 9);
    const padding = 0.375 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const text = shownBox(host);
    const pill = new DOMRect(text.left - padding, text.top - 2, text.width + 2 * padding, text.height + 4);
    // DOM audit: the legend's items hold its text.
    const legend = [...host.querySelectorAll('[data-slot="chart-legend-item"]')].map((item) =>
      item.getBoundingClientRect()
    );
    expect(legend.length).toBeGreaterThan(0);
    expect(legend.filter((box) => intersects(box, pill))).toEqual([]);
  });

  it("measures with the latest format when a deferred measurement runs after a format change", async () => {
    // Unit under test: a pill whose measurement was deferred by a scale(0) ancestor, then whose
    // format changed before the deferral ran. Oracle: the same chart mounted in the new format.
    // The day alone rolls in one part, and the day with its month in four, so a model of the old
    // format measures too few parts for the new one.
    const DAY = { day: "numeric" } as const;
    const written = (host: HTMLElement) => ({
      text: shownText(host),
      full: slotLabel(host).style.getPropertyValue("--_full"),
      clip: slotLabel(host).querySelector<HTMLElement>('[data-part="pill"]')?.style.clipPath,
      parts: parts(host).map((part) => part.style.translate),
    });
    const fresh = renderThemed(<DayChart count={20} slotFormat={DAY_AND_MONTH} />);
    await stepTo(fresh.host, 9);
    const oracle = written(fresh.host);
    fresh.unmount();
    const { host, rerender } = renderThemed(<DayChart count={20} slotFormat={DAY} scale={0} />);
    await stepTo(host, 8);
    // This step finds nothing measured and defers a measurement to the task after the next frame.
    await userEvent.keyboard("{ArrowRight}");
    flushSync(() => {
      rerender(<DayChart count={20} slotFormat={DAY_AND_MONTH} scale={0} />);
    });
    const scaled = host.querySelector<HTMLElement>('[style*="scale(0)"]');
    if (scaled === null) throw new Error("no scaled wrapper");
    scaled.style.transform = "none";
    await expect.poll(() => slotLabel(host).hasAttribute("data-shown")).toBe(true);
    settle();
    expect(written(host)).toEqual(oracle);
  });
});

/**
 * The ticks the pill covers are exactly the visible ticks whose boxes meet the shown label's box
 * widened by the pill's 0.375rem padding, and at least one.
 */
function expectCoverMatches(host: HTMLElement): void {
  const pill = shownBox(host);
  const padding = 0.375 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const reach = new DOMRect(pill.left - padding, pill.top, pill.width + 2 * padding, pill.height);
  // DOM audit: ticks are aria-hidden axis output.
  const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')].filter(
    (tick) => tick.getBoundingClientRect().width > 0
  );
  const covered = ticks.filter((tick) => intersects(tick.getBoundingClientRect(), reach));
  expect(covered.length).toBeGreaterThan(0);
  expect(ticks.filter((tick) => tick.hasAttribute("data-covered"))).toEqual(covered);
}

/** A category chart of `names`, whose SlotLabel takes `slotStyle`. */
function CategoryChart({
  names,
  slotStyle,
}: {
  names: readonly string[];
  slotStyle?: ChartStyle;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <button type="button">før</button>
      <div style={{ width: 640 }}>
        <Chart.Root
          data={names.map((name, index) => ({ name, v: index + 1 }))}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="name"
          data-intro="none"
          aria-label="Kategorier">
          <Chart.XAxis />
          <Chart.Bar dataKey="v" />
          <Chart.Crosshair>
            <Chart.SlotLabel style={slotStyle} />
          </Chart.Crosshair>
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/**
 * A compact pill at the first and the last slot keeps inside the plot, and at the first slot,
 * whose tick always shows, the ticks its box overlaps fade and no other. Oracle: the pill's own
 * box, read from the page, with whatever typography the page gives it.
 */
async function expectCompactPillFits(host: HTMLElement): Promise<void> {
  // DOM audit: the plot's listbox spans the plot.
  const plot = host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
  const pill = () => parts(host)[0]?.getBoundingClientRect() ?? new DOMRect();
  await stepTo(host, 0);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  settle();
  expect(pill().left).toBeGreaterThanOrEqual(plot.left - 0.5);
  // DOM audit: ticks are aria-hidden axis output.
  const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')].filter(
    (tick) => tick.getBoundingClientRect().width > 0
  );
  const covered = ticks.filter((tick) => intersects(tick.getBoundingClientRect(), pill()));
  expect(covered.length).toBeGreaterThan(0);
  expect(ticks.filter((tick) => tick.hasAttribute("data-covered"))).toEqual(covered);
  await userEvent.keyboard("{End}");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  settle();
  expect(pill().right).toBeLessThanOrEqual(plot.right + 0.5);
}
