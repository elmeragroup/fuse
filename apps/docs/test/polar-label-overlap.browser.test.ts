// Unit under test: every polar and clock demo's labels as the docs build serves them, from a
// 320 px phone to a 728 px tablet in 8 px steps. Oracle: SPEC's L8 label check, written as two
// rules of geometry: no two shown labels of one chart overlap, and no shown label leaves its
// chart's own box. A label is any text the dial places: slice labels and leaders' text, angle and
// ring values, Now's label, a value label and the centre's lines. A label hidden by thinning, by
// `data-hidden` or by an empty slice shows nothing, so it takes no room.
import { beforeAll, describe, expect, it } from "vitest";

import { launchSuiteBrowser, shareDemoPage, waitForAllDemos } from "./demo-page";

/** The labels a dial places, by slot or part. */
const LABELS = [
  '[data-slot="pie-chart-label"]',
  '[data-slot="radar-chart-angle-label"]',
  '[data-slot="radar-chart-radius-label"]',
  '[data-slot="clock-chart-angle-label"]',
  '[data-slot="clock-chart-radius-label"]',
  '[data-slot="clock-chart-value-label"]',
  '[data-slot="clock-chart-now"] > [data-part="label"]',
  '[data-slot="pie-chart-center-value"]',
  '[data-slot="pie-chart-center-label"]',
  '[data-slot="pie-chart-center-share"]',
  '[data-slot="pie-chart-center-max"]',
  '[data-slot="clock-chart-center-label"]',
  '[data-slot="clock-chart-active-value"]',
].join(", ");

/** The widths swept, 320 to 728 px in 8 px steps. */
const WIDTHS = Array.from({ length: (728 - 320) / 8 + 1 }, (_, step) => 320 + step * 8);

describe("polar labels from 320 to 728 px", () => {
  const browser = launchSuiteBrowser();

  describe.each(["pie-chart", "radial-chart", "radar-chart", "clock-chart"])("on the %s page", (slug) => {
    const loaded = shareDemoPage(browser, slug, { width: 728, height: 900 }, "Europe/Oslo");
    beforeAll(() => waitForAllDemos(loaded()));

    it("keeps every label clear of the others and inside its chart at every width", async () => {
      const page = loaded();
      const faults: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        // A resize reaches the labels through container queries and each layer's ResizeObserver,
        // which write before the next frame paints.
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        );
        const found = await page.evaluate(
          ([selector, at]) =>
            [...document.querySelectorAll<HTMLElement>("[data-demo-stage] [data-polar]")].flatMap((chart) => {
              const demo = chart.closest("[data-demo-frame]")?.getAttribute("aria-labelledby") ?? "?";
              const own = chart.getBoundingClientRect();
              const shown = [...chart.querySelectorAll<HTMLElement>(selector)]
                .filter(
                  (label) =>
                    label.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
                    label.textContent.trim() !== ""
                )
                .map((label) => ({
                  label,
                  text: label.textContent.trim(),
                  box: label.getBoundingClientRect(),
                }))
                .filter(({ box }) => box.width > 0 && box.height > 0);
              const out = shown.flatMap(({ text, box }) =>
                box.left < own.left - 0.5 ||
                box.right > own.right + 0.5 ||
                box.top < own.top - 0.5 ||
                box.bottom > own.bottom + 0.5
                  ? [`${String(at)} px ${demo}: "${text}" leaves its chart`]
                  : []
              );
              const overlaps = shown.flatMap((a, index) =>
                shown.slice(index + 1).flatMap((b) => {
                  // A part inside another label, such as the centre's maximum in its label line, is that label.
                  if (a.label.contains(b.label) || b.label.contains(a.label)) return [];
                  const x = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
                  const y = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
                  return x > 0.5 && y > 0.5
                    ? [`${String(at)} px ${demo}: "${a.text}" overlaps "${b.text}"`]
                    : [];
                })
              );
              return [...out, ...overlaps];
            }),
          [LABELS, width] as const
        );
        faults.push(...found);
      }
      expect(faults.join("\n")).toBe("");
    });
  });
});
