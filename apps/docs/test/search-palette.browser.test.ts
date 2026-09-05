import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

const DIALOG = '[role="dialog"]';
const FIELD = 'input[role="combobox"]';
const OPTION = '[role="option"]';

/** What the palette says is active — the option Enter would open. */
type ActiveOption = {
  id: string;
  selected: string | null;
  text: string;
};

async function openDocsPage(pathname = "/components/button"): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`${docsBaseUrl()}${pathname}`, { waitUntil: "networkidle" });
  await page.locator("h1").first().waitFor();
  return page;
}

async function waitForPalette(page: Page, state: "visible" | "hidden"): Promise<void> {
  await page.locator(DIALOG).waitFor({ state });
}

/** Opening moves focus into the popup asynchronously; this is that wait, not a sleep. */
async function waitForSearchFieldFocus(page: Page): Promise<void> {
  await page.waitForFunction(
    (selector) => document.activeElement === document.querySelector(String(selector)),
    FIELD
  );
}

/** Closing restores focus asynchronously too. */
async function waitForFocusedText(page: Page, text: string): Promise<void> {
  await page.waitForFunction((expected) => {
    const active = document.activeElement;
    if (active === null) {
      return false;
    }
    const label = active.getAttribute("aria-label") ?? active.textContent;
    return label.includes(String(expected));
  }, text);
}

async function focusedDescriptor(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const active = document.activeElement;
    if (active === null) {
      return "";
    }
    const label = active.getAttribute("aria-label") ?? active.textContent;
    return `${active.tagName.toLowerCase()}:${label.trim()}`;
  });
}

async function optionTitles(page: Page): Promise<readonly string[]> {
  return await page.locator(OPTION).allInnerTexts();
}

async function waitForOptionCount(page: Page, count: number): Promise<void> {
  await page.waitForFunction(
    ([selector, expected]) => document.querySelectorAll(String(selector)).length === Number(expected),
    [OPTION, count] as const
  );
}

async function readActiveOption(page: Page): Promise<ActiveOption> {
  return await page.evaluate((selector) => {
    const field = document.querySelector(selector);
    const id = field?.getAttribute("aria-activedescendant") ?? "";
    const option = id === "" ? null : document.getElementById(id);
    return {
      id,
      selected: option?.getAttribute("aria-selected") ?? null,
      text: (option?.textContent ?? "").trim(),
    };
  }, FIELD);
}

async function waitForActiveOptionOtherThan(page: Page, previousId: string): Promise<ActiveOption> {
  await page.waitForFunction(
    ([selector, id]) => {
      const field = document.querySelector(String(selector));
      const current = field?.getAttribute("aria-activedescendant") ?? "";
      return current !== "" && current !== String(id);
    },
    [FIELD, previousId] as const
  );
  return await readActiveOption(page);
}

describe("docs ⌘K palette (docs-site.md §3.2)", () => {
  it("opens on ⌘K and on Ctrl+K from anywhere in the docs, and Escape closes it", async () => {
    const page = await openDocsPage();

    await page.keyboard.press("Meta+k");
    await waitForPalette(page, "visible");
    await waitForSearchFieldFocus(page);
    expect(await focusedDescriptor(page)).toBe("input:Search the documentation");

    await page.keyboard.press("Escape");
    await waitForPalette(page, "hidden");

    await page.keyboard.press("Control+k");
    await waitForPalette(page, "visible");
    await waitForSearchFieldFocus(page);
    expect(await focusedDescriptor(page)).toBe("input:Search the documentation");

    await page.keyboard.press("Escape");
    await waitForPalette(page, "hidden");
    await page.close();
  });

  it("opens from the header search button", async () => {
    const page = await openDocsPage("/");
    await page
      .getByRole("banner")
      .getByRole("button", { name: /search/i })
      .click();
    await waitForPalette(page, "visible");
    await waitForSearchFieldFocus(page);
    expect(await focusedDescriptor(page)).toBe("input:Search the documentation");
    await page.close();
  });

  it("lists component and handbook pages, and filters them as you type", async () => {
    const page = await openDocsPage();
    await page.keyboard.press("Meta+k");
    await waitForPalette(page, "visible");

    const initial = await optionTitles(page);
    expect(initial.some((title) => title.includes("Theme matrix"))).toBe(true);
    expect(initial.some((title) => title.includes("Dialog"))).toBe(true);

    await page.keyboard.type("theme mat");
    await waitForOptionCount(page, 1);
    expect((await optionTitles(page))[0]).toContain("Theme matrix");

    await page.keyboard.press("Escape");
    await waitForPalette(page, "hidden");
    await page.close();
  });

  it("moves the active option with the arrow keys and opens it with Enter", async () => {
    const page = await openDocsPage();
    await page.keyboard.press("Meta+k");
    await waitForPalette(page, "visible");
    await page.keyboard.type("theme");

    const first = await readActiveOption(page);
    expect(first.selected).toBe("true");

    await page.keyboard.press("ArrowDown");
    const second = await waitForActiveOptionOtherThan(page, first.id);
    expect(second.selected).toBe("true");
    expect(second.text).not.toBe(first.text);

    await page.keyboard.press("ArrowUp");
    const back = await waitForActiveOptionOtherThan(page, second.id);
    expect(back.text).toBe(first.text);

    await page.keyboard.type(" mat");
    await waitForOptionCount(page, 1);
    expect((await readActiveOption(page)).text).toContain("Theme matrix");

    await page.keyboard.press("Enter");
    await page.waitForURL(`${docsBaseUrl()}/handbook/theme-matrix`);
    await waitForPalette(page, "hidden");
    await page.getByRole("heading", { name: "Theme matrix", level: 1 }).waitFor();
    await page.close();
  });

  it("keeps keyboard-active results visible within the list without scrolling the page", async () => {
    const page = await openDocsPage();
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.keyboard.press("Meta+k");
    await waitForPalette(page, "visible");
    await waitForSearchFieldFocus(page);
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const geometry = () =>
      page.locator(FIELD).evaluate((field) => {
        const active = document.getElementById(field.getAttribute("aria-activedescendant") ?? "");
        const list = document.getElementById(field.getAttribute("aria-controls") ?? "");
        if (!active || !list) throw new Error("Expected linked search option and list");
        const a = active.getBoundingClientRect();
        const l = list.getBoundingClientRect();
        return {
          visible: a.top >= l.top - 1 && a.bottom <= l.bottom + 1,
          optionTop: a.top,
          optionBottom: a.bottom,
          listTop: l.top,
          listBottom: l.bottom,
          overflow: list.scrollHeight > list.clientHeight,
          scrollTop: list.scrollTop,
          first: active === list.firstElementChild,
          last: active === list.lastElementChild,
          focused: document.activeElement === field,
          selected: active.getAttribute("aria-selected"),
          x: window.scrollX,
          y: window.scrollY,
        };
      });
    expect((await geometry()).overflow).toBe(true);
    for (const key of [
      "End",
      "Home",
      "ArrowUp",
      "ArrowDown",
      ...Array.from({ length: 15 }, () => "ArrowDown"),
    ]) {
      await page.keyboard.press(key);
      await expect.poll(geometry).toMatchObject({ visible: true });
      const current = await geometry();
      expect(current.focused).toBe(true);
      expect(current.selected).toBe("true");
      expect({ x: current.x, y: current.y }).toEqual(scroll);
      if (key === "End") {
        expect(current.last).toBe(true);
        expect(current.scrollTop).toBeGreaterThan(0);
      }
      if (key === "Home") expect(current.first).toBe(true);
    }
    await page.locator(FIELD).fill("theme mat");
    await waitForOptionCount(page, 1);
    await expect.poll(geometry).toMatchObject({ visible: true });
    expect((await readActiveOption(page)).text).toContain("Theme matrix");
    await page.keyboard.press("Enter");
    await page.waitForURL(`${docsBaseUrl()}/handbook/theme-matrix`);
    await page.close();
  });

  it("returns focus to the invoking context on close", async () => {
    const page = await openDocsPage();

    await page.getByRole("link", { name: "Tokens", exact: true }).focus();
    const before = await focusedDescriptor(page);
    expect(before).toBe("a:Tokens");

    await page.keyboard.press("Meta+k");
    await waitForPalette(page, "visible");
    await waitForSearchFieldFocus(page);
    await page.keyboard.press("Escape");
    await waitForPalette(page, "hidden");
    await waitForFocusedText(page, "Tokens");
    expect(await focusedDescriptor(page)).toBe(before);

    await page
      .getByRole("banner")
      .getByRole("button", { name: /search/i })
      .click();
    await waitForPalette(page, "visible");
    await waitForSearchFieldFocus(page);
    await page.keyboard.press("Escape");
    await waitForPalette(page, "hidden");
    await waitForFocusedText(page, "Search");
    expect(await focusedDescriptor(page)).toContain("Search");

    await page.close();
  });

  it("reports an empty result set instead of an empty popup", async () => {
    const page = await openDocsPage();
    await page.keyboard.press("Meta+k");
    await waitForPalette(page, "visible");
    await page.keyboard.type("zzzz-no-such-page");
    await waitForOptionCount(page, 0);
    expect(await page.locator('[role="status"]').innerText()).toContain("No pages match");
    await page.close();
  });
});
