import type { ReactNode } from "react";

import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { label, pointerAt, popup } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

const keys: string[] = [];
const recordKey = (event: KeyboardEvent): void => {
  keys.push(`${event.key}${event.defaultPrevented ? " handled" : ""}`);
};

afterEach(() => {
  document.removeEventListener("keydown", recordKey);
  keys.length = 0;
});

/** A bill's parts as shares of 100, so each value prints as its own share. */
const BILL = [
  { name: "strom", v: 62 },
  { name: "nettleie", v: 34 },
  { name: "avgifter", v: 4 },
];

const BILL_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgifter: { label: "Avgifter", color: "chart-3" },
} as const;

/** Two series over three categories. */
const SPOKES = [
  { cat: "a", v: 1, w: 3 },
  { cat: "b", v: 2, w: 2 },
  { cat: "c", v: 3, w: 1 },
];

const SPOKE_CONFIG = {
  v: { label: "Forbruk", color: "chart-1" },
  w: { label: "Pris", color: "chart-2" },
} as const;

function Pie({
  children,
  width = 400,
  data = BILL,
  ...props
}: {
  readonly children?: ReactNode;
  readonly width?: number;
  readonly data?: readonly { readonly name: string; readonly v: number }[];
  readonly startAngle?: number;
  readonly endAngle?: number;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width }}>
        <PieChart.Root
          data={data}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          aria-label="Kake"
          {...props}>
          {children}
        </PieChart.Root>
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

/** The figure a polar Root renders. */
function figureOf(host: HTMLElement): HTMLElement {
  // Every polar Root marks its figure with data-polar.
  const figure = host.querySelector<HTMLElement>("[data-polar]");
  if (figure === null) throw new Error("no polar figure");
  return figure;
}

/** The client point at an angle and a share of the outer radius from the cell's center. */
function pointAt(host: HTMLElement, angle: number, share: number): readonly [number, number] {
  const surface = page.getByRole("listbox").element().getBoundingClientRect();
  const radians = (angle * Math.PI) / 180;
  const radius = (surface.width / 2) * share;
  return [
    surface.left + surface.width / 2 + radius * Math.sin(radians),
    surface.top + surface.height / 2 - radius * Math.cos(radians),
  ];
}

/**
 * Move the real pointer to a point, so the pointer the chart reads and the cursor the browser hit
 * tests are one, wherever an earlier test left the cursor.
 */
async function hover(x: number, y: number): Promise<void> {
  await pointerAt(x, y);
}

describe("the polar Root's structure", () => {
  it("renders the description, the instructions, the listbox, the parts and the status in order", () => {
    const { host } = renderThemed(
      <Pie>
        <PieChart.Legend />
      </Pie>
    );
    const figure = figureOf(host);
    expect(figure.getAttribute("aria-label")).toBe("Kake");
    // Root's own children carry their slots in this order.
    expect(
      [...figure.querySelectorAll("[data-slot]")]
        .map((element) => element.getAttribute("data-slot"))
        .filter((slot) =>
          [
            "chart-description",
            "chart-instructions",
            "chart-surface",
            "chart-legend",
            "chart-status",
          ].includes(slot ?? "")
        )
    ).toEqual(["chart-description", "chart-instructions", "chart-surface", "chart-legend", "chart-status"]);
    // The description and the instructions are the listbox's described-by paragraphs,
    // which the stylesheet hides, so they are read by slot.
    expect(figure.querySelector('[data-slot="chart-description"]')?.textContent).toBe(
      "Kakediagram med 3\u00a0deler, totalt 100. Strøm: 62, 62\u00a0prosent. Nettleie: 34, 34\u00a0prosent. Avgifter: 4, 4\u00a0prosent."
    );
    expect(figure.querySelector('[data-slot="chart-instructions"]')?.textContent).toBe(
      "Bruk piltastene for å gå mellom delene."
    );
    const listbox = page.getByRole("listbox").element();
    expect(listbox.getAttribute("aria-label")).toBe("Kake, datapunkter");
    expect(listbox.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("orients a radar's listbox horizontally and reads the cartesian key help", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <RadarChart.Root data={SPOKES} config={SPOKE_CONFIG} nameKey="cat" aria-label="Radar" />
      </LocaleProvider>
    );
    expect(page.getByRole("listbox").element().getAttribute("aria-orientation")).toBe("horizontal");
    // The instructions are a described-by paragraph the stylesheet hides.
    expect(figureOf(host).querySelector('[data-slot="chart-instructions"]')?.textContent).toBe(
      "Bruk venstre og høyre pil for å gå mellom punktene, og opp og ned for å velge serie."
    );
  });
});

describe("the pie and radial key maps", () => {
  it("moves clockwise and wraps on a pie, with Home and End at the ends", async () => {
    renderThemed(<Pie />);
    await userEvent.tab();
    expect(focused()).toEqual(["Strøm: 62, 62\u00a0prosent", "1", "3"]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()[1]).toBe("3");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()[1]).toBe("1");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toEqual(["Nettleie: 34, 34\u00a0prosent", "2", "3"]);
    await userEvent.keyboard("{End}");
    expect(focused()[1]).toBe("3");
    await userEvent.keyboard("{Home}");
    expect(focused()[1]).toBe("1");
  });

  it("stops at the first and last ring of a radial chart, which does not wrap", async () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <RadialChart.Root
          data={BILL}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          max={100}
          aria-label="Ringer"
        />
      </LocaleProvider>
    );
    await userEvent.tab();
    expect(focused()).toEqual(["Strøm: 62 av 100", "1", "3"]);
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()[1]).toBe("1");
    await userEvent.keyboard("{End}{ArrowRight}");
    expect(focused()).toEqual(["Avgifter: 4 av 100", "3", "3"]);
  });

  it("lets PageUp and PageDown propagate", async () => {
    renderThemed(<Pie />);
    await userEvent.tab();
    document.addEventListener("keydown", recordKey);
    await userEvent.keyboard("{PageDown}{PageUp}");
    expect(keys).toEqual(["PageDown", "PageUp"]);
  });
});

describe("the radar key map", () => {
  it("moves between spokes with Left and Right, wrapping, and between series with Up and Down", async () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <RadarChart.Root data={SPOKES} config={SPOKE_CONFIG} nameKey="cat" aria-label="Radar" />
      </LocaleProvider>
    );
    await userEvent.tab();
    expect(focused()).toEqual(["a: Forbruk 1, Pris 3", "1", "3"]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()[1]).toBe("3");
    await userEvent.keyboard("{ArrowRight}{ArrowDown}");
    // Right after Up or Down the series speaks first, so the part that changed comes first.
    expect(focused()).toEqual(["Forbruk 1, a", "1", "3"]);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    // The series focus does not wrap past the last series.
    expect(focused()).toEqual(["Pris 3, a", "1", "3"]);
  });
});

describe("Escape and pinning", () => {
  it("lets a hover open the slice that Escape closed once focus has left the chart", async () => {
    // Escape closes the focused Strøm, and the dismissal lasts only while the reader stays: a
    // blur ends it, so the pointer that then moves over Strøm, 0° to 223.2°, opens it.
    const { host } = renderThemed(
      <Pie>
        <PieChart.Tooltip />
      </Pie>
    );
    await userEvent.tab();
    await expect.poll(label).toBe("Strøm");
    await userEvent.keyboard("{Escape}");
    expect(figureOf(host).hasAttribute("data-active")).toBe(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await hover(...pointAt(host, 80, 0.5));
    await hover(...pointAt(host, 100, 0.5));
    await expect.poll(label).toBe("Strøm");
    expect(figureOf(host).hasAttribute("data-active")).toBe(true);
  });

  it("pins with Enter, hides the pin with the first Escape and lets the second propagate", async () => {
    const { host } = renderThemed(<Pie />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    // Root states the pin on data-pinned, which the stylesheet reads.
    expect(figureOf(host).hasAttribute("data-pinned")).toBe(true);
    document.addEventListener("keydown", recordKey);
    await userEvent.keyboard("{Escape}");
    expect(figureOf(host).hasAttribute("data-pinned")).toBe(false);
    expect(figureOf(host).hasAttribute("data-active")).toBe(false);
    await userEvent.keyboard("{Escape}");
    // The first Escape stops at the chart, so only the second reaches the document.
    expect(keys).toEqual(["Escape"]);
    // Escape keeps the reader's place.
    expect(focused()[1]).toBe("1");
  });

  it("selects the focused slice with Enter under a LegendToggleGroup, and announces it", async () => {
    const { host } = renderThemed(
      <Pie>
        <PieChart.LegendToggleGroup />
      </Pie>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(page.getByRole("button", { name: "Strøm" }).element().getAttribute("aria-pressed")).toBe("true");
    expect(page.getByRole("status").element().textContent.trim()).toBe("Strøm valgt");
    expect(figureOf(host).hasAttribute("data-pinned")).toBe(false);
  });

  it("picks the slice under the pointer by angle and pins it on click", async () => {
    // Strøm sweeps 0° to 223.2° and Nettleie 223.2° to 345.6°.
    const { host } = renderThemed(
      <Pie>
        <PieChart.Tooltip />
      </Pie>
    );
    await hover(...pointAt(host, 90, 0.5));
    await expect.poll(label).toBe("Strøm");
    await hover(...pointAt(host, 300, 0.5));
    await expect.poll(label).toBe("Nettleie");
    await userEvent.click(page.getByRole("listbox"));
    expect(figureOf(host).hasAttribute("data-pinned")).toBe(true);
  });
});

/**
 * Pauses the popup's exit halfway. Once Base UI marks the popup `data-ending-style`, the helper holds
 * its opacity transition toward the close's 0 at half its duration.
 *
 * @param popup - The open popup.
 * @returns The paused transition.
 */
function pausedExit(popup: HTMLElement): Promise<Animation> {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!popup.hasAttribute("data-ending-style")) return;
      observer.disconnect();
      // Reading them computes the ending style, which starts the exit's transitions.
      const fade = popup
        .getAnimations()
        .find((running) => running instanceof CSSTransition && running.transitionProperty === "opacity");
      if (fade === undefined) {
        reject(new Error("no exit transition"));
        return;
      }
      fade.pause();
      fade.currentTime = Number(fade.effect?.getComputedTiming().duration) / 2;
      resolve(fade);
    });
    observer.observe(popup, { attributes: true, attributeFilter: ["data-ending-style"] });
  });
}

describe("the tooltip's placement hold", () => {
  it("shows a popup that reopens on the dial's other half during its exit transparent in its new lane", async () => {
    // Strøm sweeps 0° to 223.2°, so 90° rests its popup in the right lane, and Nettleie, 223.2° to
    // 345.6°, rests its popup at 300° in the left lane. Escape starts the exit, which is paused
    // halfway, so the hover that follows opens Nettleie before it ends. The positioner carries the
    // popup across the dial, and its first frame in the left lane shows nothing. The side lanes need a viewport
    // wider than the default.
    await page.viewport(1024, 768);
    onTestFinished(() => page.viewport(414, 896));
    const { host } = renderThemed(
      <Pie width={800}>
        <PieChart.Tooltip />
      </Pie>
    );
    await hover(...pointAt(host, 90, 0.5));
    await expect.poll(label).toBe("Strøm");
    const open = popup();
    if (open === null) throw new Error("no popup");
    await expect.poll(() => getComputedStyle(open).opacity).toBe("1");
    // The positioner carries the popup to its lane; the popup's own entrance slides it inside.
    const positioner = open.parentElement;
    if (positioner === null) throw new Error("no positioner");
    const lane = (): number => positioner.getBoundingClientRect().left;
    const dial = page.getByRole("listbox").element().getBoundingClientRect();
    const center = dial.left + dial.width / 2;
    expect(lane()).toBeGreaterThan(center);
    const recorded = recordFrames(
      () => ({ left: lane(), opacity: Number(getComputedStyle(open).opacity) }),
      () => label() === "Nettleie" && getComputedStyle(open).opacity === "1"
    );
    const exit = pausedExit(open);
    await userEvent.keyboard("{Escape}");
    // The close waits on the transition the pause holds, so it cannot end before the hover.
    const paused = await exit;
    expect(paused.playState).toBe("paused");
    const halfway = Number(getComputedStyle(open).opacity);
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(1);
    await hover(...pointAt(host, 300, 0.5));
    const frames = await recorded;
    // The hover reopened the same popup during its exit.
    expect(popup()).toBe(open);
    const left = lane();
    expect(positioner.getBoundingClientRect().right).toBeLessThan(center);
    expect(frames.find((frame) => Math.abs(frame.left - left) < 1)?.opacity).toBe(0);
  });
});

describe("a key step that changes the tooltip's lane", () => {
  /**
   * A bill whose second and third values print far wider than the first. At 495 px the first
   * value's popup fits a side lane, and the wide values' popups need the lane below the dial.
   */
  const WIDE = [
    { name: "strom", v: 1 },
    { name: "nettleie", v: 123_456 },
    { name: "avgifter", v: 99_999 },
  ];

  /** The same bill with the wide value first, so the popup Tab opens needs the lane below the dial. */
  const WIDE_FIRST = [
    { name: "nettleie", v: 123_456 },
    { name: "strom", v: 1 },
    { name: "avgifter", v: 99_999 },
  ];

  /**
   * Widens the viewport so the side lanes have room, and waits until the browser has delivered the
   * resize, so no late resize lands during the test. The next test gets the default viewport back.
   */
  async function wideViewport(): Promise<void> {
    await page.viewport(1024, 768);
    onTestFinished(() => page.viewport(414, 896));
    await expect.poll(() => window.innerWidth).toBe(1024);
    await nextFrames(2);
  }

  /** The popup's lane, as Base UI marks the side its positioner sits on. */
  function side(): string | null {
    // The popup portals out of the host, and its positioner is its parent.
    return popup()?.parentElement?.getAttribute("data-side") ?? null;
  }

  /** The open popup's computed opacity, or NaN while none is open. */
  function opacity(): number {
    const open = popup();
    return open === null ? Number.NaN : Number(getComputedStyle(open).opacity);
  }

  /**
   * The popup's lane and opacity on every frame from the next one until it shows `name` on a
   * lane other than `from` and 20 more frames have run.
   */
  function laneFrames(
    name: string,
    from: string | null
  ): Promise<{ side: string | null; opacity: number }[]> {
    let left = 20;
    return recordFrames(
      () => ({ side: side(), opacity: opacity() }),
      () => label() === name && side() !== from && (left -= 1) <= 0
    );
  }

  /**
   * Expects the popup to fade into a lane: a partly opaque frame in that lane, and fully opaque in
   * that lane on the last frame recorded. A popup that never shows there, or that stays faint, fails.
   */
  function expectFadeInto(frames: readonly { side: string | null; opacity: number }[], lane: string): void {
    const there = frames.filter((frame) => frame.side === lane);
    const from = there.findIndex((frame) => frame.opacity > 0 && frame.opacity < 1);
    expect(from, `a partly opaque frame in the ${lane} lane`).toBeGreaterThanOrEqual(0);
    expect(frames.at(-1), `the last frame`).toEqual({ side: lane, opacity: 1 });
  }

  /** A bill at a width, with a button before it and the Tooltip. */
  function chart(width: number, data = WIDE): ReactNode {
    return (
      <>
        <button type="button">før</button>
        <Pie width={width} data={data}>
          <PieChart.Tooltip />
        </Pie>
      </>
    );
  }

  /** Tabs onto the chart, which opens Strøm's popup, and waits until it shows. */
  async function enter(host: HTMLElement): Promise<void> {
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await expect.poll(label).toBe("Strøm");
    await expect.poll(opacity).toBe(1);
  }

  it("moves the popup to the lane a key step's content needs at once, with no fade", async () => {
    await wideViewport();
    const { host } = renderThemed(chart(495));
    await enter(host);
    const first = side();
    // Nettleie's wide value sends the popup from its side lane to the lane below the dial.
    const stepped = laneFrames("Nettleie", first);
    await userEvent.keyboard("{ArrowRight}");
    const frames = await stepped;
    expect([first, frames.at(-1)?.side]).toEqual(["right", "bottom"]);
    expect(frames.filter((frame) => frame.opacity !== 1)).toEqual([]);
  });

  it("opens on a key straight into the lane the content needs, with no fade", async () => {
    await wideViewport();
    const { host } = renderThemed(
      <>
        <button type="button">før</button>
        <Pie width={495} data={WIDE_FIRST}>
          <PieChart.Tooltip />
        </Pie>
      </>
    );
    host.querySelector("button")?.focus();
    const opened = laneFrames("Nettleie", null);
    await userEvent.keyboard("{Tab}");
    const frames = await opened;
    // The placement hold shows nothing until the popup's content is measured and Base UI has placed
    // it in the lane that content needs. Its first visible frame, and every one after it, shows it
    // fully opaque below the dial.
    const shown = frames.filter((frame) => frame.opacity > 0);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.filter((frame) => frame.side !== "bottom" || frame.opacity !== 1)).toEqual([]);
  });

  it("fades the popup back into a key step's lane when a scroll moves it away and back", async () => {
    await wideViewport();
    onTestFinished(() => window.scrollTo(0, 0));
    // Below 700 px of page, the wide popup a key opens has no room under the dial and rests above
    // it. Scrolled to 800 px it rests below, and scrolled back it rests above again.
    const { host } = renderThemed(
      <>
        <div style={{ height: 700 }} />
        {chart(495, WIDE_FIRST)}
        <div style={{ height: 1500 }} />
      </>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await expect.poll(label).toBe("Nettleie");
    await expect.poll(opacity).toBe(1);
    const keyed = window.scrollY;
    const first = side();
    const away = laneFrames("Nettleie", first);
    window.scrollTo(0, 800);
    expect([first, (await away).at(-1)?.side]).toEqual(["top", "bottom"]);
    // The scroll back, not the key, moves the popup to the lane the key opened it in, so it fades.
    const back = laneFrames("Nettleie", "bottom");
    window.scrollTo(0, keyed);
    expectFadeInto(await back, "top");
  });

  /**
   * Pauses the next lane fade halfway: once the popup runs its script fade, the helper holds it at
   * half its duration. It looks once per frame, for at most 60 frames.
   */
  function pausedLaneFade(): Promise<Animation> {
    return new Promise((resolve, reject) => {
      let frames = 0;
      const look = (): void => {
        const fade = popup()
          ?.getAnimations()
          .find(
            (running) =>
              !(running instanceof CSSTransition) &&
              !(running instanceof CSSAnimation) &&
              running.playState === "running"
          );
        if (fade !== undefined) {
          fade.pause();
          fade.currentTime = Number(fade.effect?.getComputedTiming().duration) / 2;
          resolve(fade);
        } else if ((frames += 1) > 60) reject(new Error("no lane fade"));
        else requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
  }

  it("keeps a resize's lane fade running when a data update drops the focused series", async () => {
    await wideViewport();
    // At 800 px the radar's popup rests in a side lane, and at 300 px only the lane below the dial
    // has room, so the resize fades it in there.
    const radar = (width: number, series: "both" | "Forbruk") => (
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width }}>
          {series === "both" ? (
            <RadarChart.Root data={SPOKES} config={SPOKE_CONFIG} nameKey="cat" aria-label="Radar">
              <RadarChart.Tooltip />
            </RadarChart.Root>
          ) : (
            <RadarChart.Root data={SPOKES} config={{ v: SPOKE_CONFIG.v }} nameKey="cat" aria-label="Radar">
              <RadarChart.Tooltip />
            </RadarChart.Root>
          )}
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(radar(800, "both"));
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowDown}{ArrowDown}");
    expect(focused()[0]).toBe("Pris 3, a");
    await expect.poll(opacity).toBe(1);
    const fading = pausedLaneFade();
    rerender(radar(300, "both"));
    const fade = await fading;
    const held = opacity();
    expect([side(), held > 0 && held < 1]).toEqual(["bottom", true]);
    // Dropping Pris moves the focus to all series. That is the data update's doing, not a reader's
    // step, so the fade it interrupts goes on from where it is.
    rerender(radar(300, "Forbruk"));
    await expect.poll(() => focused()[0]).toBe("Alle serier, a: Forbruk 1");
    await nextFrames(2);
    expect([side(), fade.playState, opacity()]).toEqual(["bottom", "paused", held]);
  });

  it("still fades the popup into the lane a resize after a key step sends it to, the control", async () => {
    await wideViewport();
    // At 800 px Nettleie's wide value fits the side lane, and at 495 px it needs the lane below.
    const { host, rerender } = renderThemed(chart(800));
    await enter(host);
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(label).toBe("Nettleie");
    await expect.poll(opacity).toBe(1);
    const before = side();
    const resized = laneFrames("Nettleie", before);
    rerender(chart(495));
    const frames = await resized;
    expect([before, frames.at(-1)?.side]).toEqual(["right", "bottom"]);
    expectFadeInto(frames, "bottom");
  });
});

describe("Table, Empty and Skeleton", () => {
  it("lists every category with its value and share", () => {
    renderThemed(
      <Pie>
        <PieChart.Table />
      </Pie>
    );
    const table = page.getByRole("table").element();
    expect([...table.querySelectorAll("thead th")].map((cell) => cell.textContent)).toEqual([
      "Kategori",
      "Verdi",
      "Andel",
    ]);
    // Each cell prints its text beside a hidden spoken twin, so the printed text is read.
    const printed = [...table.querySelectorAll("tbody tr")].map((row) =>
      [...row.children].map(
        (cell) => cell.querySelector('[aria-hidden="true"]')?.textContent ?? cell.textContent
      )
    );
    expect(printed).toEqual([
      ["Strøm", "62", "62\u00a0%"],
      ["Nettleie", "34", "34\u00a0%"],
      ["Avgifter", "4", "4\u00a0%"],
    ]);
  });

  it("shows Empty, and no listbox, when every reading is 0", () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <PieChart.Root
          data={BILL.map(({ name }) => ({ name, v: 0 }))}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          aria-label="Kake">
          <PieChart.Empty />
        </PieChart.Root>
      </LocaleProvider>
    );
    expect(page.getByText("Ingen data for perioden").element()).toBeTruthy();
    expect(page.getByRole("listbox").elements()).toHaveLength(0);
  });

  it.each([
    ["PieChart", <PieChart.Skeleton key="pie" innerRadius={0.62} />, "pie"],
    ["RadialChart", <RadialChart.Skeleton key="radial" />, "radial"],
    ["RadarChart", <RadarChart.Skeleton key="radar" />, "radar"],
  ])("renders %s's Skeleton with one shape and a named loader", (_, skeleton, variant) => {
    const { host } = renderThemed(<LocaleProvider locale="nb-NO">{skeleton}</LocaleProvider>);
    // The placeholder's shapes are Skeletons that readers skip.
    const placeholder = host.querySelector('[data-slot="chart-skeleton"]');
    expect(placeholder?.getAttribute("data-variant")).toBe(variant);
    expect(placeholder?.querySelectorAll('[data-slot="chart-skeleton-mark"]')).toHaveLength(1);
    expect(page.getByRole("status", { name: "Laster diagram" }).elements()).toHaveLength(1);
  });
});
