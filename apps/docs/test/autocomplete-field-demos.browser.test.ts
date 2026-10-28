import type { Locator } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/** The demo's own result line, which reports what the form submitted. */
function submitted(demo: Locator): Promise<string | null> {
  return demo
    .getByRole("status")
    .filter({ hasText: /^(?:Submitted|Nothing submitted)/u })
    .textContent();
}

describe("AutocompleteField demos", () => {
  it("fills the organization number from a company the search finds, and submits both", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "autocomplete-field", "Search on a server");
    const company = demo.getByRole("combobox", { name: "Company name", exact: true });
    await company.fill("kraft");
    await demo.getByRole("option", { name: /^Fjellkraft Nett AS/u }).click();
    await expect.poll(() => company.inputValue()).toBe("Fjellkraft Nett AS");
    const orgNumber = demo.getByRole("textbox", { name: "Organization number", exact: true });
    await expect.poll(() => orgNumber.inputValue()).toBe("998877666");

    await demo.getByRole("button", { name: "Continue", exact: true }).click();
    await expect
      .poll(() => submitted(demo))
      .toBe("Submitted company: Fjellkraft Nett AS, orgNumber: 998877666");
    await page.close();
  });

  it("keeps a company the search does not find, and submits it with the number typed by hand", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "autocomplete-field", "Search on a server");
    const company = demo.getByRole("combobox", { name: "Company name", exact: true });
    await company.fill("Solberg Rør AS");
    await expect.poll(() => demo.getByText(/^No company found\./u).count()).toBe(1);
    await page.keyboard.press("Tab");
    await page.keyboard.type("923456789");
    await expect
      .poll(() => demo.getByRole("textbox", { name: "Organization number", exact: true }).inputValue())
      .toBe("923456789");
    expect(await company.inputValue()).toBe("Solberg Rør AS");

    await demo.getByRole("button", { name: "Continue", exact: true }).click();
    await expect.poll(() => submitted(demo)).toBe("Submitted company: Solberg Rør AS, orgNumber: 923456789");
    await page.close();
  });
});
