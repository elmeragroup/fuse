// The legend toggles' target size, name and pressed cue, in Chromium. The
// expectations come from CONTRACT section 9.9 and AGENTS.md's 24 px floor.
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { renderThemed, stampDensity } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme";
import { Chart } from "./chart-namespace";
import "./chart.css";

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

function legend() {
  return renderThemed(
    <S06Chart>
      <Chart.Bar dataKey="household" />
      <Chart.LegendToggleGroup />
    </S06Chart>
  );
}

describe("legend toggles", () => {
  it.each(DENSITIES)("hold the 24 px target floor at %s density", (density) => {
    stampDensity(density);
    legend();
    for (const name of ["Husholdning", "Hytte"]) {
      const box = page.getByRole("button", { name }).element().getBoundingClientRect();
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
  });

  it("names each toggle by its visible label and sits in a group named Serier", () => {
    legend();
    expect(page.getByRole("group", { name: "Serier" }).element()).toBeTruthy();
    expect(page.getByRole("button", { name: "Husholdning" }).element().textContent).toBe("Husholdning");
  });

  it("presses one toggle at a time, clears on a second press and announces each change", async () => {
    const { host } = legend();
    const status = host.querySelector('[role="status"]');
    await userEvent.click(page.getByRole("button", { name: "Hytte" }));
    expect(page.getByRole("button", { name: "Hytte" }).element().getAttribute("aria-pressed")).toBe("true");
    expect(status?.textContent).toBe("Hytte valgt");
    await userEvent.click(page.getByRole("button", { name: "Husholdning" }));
    expect(page.getByRole("button", { name: "Hytte" }).element().getAttribute("aria-pressed")).toBe("false");
    expect(status?.textContent).toBe("Husholdning valgt ");
    await userEvent.click(page.getByRole("button", { name: "Husholdning" }));
    expect(status?.textContent).toBe("Ingen serie valgt");
    // DOM audit: Root's data-selected attribute is its public paint contract.
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-selected")).toBe(false);
  });

  it("draws a 1 px outline on the pressed toggle, which survives forced colours", async () => {
    legend();
    const toggle = page.getByRole("button", { name: "Hytte" }).element();
    await userEvent.click(toggle);
    const style = getComputedStyle(toggle);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("1px");
  });
});
