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

  it("swaps the Save button's icon for the built-in spinner while pending", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "button", "Pending");
    const save = demo.getByRole("button", { name: "Save", exact: true });
    // DOM audit: the indicator is decorative, so the slot is its only handle; the button's
    // own icon is the one SVG that carries the inline-start marker.
    await expect.poll(async () => save.locator("[data-slot=button-pending-indicator]").count()).toBe(0);
    expect(
      await save.locator("svg[data-icon=inline-start]").evaluate((node) => getComputedStyle(node).display)
    ).not.toBe("none");

    await save.click();
    const saving = demo.getByRole("button", { name: "Saving", exact: true });
    await expect.poll(async () => saving.getAttribute("aria-busy")).toBe("true");
    await expect.poll(async () => saving.locator("[data-slot=button-pending-indicator]").count()).toBe(1);
    expect(
      await saving.locator("svg[data-icon=inline-start]").evaluate((node) => getComputedStyle(node).display)
    ).toBe("none");
    await page.close();
  });

  it("keeps the brand button's width and name while its own centred spinner shows", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "button", "Pending");
    const brand = demo.getByRole("button", { name: "Continue with Brand", exact: true });
    const resting = await brand.boundingBox();
    if (resting === null) {
      throw new Error("expected the brand button to be laid out");
    }
    const content = brand.locator("span").first();
    const overlay = brand.locator("svg.absolute");
    expect(await overlay.evaluate((node) => getComputedStyle(node).display)).toBe("none");

    await brand.click();
    // The documented recipe: the same button, still named, still the same box; the content
    // stays in flow and fades, the overlay spinner shows centred over it.
    await expect.poll(async () => brand.getAttribute("aria-busy")).toBe("true");
    const pending = await brand.boundingBox();
    expect(pending?.width).toBe(resting.width);
    expect(pending?.height).toBe(resting.height);
    expect(await content.evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
    expect(await overlay.evaluate((node) => getComputedStyle(node).display)).toBe("block");
    const spinner = await overlay.boundingBox();
    if (spinner === null || pending === null) {
      throw new Error("expected the overlay spinner to be laid out");
    }
    expect(Math.abs(spinner.x + spinner.width / 2 - (pending.x + pending.width / 2))).toBeLessThan(0.5);
    expect(Math.abs(spinner.y + spinner.height / 2 - (pending.y + pending.height / 2))).toBeLessThan(0.5);
    // The viewBox-less wordmark keeps its intrinsic size under the fade.
    const wordmark = await brand.locator("span svg").first().boundingBox();
    expect(wordmark?.width).toBe(56);
    await expect.poll(async () => demo.getByRole("status").textContent()).toBe("Opening Brand…");
    await page.close();
  });
});
