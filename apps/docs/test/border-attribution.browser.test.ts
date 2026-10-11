import { describe, expect, it } from "vitest";

import { currentColorReport, currentColorSides, probeBorders } from "./border-attribution";
import type { ProbeScope } from "./demo-sweep";
import { launchSuiteBrowser } from "./suite-browser";

/**
 * The probe against real CSS. Each fixture states in plain CSS whether its border follows the text
 * colour, so the unit under test is `probeBorders`' reading of the browser's cascade and the oracle
 * is which declarations each fixture writes.
 */
const FIXTURES = `
<style>
  [data-demo-stage] { position: relative; color: rgb(0, 0, 0); }
  [data-demo-stage] div { min-height: 8px; }
  .pseudo::before { content: ""; display: block; height: 4px; border: 1px solid currentColor; }
  .own-color::before { color: rgb(255, 0, 0); }
  .fixed-pseudo::before { border-color: rgb(10, 20, 30); }
  .contents { display: contents; }
  .contents::before { content: ""; position: absolute; inset: 0; border: 1px solid currentColor; }
  .fixed-host { border: 1px solid rgb(10, 20, 30); }
  .bare-host { border: 1px solid; }
  .important-color::before { color: rgb(255, 0, 0) !important; }
</style>
<div data-demo-stage>
  <div data-slot="own-color" class="pseudo own-color"></div>
  <span data-slot="contents-host" class="contents">Label</span>
  <div data-slot="fixed-pseudo" class="pseudo fixed-pseudo"></div>
  <div data-slot="fixed-host" class="fixed-host"></div>
  <div data-slot="bare-host" class="bare-host"></div>
  <div data-slot="important-color" class="pseudo important-color"></div>
  <div data-slot="inline-color" class="bare-host" style="color: rgb(255, 0, 0) !important"></div>
  <div style="display: none"><span data-slot="hidden-host" class="contents">Hidden</span></div>
</div>`;

const browser = launchSuiteBrowser();

describe("border attribution in the browser", () => {
  it("reports exactly the visible borders drawn in currentColor", async () => {
    const page = await browser().newPage();
    await page.setContent(FIXTURES);
    const scope: ProbeScope = "stage";
    const readings = await page.locator("[data-demo-stage]").evaluate(probeBorders, scope);
    await page.close();
    const all = ["top", "right", "bottom", "left"];
    expect(
      Object.fromEntries(
        readings.map((reading) => [`${reading.slot}${reading.pseudo}`, currentColorSides(reading)])
      )
    ).toEqual({
      // A pseudo-element's own `color` does not hide its currentColor border.
      "own-color::before": all,
      // A `display: contents` host has no box, but its positioned pseudo-element draws one.
      "contents-host::before": all,
      "fixed-pseudo::before": [],
      "fixed-host": [],
      // A bare `border` takes the initial colour, `currentColor`.
      "bare-host": all,
      // An important own `color` beats the sentinel, so these borders cannot move; the report
      // names them instead.
      "important-color::before": [],
      "inline-color": [],
      // `hidden-host`, under a `display: none` ancestor, draws nothing.
    });
  });

  it("reports every box whose own colour beats the sentinel", async () => {
    const page = await browser().newPage();
    await page.setContent(FIXTURES);
    const scope: ProbeScope = "stage";
    const readings = await page.locator("[data-demo-stage]").evaluate(probeBorders, scope);
    await page.close();
    const report = currentColorReport(
      readings.map((reading) => ({ ...reading, page: "/fixture", density: "dense" }))
    );
    expect(report.filter((claim) => claim.includes("blocks the colour sentinel"))).toEqual([
      "important-color <div>::before blocks the colour sentinel at dense (1 on /fixture)",
      "inline-color <div> blocks the colour sentinel at dense (1 on /fixture)",
    ]);
  });

  it("refuses the unseen scope before a density pass records what opened", async () => {
    const page = await browser().newPage();
    await page.setContent(FIXTURES);
    const scope: ProbeScope = "unseen";
    const read = page.locator("[data-demo-stage]").evaluate(probeBorders, scope);
    await expect(read).rejects.toThrow("no density pass has set");
    await page.close();
  });
});
