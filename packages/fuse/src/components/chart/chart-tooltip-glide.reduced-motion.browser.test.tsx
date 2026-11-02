// The chart tooltip under the reader's reduced-motion preference: a slot step moves the popup at
// once, so no frame shows it between its two places.
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  barChart,
  frames,
  hoverSlot,
  label,
  positioner,
  watchFrames,
} from "../../../test/chart/tooltip-glide";
import { renderThemed } from "../../../test/themed-browser-render";
import "./chart.css";

describe("the tooltip under reduced motion", () => {
  it("moves at once on a slot step", async () => {
    await page.viewport(1024, 768);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const { host } = renderThemed(barChart());
    await hoverSlot(host, 1, 6, "band");
    await frames(20);
    const from = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    const watch = watchFrames(host);
    await hoverSlot(host, 2, 6, "band");
    await frames(20);
    watch.stop();
    expect(label()).toBe("Mar");
    const to = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    expect(to - from).toBeGreaterThan(40);
    // Every frame shows the popup at one of its two places, never between them.
    expect(
      watch.lefts.every((left) => Math.abs(left - from) <= 0.5 || Math.abs(left - to) <= 0.5),
      JSON.stringify(watch.lefts)
    ).toBe(true);
    expect(watch.covered).toEqual([]);
  });
});
