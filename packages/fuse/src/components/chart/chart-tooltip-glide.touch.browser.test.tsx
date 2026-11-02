// The chart tooltip's glide on a tap from one slot to the next, through Playwright's touchscreen in
// Chromium.
import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  barChart,
  frames,
  label,
  positioner,
  surfaceBox,
  watchFrames,
} from "../../../test/chart/tooltip-glide";
import "../../../test/pointer-press";
import { renderThemed } from "../../../test/themed-browser-render";
import "./chart.css";

/** Tap slot `index` of six, low in the plot. */
async function tapSlot(host: HTMLElement, index: number): Promise<void> {
  const box = surfaceBox(host);
  await commands.tap(box.left + (box.width * (index + 0.5)) / 6, box.bottom - 3);
}

describe("a tap on another slot", () => {
  it("glides the pinned popup there", async () => {
    await page.viewport(1024, 768);
    const { host } = renderThemed(barChart());
    await tapSlot(host, 1);
    await expect.poll(label).toBe("Feb");
    await frames(20);
    const from = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    const watch = watchFrames(host);
    await tapSlot(host, 2);
    await expect.poll(label).toBe("Mar");
    await frames(20);
    watch.stop();
    const to = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    expect(to - from).toBeGreaterThan(40);
    expect(
      watch.lefts.some((left) => left > from + 1 && left < to - 1),
      JSON.stringify(watch.lefts)
    ).toBe(true);
    expect(watch.covered).toEqual([]);
  });
});
