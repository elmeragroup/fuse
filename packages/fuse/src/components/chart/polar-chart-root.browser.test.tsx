import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { label, pointerAt } from "../../../test/chart/marks";
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
  // Every polar Root marks its figure with data-polar.
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

/**
 * Move the real pointer to a point, so the pointer the chart reads and the cursor the browser hit
 * tests are one, wherever an earlier test left the cursor.
 */
async function hover(x: number, y: number): Promise<void> {
  await pointerAt(x, y);
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
    // Root's own children carry their slots in CONTRACT section 9.2's order.
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
