// The polar Root kernel, in Chromium. Unit under test: PieChart.Root, RadialChart.Root and
// RadarChart.Root with their shared parts, Table, Empty and Skeleton, before any family's marks
// land. Oracles, written by hand: CONTRACT section 9.2's DOM order, section 9.3's names and
// section 9.4's key maps and Escape rule, section 9.5's pinning, the drafted dictionary's words,
// the sweep boxes of polar-angle.test.ts, D18's first paint, and D5's and D17's placements, read
// through a test-only mark that places one number per item on the Root's loop.
import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { label } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { MarkValues } from "./chart-motion";
import { usePolarContext } from "./chart-polar-context";
import { placeExit, usePolarCommit, usePolarMark } from "./chart-polar-motion";
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
  ...props
}: {
  readonly children?: ReactNode;
  readonly startAngle?: number;
  readonly endAngle?: number;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <PieChart.Root
          data={BILL}
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
  // DOM audit: every polar Root marks its figure with data-polar.
  const figure = host.querySelector<HTMLElement>("[data-polar]");
  if (figure === null) throw new Error("no polar figure");
  return figure;
}

/** The client point at an angle and a share of the outer radius from the cell's centre. */
function pointAt(host: HTMLElement, angle: number, share: number): readonly [number, number] {
  const surface = page.getByRole("listbox").element().getBoundingClientRect();
  const radians = (angle * Math.PI) / 180;
  const radius = (surface.width / 2) * share;
  return [
    surface.left + surface.width / 2 + radius * Math.sin(radians),
    surface.top + surface.height / 2 - radius * Math.cos(radians),
  ];
}

async function hover(x: number, y: number): Promise<void> {
  const surface = page.getByRole("listbox").element();
  surface.dispatchEvent(
    new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" })
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("the polar Root's structure (sections 9.2 and 9.3)", () => {
  it("renders the description, the instructions, the listbox, the parts and the status in order", () => {
    const { host } = renderThemed(
      <Pie>
        <PieChart.Legend />
      </Pie>
    );
    const figure = figureOf(host);
    expect(figure.getAttribute("aria-label")).toBe("Kake");
    // DOM audit: Root's own children carry their slots in CONTRACT section 9.2's order.
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
    // DOM audit: the description and the instructions are the listbox's described-by paragraphs,
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
    // DOM audit: the instructions are a described-by paragraph the stylesheet hides.
    expect(figureOf(host).querySelector('[data-slot="chart-instructions"]')?.textContent).toBe(
      "Bruk venstre og høyre pil for å gå mellom punktene, og opp og ned for å velge serie."
    );
  });

  it.each([
    ["a full pie", 0, 360, 1],
    ["the top semicircle", -90, 90, 2],
    ["a 270° gauge", -135, 135, 2 / (1 + Math.SQRT1_2)],
  ])("locks the cell of %s to its sweep's box", (_, startAngle, endAngle, ratio) => {
    const { host } = renderThemed(<Pie startAngle={startAngle} endAngle={endAngle} />);
    // DOM audit: the cell's box is the aspect lock the stylesheet sets from the sweep.
    const cell = host.querySelector('[data-slot="chart-polar-cell"]')?.getBoundingClientRect();
    expect((cell?.width ?? 0) / (cell?.height ?? 1)).toBeCloseTo(ratio, 2);
  });
});

describe("the pie and radial key maps (section 9.4)", () => {
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

describe("the radar key map (section 9.4)", () => {
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

describe("Escape and pinning (sections 9.4 and 9.5)", () => {
  it("pins with Enter, hides the pin with the first Escape and lets the second propagate", async () => {
    const { host } = renderThemed(<Pie />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    // DOM audit: Root states the pin on data-pinned, which the stylesheet reads.
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

describe("the dial as one target (Q8)", () => {
  it("hits the listbox at a semicircle's arc ends and picks there", async () => {
    const { host } = renderThemed(<Pie startAngle={-90} endAngle={90} />);
    const surface = page.getByRole("listbox").element();
    // 85° clockwise, 95 % of the way out, sits by the cell's bottom right corner.
    const [x, y] = (() => {
      const box = surface.getBoundingClientRect();
      const radius = box.width / 2;
      const radians = (85 * Math.PI) / 180;
      return [
        box.left + radius + 0.95 * radius * Math.sin(radians),
        box.bottom - 0.95 * radius * Math.cos(radians),
      ];
    })();
    expect(document.elementFromPoint(x, y)).toBe(surface);
    await hover(x, y);
    expect(figureOf(host).getAttribute("data-active")).toBe("pointer");
  });

  it("picks by angle past the rim too, in the cell's corners (Q8)", async () => {
    // Nettleie sweeps 223.2° to 345.6°, so 300° picks it at any distance inside the cell.
    const { host } = renderThemed(<Pie />);
    await hover(...pointAt(host, 300, 1.3));
    // DOM audit: Root writes the active option's place on the figure, which the slices pop against.
    expect(figureOf(host).style.getPropertyValue("--chart-active")).toBe("1");
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
    // DOM audit: each cell prints its text beside a hidden spoken twin, so the printed text is read.
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
    // DOM audit: the placeholder's shapes are Skeletons that readers skip.
    const placeholder = host.querySelector('[data-slot="chart-skeleton"]');
    expect(placeholder?.getAttribute("data-variant")).toBe(variant);
    expect(placeholder?.querySelectorAll('[data-slot="chart-skeleton-mark"]')).toHaveLength(1);
    expect(page.getByRole("status", { name: "Laster diagram" }).elements()).toHaveLength(1);
  });
});

/** Writes the loop's number onto a test item's path, rounded. */
function writeValue(path: SVGPathElement, _look: null, values: MarkValues): void {
  path.setAttribute("data-value", String(Math.round(values[0] ?? 0)));
}

/** One test item: a path whose `data-value` is the number the loop writes, its place plus one, times 10. */
function TestItem({ itemKey, index }: { readonly itemKey: string; readonly index: number }): ReactNode {
  const polar = usePolarContext("Test.Item", ["pie", "radial", "radar"]);
  const { ref, place, node: anchor } = usePolarMark(polar.motion, writeValue, null);
  const commit = usePolarCommit(polar, anchor);
  useLayoutEffect(() => {
    place([(index + 1) * 10], commit(index, [0]));
  });
  return <path ref={ref} data-key={itemKey} />;
}

/**
 * A test-only mark, placed as a polar mark places itself: one item per key, and a ghost that
 * collapses from 10 to 0 for each key that leaves.
 */
function TestMark(): ReactNode {
  const { model, motion } = usePolarContext("Test.Mark", ["pie", "radial", "radar"]);
  const layer = useRef<SVGGElement>(null);
  const drawn = useRef<readonly string[]>([]);
  useLayoutEffect(() => {
    const before = drawn.current;
    drawn.current = model.keys;
    const group = layer.current;
    if (group === null) return;
    for (const key of before.filter((name) => !model.keys.includes(name))) {
      placeExit(motion, group, `test-ghost-${key}`, [10], [0], (path, values) => {
        writeValue(path, null, values);
      });
    }
  }, [model, motion]);
  return (
    <svg data-polar-mark="" data-slot="test-mark">
      {model.keys.map((key, index) => (
        <TestItem key={key} itemKey={key} index={index} />
      ))}
      <g ref={layer} />
    </svg>
  );
}

describe("the loop's placements (D5, D17, D18)", () => {
  it("hides the marks until the chart comes into view, then plays the entrance to rest", async () => {
    const { host } = renderThemed(
      <div style={{ paddingTop: "200vh" }}>
        <Pie>
          <TestMark />
        </Pie>
      </div>
    );
    const figure = figureOf(host);
    // DOM audit: the test mark is plot output under the first-paint rule, read by its slot.
    const mark = host.querySelector('[data-slot="test-mark"]');
    expect(figure.hasAttribute("data-drawn")).toBe(false);
    expect(mark === null ? "" : getComputedStyle(mark).visibility).toBe("hidden");
    figure.scrollIntoView();
    await expect.poll(() => figure.hasAttribute("data-drawn")).toBe(true);
    expect(mark === null ? "" : getComputedStyle(mark).visibility).toBe("visible");
    await expect
      .poll(
        () =>
          [...(mark?.querySelectorAll("[data-key]") ?? [])].map((path) => path.getAttribute("data-value")),
        {
          timeout: 4000,
        }
      )
      .toEqual(["10", "20", "30"]);
  });

  it("collapses a leaving item into a ghost that leaves the DOM, and grows an entering one", async () => {
    const rows = (names: readonly string[]) => names.map((name) => ({ name, v: 1 }));
    const chart = (names: readonly string[]) => (
      <LocaleProvider locale="nb-NO">
        <PieChart.Root
          data={rows(names)}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          data-intro="none"
          aria-label="Kake">
          <TestMark />
        </PieChart.Root>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(chart(["strom", "nettleie"]));
    rerender(chart(["strom", "avgifter"]));
    // DOM audit: the ghost is plot output the loop writes, read by its attribute.
    expect(host.querySelectorAll("[data-ghost]")).toHaveLength(1);
    await expect.poll(() => host.querySelectorAll("[data-ghost]").length, { timeout: 2000 }).toBe(0);
    expect(host.querySelector('[data-key="avgifter"]')?.getAttribute("data-value")).toBe("20");
  });
});
