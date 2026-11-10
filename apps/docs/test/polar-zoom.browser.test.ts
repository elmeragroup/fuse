// A polar tooltip under pinch zoom. Unit under test: the polar tooltip's lane anchor, on the pie
// page's Bill demo as the docs build serves it, in Chromium. The page is top level, so CDP's
// `Emulation.setPageScaleFactor` zooms its visual viewport as a pinch does: at 2× in a 390 × 800
// layout viewport, `window.visualViewport` becomes 195 × 400. Fuse's own browser tests run in an
// iframe, whose visual viewport is its layout viewport, so they cannot see a zoom. Oracle: R2.3 as
// amended, read from the rendered boxes: the popup stays inside the visible area, the visual
// viewport, from `offsetTop` to `offsetTop + height` and from `offsetLeft` to `offsetLeft + width`.
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";
import { settleFrames } from "./landing-page";

describe("a polar tooltip under pinch zoom in Chromium", () => {
  const browser = launchSuiteBrowser(chromium);

  // The review's two repros: a phone-width page, and a 780 px page whose demo sits beside the
  // docs navigation, each with the dial's top where the review placed it.
  it.each([
    [390, 266],
    [780, 244],
  ])(
    "moves the open popup inside the visual viewport when a %s × 800 page zooms to 2×, its dial at y %s",
    { timeout: 30_000 },
    async (width, dialTop) => {
      const context = await browser().newContext({
        viewport: { width, height: 800 },
        timezoneId: "Europe/Oslo",
      });
      const page = await context.newPage();
      const demo = await openDemo(page, "pie-chart", "Bill");
      // DOM audit: the plot's listbox is the dial's box, and the active option holds the tab stop.
      const surface = demo.getByRole("listbox");
      // The dial's top where the review placed it, with the popup opened by focus.
      const top = (await surface.boundingBox())?.y ?? 0;
      await page.evaluate((by) => window.scrollBy({ top: by, behavior: "instant" }), top - dialTop);
      await settleFrames(page, 3);
      await surface.locator('[role="option"][tabindex="0"]').evaluate((option: HTMLElement) => {
        option.focus({ preventScroll: true });
      });
      await settleFrames(page, 14);
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
      await settleFrames(page, 20);
      const read = await page.evaluate(() => {
        const visual = window.visualViewport;
        // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
        const popup = document.querySelector('[data-slot="chart-tooltip"]')?.getBoundingClientRect();
        return {
          visual:
            visual === null
              ? null
              : {
                  top: visual.offsetTop,
                  left: visual.offsetLeft,
                  height: visual.height,
                  width: visual.width,
                },
          popup:
            popup === undefined
              ? null
              : { top: popup.top, left: popup.left, bottom: popup.bottom, right: popup.right },
        };
      });
      await context.close();
      expect(read.visual?.height).toBeCloseTo(400, 0);
      const { visual, popup } = read;
      if (visual === null || popup === null) throw new Error("no visual viewport or no popup");
      expect({
        top: popup.top >= visual.top - 0.5,
        bottom: popup.bottom <= visual.top + visual.height + 0.5,
        left: popup.left >= visual.left - 0.5,
        right: popup.right <= visual.left + visual.width + 0.5,
      }).toEqual({ top: true, bottom: true, left: true, right: true });
    }
  );

  // A pan of the zoomed page. Unit under test: the side lane's inner edge. A horizontal mouse wheel
  // (`page.mouse.wheel`) over a point outside any chart is a user scroll, which Chromium applies to
  // the visual viewport first: on a page with no horizontal overflow, zoomed in, it pans the visual
  // viewport across the layout viewport, so `visualViewport.offsetLeft` grows, as it does when a
  // reader pans a pinch-zoomed page. The wheel's delta is in screen pixels, a third of that in CSS
  // pixels at 3×, so 3,000 pans past the far edge, where the pan stops. At 3× in a 1280 × 900
  // viewport the visual viewport is 426.67 px wide, and a full pan right puts its left edge at
  // 853.33, right of the right lane's inner edge, as the review's repro does. A synthetic touch
  // gesture (`Input.synthesizeScrollGesture`) pans it on macOS but not in Linux headless Chromium,
  // with or without touch enabled, so the case uses the wheel, which pans on both. Oracle: R2.3 as
  // amended, read from the rendered boxes: the popup lies inside the visual viewport on all four
  // sides and does not intersect the dial.
  it(
    "keeps the popup inside a visual viewport panned past the side lane's inner edge",
    { timeout: 30_000 },
    async () => {
      const context = await browser().newContext({
        viewport: { width: 1280, height: 900 },
        timezoneId: "Europe/Oslo",
      });
      const page = await context.newPage();
      const demo = await openDemo(page, "pie-chart", "Bill");
      // DOM audit: the plot's listbox is the dial's box, and the active option holds the tab stop.
      const surface = demo.getByRole("listbox");
      const top = (await surface.boundingBox())?.y ?? 0;
      await page.evaluate((by) => window.scrollBy({ top: by, behavior: "instant" }), top - 100);
      await settleFrames(page, 3);
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 3 });
      await settleFrames(page, 3);
      // The wheel pans the visual viewport rightward, here as far as it goes.
      await page.mouse.move(20, 20);
      await page.mouse.wheel(3000, 0);
      await settleFrames(page, 6);
      await surface.locator('[role="option"][tabindex="0"]').evaluate((option: HTMLElement) => {
        option.focus({ preventScroll: true });
      });
      await page.keyboard.press("ArrowRight");
      await settleFrames(page, 20);
      const read = await page.evaluate(() => {
        const visual = window.visualViewport;
        // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
        const popup = document.querySelector('[data-slot="chart-tooltip"]')?.getBoundingClientRect();
        // DOM audit: the plot's listbox spans the dial's box.
        const dial = document.querySelector('[data-demo-stage] [role="listbox"]')?.getBoundingClientRect();
        return {
          visual:
            visual === null
              ? null
              : {
                  top: visual.offsetTop,
                  left: visual.offsetLeft,
                  height: visual.height,
                  width: visual.width,
                },
          popup:
            popup === undefined
              ? null
              : { top: popup.top, left: popup.left, bottom: popup.bottom, right: popup.right },
          dial:
            dial === undefined
              ? null
              : { top: dial.top, left: dial.left, bottom: dial.bottom, right: dial.right },
        };
      });
      await context.close();
      const { visual, popup, dial } = read;
      if (visual === null || popup === null || dial === null)
        throw new Error("no visual viewport, popup or dial");
      // The pan reached past the lane's inner edge: the visual viewport's left edge lies right of the
      // dial's right rim.
      expect(visual.left).toBeGreaterThan(dial.right);
      const overlaps =
        Math.min(popup.right, dial.right) - Math.max(popup.left, dial.left) > 0.5 &&
        Math.min(popup.bottom, dial.bottom) - Math.max(popup.top, dial.top) > 0.5;
      expect({
        top: popup.top >= visual.top - 0.5,
        bottom: popup.bottom <= visual.top + visual.height + 0.5,
        left: popup.left >= visual.left - 0.5,
        right: popup.right <= visual.left + visual.width + 0.5,
        overDial: overlaps,
      }).toEqual({ top: true, bottom: true, left: true, right: true, overDial: false });
    }
  );
});
