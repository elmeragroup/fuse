import { expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

it("opens the inner-corner demo's menu and rounds its custom block like the rows", async () => {
  const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}/handbook/theming`, { waitUntil: "load" });

  const demo = page.getByRole("region", { name: "A custom block in a menu", exact: true });
  await demo.getByRole("button", { name: "Account", exact: true }).click();
  const menu = demo.getByRole("menu");
  await expect.poll(async () => menu.count()).toBe(1);

  const corner = (text: string) =>
    menu
      .getByText(text, { exact: true })
      .evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
  // The docs page renders the internal Elmera theme: a 6px popup corner less its 4px padding.
  expect(await corner("Profile")).toBe("2px");
  expect(await corner("Signed in as kari@example.com")).toBe("2px");

  await page.keyboard.press("Escape");
  await expect.poll(async () => menu.count()).toBe(0);
  await page.close();
});
