import type { Locator } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/**
 * A button's box, its line height, the sm control-height token at its place and the demo's
 * `max-w-56` column, all in px, plus whether its content overflows the box.
 */
async function readBox(button: Locator) {
  return button.evaluate((node) => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const px = (value: string): number =>
      value.trim().endsWith("rem") ? parseFloat(value) * rem : parseFloat(value);
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      lineHeight: px(style.lineHeight),
      controlHeightSm: px(style.getPropertyValue("--control-h-sm")),
      column: 14 * rem,
      overflows: node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight,
    };
  });
}

/** The lines `height` adds over `base`; a whole number when the box grew by whole lines. */
function extraLines(height: number, base: number, lineHeight: number): number {
  return (height - base) / lineHeight;
}

describe("Button demos", () => {
  it("keeps a one-line label on the wrap recipe exactly as tall as a plain button", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "button", "Wrapping labels");
    const plain = await readBox(demo.getByRole("button", { name: "Cancel", exact: true }));
    const wrapped = await readBox(demo.getByRole("button", { name: "Save", exact: true }));
    expect(wrapped.height).toBe(plain.height);
    expect(wrapped.overflows).toBe(false);
    await page.close();
  });

  it("wraps long labels inside the narrow column and grows by whole lines", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "button", "Wrapping labels");
    const plain = await readBox(demo.getByRole("button", { name: "Cancel", exact: true }));

    const long = await readBox(
      demo.getByRole("button", { name: "Send the contract to my email and continue", exact: true })
    );
    expect(long.width).toBeLessThanOrEqual(long.column);
    expect(long.overflows).toBe(false);
    const mdLines = extraLines(long.height, plain.height, long.lineHeight);
    expect(mdLines).toBeGreaterThanOrEqual(1);
    expect(mdLines).toBeCloseTo(Math.round(mdLines), 2);

    // The sm button has no plain sibling, so its base is the density's sm control height.
    const small = demo.getByRole("button", {
      name: "Keep the current plan and remind me again next month",
      exact: true,
    });
    const smallBox = await readBox(small);
    expect(smallBox.width).toBeLessThanOrEqual(smallBox.column);
    expect(smallBox.overflows).toBe(false);
    const smLines = extraLines(smallBox.height, smallBox.controlHeightSm, smallBox.lineHeight);
    expect(smLines).toBeGreaterThanOrEqual(1);
    expect(smLines).toBeCloseTo(Math.round(smLines), 2);

    // The trailing icon stays inside the wrapped box.
    const icon = await small.locator("svg[data-icon=inline-end]").boundingBox();
    const box = await small.boundingBox();
    if (icon === null || box === null) {
      throw new Error("expected the sm button and its trailing icon to be laid out");
    }
    expect(icon.x + icon.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(icon.y).toBeGreaterThanOrEqual(box.y - 0.5);
    expect(icon.y + icon.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
    await page.close();
  });
});
